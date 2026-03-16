/* global process */
export const config = { runtime: 'edge' }

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function hashKey(key) {
  const encoder = new TextEncoder()
  const data = encoder.encode(key)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

export default async function handler(req) {
  // Health check — confirms edge routing is live
  if (req.method === 'GET') {
    return jsonResponse({ ok: true, runtime: 'edge' })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  let body
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }

  const { userId, proposals, sessionContext } = body
  if (!userId || !proposals || !Array.isArray(proposals) || proposals.length === 0) {
    return jsonResponse({ error: 'Missing required fields: userId, proposals (non-empty array)' }, 400)
  }

  // Extract API key from Authorization header
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Unauthorized' }, 401)
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
    return jsonResponse({ error: 'Unauthorized' }, 401)
  }

  // Validate each proposal has required fields
  for (const p of proposals) {
    const validActions = ['add', 'modify', 'pause', 'activate', 'reorder']
    if (!validActions.includes(p.action)) {
      return jsonResponse({ error: `Invalid action type: ${p.action}` }, 400)
    }
    if (!p.taskData) {
      return jsonResponse({ error: 'Each proposal must include taskData' }, 400)
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
    return jsonResponse({ error: error.message }, 500)
  }

  return jsonResponse({
    success: true,
    proposalId: data.id,
    proposalCount: proposals.length,
    message: `${proposals.length} proposal(s) submitted for review in CoSA.`,
  })
}
