/* global process */
export const runtime = 'edge'

export default async function handler(req) {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }

  // Validate API key — Claude passes this in the Authorization header
  const authHeader = req.headers.get('Authorization')
  const expectedKey = process.env.COSA_PROPOSAL_API_KEY
  if (!authHeader || authHeader !== `Bearer ${expectedKey}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
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

  // Write to Supabase using service role key (bypasses RLS for server-side write)
  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  )

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
