export const config = { runtime: 'edge' }

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }

  let body
  try {
    body = await req.json()
  } catch (err) {
    return new Response(JSON.stringify({ error: `Bad request body: ${err.message}` }), { status: 400 })
  }

  const { weekStartDate, currentWeekKpis, deferredItems, taskLibrary, fridayReviewAnswers } = body

  // Slim the library — only send what the AI needs
  const slimLibrary = (taskLibrary ?? [])
    .filter((t) => t.status === 'Active')
    .map((t) => ({
      id:              t.id,
      name:            t.name,
      track:           t.track,
      timeBlock:       t.timeBlock,
      estimateMinutes: t.defaultTimeEstimate ?? 25,
      daysOfWeek:      t.daysOfWeek ?? ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    }))

  const systemPrompt = `You are the Chief of Staff for a senior marketing executive running three tracks:
1. Kuperman Advisors (fractional CMO business development) — Priority 1
2. Shared Networking — Priority 1.5
3. Full-time Job Search — Priority 2
4. Kuperman Ventures (Encore OS product) — Priority 3

Hard constraints:
- Work hours: 9:30am–4:00pm Monday–Friday. Hard stop at 4pm.
- Time blocks: BD (9:30–11am), Networking (11am–12pm), Job Search (1–2pm), Encore OS (2–4pm)
- Each task has a daysOfWeek array. Do NOT schedule a task on a day not in that array.
- Deferred items must be placed first in their block on the appropriate day.
- Weight toward tasks that address KPI gaps.

Return ONLY a valid JSON object — no markdown, no explanation, no code fences:
{"days":{"Monday":[tasks],"Tuesday":[tasks],"Wednesday":[tasks],"Thursday":[tasks],"Friday":[tasks]},"aiRationale":"one paragraph"}

Each task object must have exactly: {"templateId":"string","name":"string","track":"string","timeBlock":"string","estimateMinutes":number}`

  const userPrompt = `Week starting: ${weekStartDate}
KPI gaps: ${JSON.stringify(currentWeekKpis ?? [])}
Deferred items: ${JSON.stringify(deferredItems ?? [])}
Friday note: ${fridayReviewAnswers?.q2 ?? 'none'}
Task library: ${JSON.stringify(slimLibrary)}`

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 20000)

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    })

    clearTimeout(timeoutId)

    const data = await response.json()
    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: data.error?.message ?? 'Anthropic error' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const raw = (data.content?.[0]?.text ?? '').trim()
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    const plan = JSON.parse(cleaned)
    return new Response(JSON.stringify({ plan }), { headers: { 'Content-Type': 'application/json' } })
  } catch (err) {
    const msg = err.name === 'AbortError' ? 'Request timed out — try again' : err.message
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
