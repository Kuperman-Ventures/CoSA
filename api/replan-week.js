export const runtime = 'edge'

const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }

  const { publishedPlan, calendarEvents, todayName } = await req.json()

  // Build set of event IDs currently in the calendar
  const currentEventIds = new Set((calendarEvents ?? []).map((e) => e.id))

  // Find all tasks across all days
  const allPublishedTasks = Object.entries(publishedPlan.days ?? {}).flatMap(([day, dayData]) =>
    (dayData?.tasks ?? []).map((t) => ({ ...t, day })),
  )

  // Diff: which CoSA tasks have been deleted from the calendar?
  const deletedTasks = allPublishedTasks.filter(
    (t) => t.gcalEventId && !currentEventIds.has(t.gcalEventId),
  )

  // Which days are still remaining (today and after)?
  const todayIndex = DAY_ORDER.indexOf(todayName)
  const remainingDays = todayIndex >= 0 ? DAY_ORDER.slice(todayIndex) : DAY_ORDER

  const systemPrompt = `You are the Chief of Staff for a senior marketing executive.
It is currently ${todayName}. You are replanning the remaining days of this week.

Rules:
- Only generate tasks for remaining days: ${remainingDays.join(', ')}
- Do not schedule a task on a day its daysOfWeek field does not include
- Deleted tasks represent freed capacity — you may reschedule them to remaining days if appropriate
- Keep tasks already completed (in past days) as-is — only return remaining days
- Preserve the same time block structure: BD (9:30–11am), Networking (11am–12pm), Job Search (1–2pm), Encore OS (2–4pm)

Return a JSON object with exactly this shape:
{
  "days": {
    ${remainingDays.map((d) => `"${d}": [tasks]`).join(',\n    ')}
  },
  "aiRationale": "one paragraph explaining what changed and why"
}

Each task object: { "templateId": string, "name": string, "track": string, "timeBlock": string, "estimateMinutes": number }

Return only valid JSON. No preamble. No markdown fences.`

  const userPrompt = `Original published plan:
${JSON.stringify(publishedPlan.days, null, 2)}

Tasks deleted from Google Calendar (freed capacity):
${JSON.stringify(deletedTasks.map((t) => ({ name: t.name, templateId: t.templateId, day: t.day, timeBlock: t.timeBlock })))}

Remaining days to replan: ${remainingDays.join(', ')}

Generate a revised plan for only the remaining days.`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    })

    const data = await response.json()
    if (!response.ok) {
      return Response.json({ error: data.error?.message ?? 'AI error' }, { status: 500 })
    }

    const raw = (data.content?.[0]?.text ?? '').trim()
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    const replan = JSON.parse(cleaned)
    return Response.json({ replan })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
