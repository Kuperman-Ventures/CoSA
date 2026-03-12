const CALENDAR_ID =
  'c_f733c89ebd8fa8294dfb9b29147e64acc78eae845b47ea1271ddb7844e191716@group.calendar.google.com'

// Minutes from midnight when each block starts
const BLOCK_START_MINUTES = {
  'BD':        9 * 60 + 30,   // 9:30am
  'Networking': 11 * 60,      // 11:00am
  'Job Search': 13 * 60,      // 1:00pm
  'Encore OS':  14 * 60,      // 2:00pm
  'Friday':     14 * 60,      // 2:00pm
}

// Google Calendar colorId values that best match track colors
const TRACK_COLOR_IDS = {
  advisors:   '10', // Basil (dark green)
  networking: '6',  // Tangerine (orange)
  jobSearch:  '9',  // Blueberry (blue)
  ventures:   '3',  // Grape (purple)
}

const BASE_URL = 'https://www.googleapis.com/calendar/v3/calendars'

// ─── Time helpers ─────────────────────────────────────────────────────────────

function minutesToTimeString(totalMinutes) {
  const h = Math.floor(totalMinutes / 60).toString().padStart(2, '0')
  const m = (totalMinutes % 60).toString().padStart(2, '0')
  return `${h}:${m}:00`
}

function buildEventTimes(task, allTasksInBlock, date) {
  const blockStart = BLOCK_START_MINUTES[task.timeBlock] ?? BLOCK_START_MINUTES['BD']
  const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone

  // Calculate offset: sum of estimateMinutes for all tasks that come before this one
  let offsetMinutes = 0
  for (const t of allTasksInBlock) {
    if (t.id === task.id) break
    offsetMinutes += t.estimateMinutes ?? 25
  }

  const startMin = blockStart + offsetMinutes
  const endMin   = startMin + (task.estimateMinutes ?? 25)

  return {
    start: { dateTime: `${date}T${minutesToTimeString(startMin)}`, timeZone: userTz },
    end:   { dateTime: `${date}T${minutesToTimeString(endMin)}`,   timeZone: userTz },
  }
}

function buildEventBody(task, allTasksInBlock, date) {
  const subtaskList = Array.isArray(task.subtasks) && task.subtasks.length > 0
    ? task.subtasks.map((s, i) => `${i + 1}. ${s}`).join('\n')
    : ''

  return {
    summary:  task.name,
    description: subtaskList,
    colorId:  TRACK_COLOR_IDS[task.track] ?? '1',
    ...buildEventTimes(task, allTasksInBlock, date),
  }
}

// ─── API calls ────────────────────────────────────────────────────────────────

async function gcalFetch(path, method, providerToken, body) {
  try {
    const res = await fetch(`${BASE_URL}/${encodeURIComponent(CALENDAR_ID)}/events${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${providerToken}`,
        'Content-Type': 'application/json',
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
    if (!res.ok) {
      const text = await res.text()
      console.error(`[googleCalendar ${method} ${path}]`, res.status, text)
      return null
    }
    return method === 'DELETE' ? true : res.json()
  } catch (err) {
    console.error(`[googleCalendar ${method} ${path}]`, err.message)
    return null
  }
}

/**
 * Create a calendar event for a single task.
 * allTasksInBlock should be the ordered list of tasks sharing the same time block,
 * so sequential start times can be calculated.
 * Returns the Google Calendar event ID string, or null on failure.
 */
export async function createCalendarEvent(task, allTasksInBlock, providerToken, date) {
  if (!providerToken) return null
  const data = await gcalFetch('', 'POST', providerToken, buildEventBody(task, allTasksInBlock, date))
  return data?.id ?? null
}

/**
 * Fully replace an existing event (used when task details change).
 */
export async function updateCalendarEvent(eventId, task, allTasksInBlock, providerToken, date) {
  if (!providerToken || !eventId) return
  await gcalFetch(`/${eventId}`, 'PUT', providerToken, buildEventBody(task, allTasksInBlock, date))
}

/**
 * Move an event to a new date, keeping the same time block slot.
 * Used when a rescheduled task is confirmed to a future day.
 */
export async function moveCalendarEvent(eventId, task, providerToken, newDate) {
  if (!providerToken || !eventId) return
  // Pass the single task as its own "block" so it starts at the block start time
  const times = buildEventTimes(task, [task], newDate)
  await gcalFetch(`/${eventId}`, 'PATCH', providerToken, times)
}

/**
 * Delete a calendar event. Silently ignores 404 (already deleted).
 */
export async function deleteCalendarEvent(eventId, providerToken) {
  if (!providerToken || !eventId) return
  await gcalFetch(`/${eventId}`, 'DELETE', providerToken)
}

/**
 * Create events for every task in a snapshot, grouped by block for sequential timing.
 * Returns a map of { [taskId]: calendarEventId }.
 */
export async function createEventsForSnapshot(tasks, providerToken, date) {
  if (!providerToken) return {}

  const blockGroups = tasks.reduce((acc, t) => {
    if (!acc[t.timeBlock]) acc[t.timeBlock] = []
    acc[t.timeBlock].push(t)
    return acc
  }, {})

  const results = await Promise.all(
    tasks.map(async (task) => {
      const blockTasks = blockGroups[task.timeBlock] ?? [task]
      const eventId = await createCalendarEvent(task, blockTasks, providerToken, date)
      return [task.id, eventId]
    }),
  )

  return Object.fromEntries(results.filter(([, id]) => id !== null))
}
