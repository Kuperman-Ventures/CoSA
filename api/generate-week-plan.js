export const runtime = 'edge'

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }

  const {
    weekStartDate,
    currentWeekKpis,
    deferredItems,
    taskLibrary,
    fridayReviewAnswers,
  } = await req.json()

  const systemPrompt = `You are the Chief of Staff for a senior marketing executive running three tracks:
1. Kuperman Advisors (fractional CMO business development) — Priority 1
2. Shared Networking — Priority 1.5
3. Full-time Job Search — Priority 2
4. Kuperman Ventures (Encore OS product) — Priority 3

Hard constraints:
- Work hours: 9:30am–4:00pm Monday–Friday. Hard stop at 4pm.
- Time blocks: BD (9:30–11am), Networking (11am–12pm), Job Search (1–2pm), Encore OS (2–4pm)
- Each day has a specific task mix defined by daysOfWeek on each template.
- Do not schedule a task on a day it is not assigned to (check daysOfWeek field).
- Deferred items from the reschedule queue must be placed first in the appropriate day and block.
- If KPI targets were missed last week, weight toward the tasks that drive those KPIs.
- Only include tasks with status "Active". Never schedule "Paused" or "Archived" tasks.

Return a JSON object with exactly this shape:
{
  "days": {
    "Monday": [tasks],
    "Tuesday": [tasks],
    "Wednesday": [tasks],
    "Thursday": [tasks],
    "Friday": [tasks]
  },
  "aiRationale": "one paragraph explaining key decisions"
}

Each task object must have exactly these fields:
{ "templateId": string, "name": string, "track": string, "timeBlock": string, "estimateMinutes": number }

Return only valid JSON. No preamble. No markdown fences.`

  const userPrompt = `Week starting: ${weekStartDate}

KPI gaps from last week:
${JSON.stringify(currentWeekKpis ?? [])}

Deferred reschedule items (schedule these first in their respective blocks):
${JSON.stringify(deferredItems ?? [])}

Friday review note (what the user said about last week):
${fridayReviewAnswers?.q2 ?? 'none'}

Active task library (use daysOfWeek to determine which day each task belongs to):
${JSON.stringify((taskLibrary ?? []).filter((t) => t.status === 'Active'))}`

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
        max_tokens: 2500,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    })

    const data = await response.json()
    if (!response.ok) {
      return Response.json({ error: data.error?.message ?? 'AI error' }, { status: 500 })
    }

    const raw = (data.content?.[0]?.text ?? '').trim()
    // Strip markdown fences if Claude wraps the response despite being told not to
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    const plan = JSON.parse(cleaned)
    return Response.json({ plan })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
