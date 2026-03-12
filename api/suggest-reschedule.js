export const config = { runtime: 'edge' }

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'Anthropic API key not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let body
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { rescheduleQueue = [], remainingTasks = [], todayDate } = body

  const systemPrompt = `You are the Chief of Staff AI assistant for Jason Kuperman's personal productivity app.

Jason runs three work tracks with strict priority order:
1. Kuperman Advisors (BD work — fractional CMO pipeline) — HIGHEST PRIORITY
2. Shared (Networking) — feeds both Advisors and Job Search — MEDIUM-HIGH PRIORITY
3. Job Search — MEDIUM PRIORITY
4. Kuperman Ventures (Encore OS product build) — THIRD PRIORITY

Time blocks in daily order: BD (9:30–11am) → Networking (11am–noon) → Job Search (1–2pm) → Encore OS (2–4pm) → Friday Review (Fridays only)

Core rescheduling rules:
- When a task overruns in a block, push the NEXT task in the SAME block to tomorrow. Do NOT touch other tracks.
- When a task is cancelled, offer to move it to tomorrow in the same time block.
- When time frees up unexpectedly, suggest the next highest-priority task by track order.
- Never auto-reschedule silently. Always explain the move clearly in plain language.
- Advisors tasks always take priority over Job Search, which takes priority over Ventures.
- Hard stop at 4pm — nothing moves past the Encore OS block.
- Be specific and concise — one clear recommendation per situation.`

  const userPrompt = `Today is ${todayDate}.

Tasks that need rescheduling:
${rescheduleQueue.length > 0
    ? rescheduleQueue.map((t) =>
        `- "${t.taskName}" (${t.timeBlock} block, ${t.track} track) — Reason: ${t.reason}.${t.remainingMinutes ? ` ${t.remainingMinutes} minutes of work remaining.` : ''}`
      ).join('\n')
    : '(none)'}

Remaining tasks for today (in current order):
${remainingTasks.length > 0
    ? remainingTasks.map((t, i) =>
        `${i + 1}. "${t.name || t.taskName}" (${t.timeBlock} block, ${t.track} track, ${t.estimateMinutes}min)`
      ).join('\n')
    : '(none)'}

Give ONE clear, specific rescheduling recommendation in 2–4 sentences. Tell Jason exactly which task to move, where it should go, and why. Be direct — no fluff.`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 300,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      return new Response(JSON.stringify({ error: `Anthropic error: ${err}` }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const data = await response.json()
    const suggestion = data.content?.[0]?.text?.trim() ?? ''

    return new Response(JSON.stringify({ suggestion }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
