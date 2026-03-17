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

// Capacity (minutes) for each block
export const BLOCK_CAPACITY_MINUTES = {
  'BD':         90,   // 9:30–11:00am
  'Networking': 60,   // 11:00am–12:00pm
  'Job Search': 60,   // 1:00–2:00pm
  'Encore OS':  120,  // 2:00–4:00pm
  'Friday':     120,  // 2:00–4:00pm
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

function buildEventBody(task, allTasksInBlock, date, extras = {}) {
  const subtaskList = Array.isArray(task.subtasks) && task.subtasks.length > 0
    ? task.subtasks.map((s, i) => `${i + 1}. ${s}`).join('\n')
    : ''

  const body = {
    summary:     task.name,
    description: subtaskList,
    colorId:     TRACK_COLOR_IDS[task.track] ?? '1',
    ...buildEventTimes(task, allTasksInBlock, date),
  }

  // CoSA metadata — written on all events so Replan can identify and safely
  // touch only events that this app created. templateId and planId are optional.
  body.extendedProperties = {
    private: {
      cosaTag:        'cosa-event',
      ...(extras.templateId ? { cosaTemplateId: extras.templateId } : {}),
      ...(extras.planId     ? { cosaPlanId:     String(extras.planId) } : {}),
    },
  }

  return body
}

// ─── API calls ────────────────────────────────────────────────────────────────

async function gcalFetch(path, method, providerToken, body, calendarId = CALENDAR_ID) {
  try {
    const res = await fetch(`${BASE_URL}/${encodeURIComponent(calendarId)}/events${path}`, {
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
export async function createCalendarEvent(task, allTasksInBlock, providerToken, date, extras = {}) {
  if (!providerToken) return null
  const data = await gcalFetch('', 'POST', providerToken, buildEventBody(task, allTasksInBlock, date, extras))
  return data?.id ?? null
}

/**
 * Fully replace an existing event (used when task details change).
 * extras: { templateId, planId } — preserved so CoSA sync can still identify the event.
 */
export async function updateCalendarEvent(eventId, task, allTasksInBlock, providerToken, date, extras = {}) {
  if (!providerToken || !eventId) return
  await gcalFetch(`/${eventId}`, 'PUT', providerToken, buildEventBody(task, allTasksInBlock, date, extras))
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

/**
 * Upsert calendar events for an entire week plan.
 * - Tasks that already have a gcalEventId → PUT (update) the existing event.
 * - Tasks without a gcalEventId → POST (create) a new event.
 * This prevents duplicate events when publishing more than once.
 *
 * planDays: { Monday: { date, tasks: [...] }, ... }
 * Returns a copy of planDays with gcalEventId filled in on each task.
 * Sequential (not concurrent) to avoid Google Calendar API rate limits.
 */
export async function createWeekPlanEvents(planDays, providerToken, planId) {
  if (!providerToken) return planDays

  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
  const updatedDays = {}

  for (const dayName of dayNames) {
    const day = planDays[dayName]
    if (!day) { updatedDays[dayName] = day; continue }

    // Group tasks by block for sequential offset calculation.
    // Use the instance's own unique id (plan-...) so multiple instances of
    // the same template get correct sequential start times within a block.
    const normalisedTasks = day.tasks.map((t, i) => ({
      ...t,
      id: t.id || t.templateId || `task-${dayName}-${i}`,
    }))

    const blockGroups = normalisedTasks.reduce((acc, t) => {
      if (!acc[t.timeBlock]) acc[t.timeBlock] = []
      acc[t.timeBlock].push(t)
      return acc
    }, {})

    const updatedTasks = []
    for (const task of normalisedTasks) {
      const blockTasks = blockGroups[task.timeBlock] ?? [task]
      const taskForApi  = { ...task, estimateMinutes: task.estimateMinutes ?? 25 }
      const blockForApi = blockTasks.map((t) => ({ ...t, estimateMinutes: t.estimateMinutes ?? 25 }))
      const extras = { templateId: task.templateId, planId }

      let gcalEventId = task.gcalEventId ?? null

      if (gcalEventId) {
        // Event already exists from a previous publish — update it in place.
        // On a 404 (event was manually deleted in GCal), fall through to create.
        const res = await gcalFetch(`/${gcalEventId}`, 'PUT', providerToken, buildEventBody(taskForApi, blockForApi, day.date, extras))
        if (!res) {
          // PUT failed (likely deleted) — create a fresh event instead
          gcalEventId = await createCalendarEvent(taskForApi, blockForApi, providerToken, day.date, extras)
        }
      } else {
        gcalEventId = await createCalendarEvent(taskForApi, blockForApi, providerToken, day.date, extras)
      }

      updatedTasks.push({ ...task, gcalEventId: gcalEventId ?? null })
    }

    updatedDays[dayName] = { ...day, tasks: updatedTasks }
  }

  return updatedDays
}

/**
 * Fetch all CoSA-tagged events from the calendar within a date range.
 * Used by Replan to compare published plan against current calendar state.
 * timeMin / timeMax: ISO 8601 strings (e.g. "2026-03-16T00:00:00Z")
 */
export async function fetchCoSACalendarEvents(providerToken, timeMin, timeMax) {
  if (!providerToken) return []
  const params = new URLSearchParams({
    timeMin,
    timeMax,
    privateExtendedProperty: 'cosaTag=cosa-event',
    singleEvents: 'true',
    maxResults: '250',
  })
  const data = await gcalFetch(`?${params.toString()}`, 'GET', providerToken)
  return data?.items ?? []
}

/**
 * Fetch ALL calendar events (including personal) within a date range.
 * Used by Replan to detect personal events that replaced deleted CoSA tasks.
 * timeMin / timeMax: ISO 8601 strings (e.g. "2026-03-17T00:00:00Z")
 */
export async function fetchAllCalendarEvents(providerToken, timeMin, timeMax) {
  if (!providerToken) return []
  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: 'true',
    maxResults: '250',
  })
  const data = await gcalFetch(`?${params.toString()}`, 'GET', providerToken)
  return data?.items ?? []
}

/**
 * Fetch timed events from the user's primary Google Calendar within a date range.
 * Returns only events with a dateTime start (i.e. not all-day events).
 * CoSA-tagged events (cosaTag=cosa-event) are excluded to avoid double-counting.
 * timeMin / timeMax: ISO 8601 strings (e.g. "2026-03-16T00:00:00Z")
 */
export async function fetchPersonalCalendarEvents(providerToken, timeMin, timeMax) {
  if (!providerToken) return []
  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: 'true',
    maxResults: '250',
    orderBy: 'startTime',
  })
  const data = await gcalFetch(`?${params.toString()}`, 'GET', providerToken, null, 'primary')
  const items = data?.items ?? []
  return items.filter(
    (ev) =>
      ev.start?.dateTime != null &&
      ev.extendedProperties?.private?.cosaTag !== 'cosa-event',
  )
}
