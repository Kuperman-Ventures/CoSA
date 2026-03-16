export const config = { runtime: 'edge' }

const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

// Slim a task down to only the fields the AI needs (drops gcalEventId, _uid, etc.)
function slimTask(t) {
  return {
    templateId: t.templateId,
    name: t.name,
    track: t.track,
    timeBlock: t.timeBlock,
    estimateMinutes: t.estimateMinutes,
  }
}

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
  const { publishedPlan, calendarEventIds, todayName } = body

  // Build set of event IDs currently in the calendar
  const currentEventIds = new Set(calendarEventIds ?? [])

  // Find tasks that have been deleted from Google Calendar
  const allPublishedTasks = Object.entries(publishedPlan.days ?? {}).flatMap(([day, dayData]) =>
    (dayData?.tasks ?? []).map((t) => ({ ...t, day })),
  )
  const deletedTasks = allPublishedTasks
    .filter((t) => t.gcalEventId && !currentEventIds.has(t.gcalEventId))
    .map((t) => ({ name: t.name, templateId: t.templateId, day: t.day, timeBlock: t.timeBlock }))

  // Only replan remaining days
  const todayIndex = DAY_ORDER.indexOf(todayName)
  const remainingDays = todayIndex >= 0 ? DAY_ORDER.slice(todayIndex) : DAY_ORDER

  // Slim the published plan — only remaining days, only essential task fields
  const slimPlan = {}
  for (const day of remainingDays) {
    const tasks = (publishedPlan.days?.[day]?.tasks ?? []).map(slimTask)
    slimPlan[day] = tasks
  }

  const systemPrompt = `You are a Chief of Staff AI. It is ${todayName}. Replan the remaining days of this week.

Rules:
- Only return days: ${remainingDays.join(', ')}
- Deleted tasks = freed capacity; reschedule them to remaining days if appropriate
- Time blocks: BD (9:30–11am), Networking (11am–12pm), Job Search (1–2pm), Encore OS (2–4pm)
- Return ONLY valid JSON, no preamble, no markdown

Response shape:
{"days":{"${remainingDays[0]}":[...],...},"aiRationale":"one sentence"}`

  const userPrompt = `Plan for remaining days:
${JSON.stringify(slimPlan)}

Deleted from calendar (reschedule if possible):
${JSON.stringify(deletedTasks)}

Each task must have: templateId, name, track, timeBlock, estimateMinutes`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 1200,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    })

    const data = await response.json()
    if (!response.ok) {
      return new Response(JSON.stringify({ error: data.error?.message ?? 'AI error' }), { status: 500 })
    }

    const raw = (data.content?.[0]?.text ?? '').trim()
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    const replan = JSON.parse(cleaned)
    return new Response(JSON.stringify({ replan }), { headers: { 'Content-Type': 'application/json' } })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message ?? 'Replan failed' }), { status: 500 })
  }
}
