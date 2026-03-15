/* global process */
export const runtime = 'edge'

async function hashKey(key) {
  const encoder = new TextEncoder()
  const data = encoder.encode(key)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }

  let body
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { userId, proposals, sessionContext } = body
  if (!userId || !proposals || !Array.isArray(proposals) || proposals.length === 0) {
    return Response.json({ error: 'Missing required fields: userId, proposals (non-empty array)' }, { status: 400 })
  }

  // Extract API key from Authorization header
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const incomingKey = authHeader.slice(7)

  // Write to Supabase using service role key (bypasses RLS for server-side lookup)
  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  )

  // Validate against the user's stored API key hash
  const incomingHash = await hashKey(incomingKey)
  const { data: prefs, error: prefsError } = await supabase
    .from('user_preferences')
    .select('api_key_hash')
    .eq('user_id', userId)
    .maybeSingle()

  if (prefsError || !prefs?.api_key_hash || prefs.api_key_hash !== incomingHash) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Validate each proposal has required fields
  for (const p of proposals) {
    const validActions = ['add', 'modify', 'pause', 'activate', 'reorder']
    if (!validActions.includes(p.action)) {
      return Response.json({ error: `Invalid action type: ${p.action}` }, { status: 400 })
    }
    if (!p.taskData) {
      return Response.json({ error: 'Each proposal must include taskData' }, { status: 400 })
    }
  }

  const { data, error } = await supabase
    .from('ai_task_proposals')
    .insert({
      user_id: userId,
      proposal_data: { proposals, sessionContext: sessionContext ?? '' },
      status: 'pending',
    })
    .select('id')
    .single()

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({
    success: true,
    proposalId: data.id,
    proposalCount: proposals.length,
    message: `${proposals.length} proposal(s) submitted for review in CoSA.`,
  })
}
