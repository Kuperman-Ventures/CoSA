const CALENDAR_ID =
  'c_f733c89ebd8fa8294dfb9b29147e64acc78eae845b47ea1271ddb7844e191716@group.calendar.google.com'

// Google Calendar colorId values that best match track colors
const TRACK_COLOR_IDS = {
  advisors:    '10', // Basil (dark green)
  jobSearch:   '9',  // Blueberry (blue)
  ventures:    '3',  // Grape (purple)
  networking:  '6',  // Tangerine (orange)
  development: '1',  // Lavender (violet)
  cosaAdmin:   '7',  // Peacock (teal/cyan)
}

const BASE_URL = 'https://www.googleapis.com/calendar/v3/calendars'

// ─── API calls ────────────────────────────────────────────────────────────────

// Sentinel errors thrown for token/permission failures — callers can catch these
// specifically to show the user an actionable re-auth message.
export class GCalAuthError extends Error {
  constructor(status, message) {
    super(message)
    this.name = 'GCalAuthError'
    this.status = status
  }
}

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
      if (res.status === 401 || res.status === 403) {
        throw new GCalAuthError(res.status, text)
      }
      return null
    }
    return method === 'DELETE' ? true : res.json()
  } catch (err) {
    if (err instanceof GCalAuthError) throw err
    console.error(`[googleCalendar ${method} ${path}]`, err.message)
    return null
  }
}


/**
 * Delete a calendar event. Silently ignores 404 (already deleted).
 */
export async function deleteCalendarEvent(eventId, providerToken) {
  if (!providerToken || !eventId) return
  await gcalFetch(`/${eventId}`, 'DELETE', providerToken)
}

/**
 * Patch an existing CoSA calendar event with explicit start/end ISO datetimes.
 * Stores cosaTrack/cosaSubTrack in extendedProperties so allocations work without a templateId.
 * Returns the full updated GCal event object, or null on failure.
 */
export async function updateCalendarEventAtTime(eventId, title, track, startISO, endISO, providerToken, extras = {}) {
  if (!providerToken || !eventId) return null
  const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone
  const body = {
    summary:  title,
    colorId:  TRACK_COLOR_IDS[track] ?? '1',
    start: { dateTime: startISO, timeZone: userTz },
    end:   { dateTime: endISO,   timeZone: userTz },
    extendedProperties: {
      private: {
        cosaTag:      'cosa-event',
        cosaTrack:    track,
        cosaSubTrack: extras.subTrack ?? '',
        ...(extras.templateId ? { cosaTemplateId: extras.templateId } : {}),
      },
    },
  }
  const data = await gcalFetch(`/${eventId}`, 'PATCH', providerToken, body)
  return data ?? null
}


/**
 * Create a calendar event at an exact start/end ISO datetime.
 * Stores track, subTrack, and optional templateId in extendedProperties
 * so the CalendarView can compute health bars without a DB query.
 * Returns the Google Calendar event object, or null on failure.
 */
export async function createCalendarEventAtTime({
  name,
  track,
  subTrack,
  templateId,
  startISO,
  endISO,
  providerToken,
}) {
  if (!providerToken) return null
  const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone
  const body = {
    summary:  name,
    colorId:  TRACK_COLOR_IDS[track] ?? '1',
    start:    { dateTime: startISO, timeZone: userTz },
    end:      { dateTime: endISO,   timeZone: userTz },
    extendedProperties: {
      private: {
        cosaTag:     'cosa-event',
        cosaTrack:   track    ?? '',
        cosaSubTrack: subTrack ?? '',
        ...(templateId ? { cosaTemplateId: templateId } : {}),
      },
    },
  }
  const data = await gcalFetch('', 'POST', providerToken, body)
  return data ?? null
}

/**
 * Move/resize an existing CoSA event to new exact start/end times.
 * Preserves all extended properties (track, subTrack, templateId).
 */
export async function patchCalendarEventTime(eventId, startISO, endISO, providerToken) {
  if (!providerToken || !eventId) return null
  const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone
  const data = await gcalFetch(`/${eventId}`, 'PATCH', providerToken, {
    start: { dateTime: startISO, timeZone: userTz },
    end:   { dateTime: endISO,   timeZone: userTz },
  })
  return data ?? null
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
