/**
 * Shared "This Week" health math: CoSA calendar blocks + tagged personal events,
 * same rules as Calendar → This Week sidebar. Used by WeekPlanner and Weekly Review.
 */

/** Local YYYY-MM-DD (avoid UTC drift from toISOString). */
export function formatLocalDate(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function eventDurationMins(ev) {
  if (!ev.start?.dateTime || !ev.end?.dateTime) return 30
  return Math.max(15, Math.round((new Date(ev.end.dateTime) - new Date(ev.start.dateTime)) / 60000))
}

const SUB_TRACK_TO_ALLOCATION_BUCKET = {
  advisors: {
    'Business Development': 'Networking & Business Development',
    'Networking & Business Development': 'Networking & Business Development',
    Content: 'Materials',
    Meetings: 'Client Work',
  },
  jobSearch: {
    Networking: 'Network Development & Outreach',
    'L&D': 'Searching',
    Applications: 'Materials',
    Admin: 'Network Development & Outreach',
    Boards: 'Searching',
    'Network Development & Outreach': 'Network Development & Outreach',
    Searching: 'Searching',
    Materials: 'Materials',
  },
  ventures: {
    Growth: 'Alpha',
    Research: 'Product',
    Subscription: 'Product',
    Build: 'Product',
    Alpha: 'Alpha',
    Product: 'Product',
    'Beta Prep': 'Beta Prep',
  },
}

export function allocationSubTrackKey(track, rawSubTrack, bucketKeys) {
  if (!rawSubTrack || !bucketKeys?.length) return null
  const trimmed = String(rawSubTrack).trim()
  if (!trimmed) return null
  const aliases = SUB_TRACK_TO_ALLOCATION_BUCKET[track]
  const mapped = aliases?.[trimmed] ?? trimmed
  if (bucketKeys.includes(mapped)) return mapped
  const lower = mapped.toLowerCase()
  const ciHit = bucketKeys.find((k) => k.toLowerCase() === lower)
  return ciHit ?? null
}

/** Default % allocations — keep in sync with WeekPlanner `DEFAULT_ALLOCATIONS`. */
export const COSA_ALLOCATION_DEFAULTS = {
  advisors: {
    weekly: 700,
    subTracks: {
      'Networking & Business Development': 60,
      Materials: 20,
      Product: 10,
      'Client Work': 5,
      'Back Office': 5,
    },
  },
  jobSearch: {
    weekly: 700,
    subTracks: {
      'Network Development & Outreach': 75,
      Searching: 15,
      Materials: 10,
    },
  },
  ventures: {
    weekly: 500,
    subTracks: {
      Alpha: 70,
      Product: 25,
      'Beta Prep': 5,
    },
  },
  development: { weekly: 60, subTracks: {} },
  cosaAdmin: { weekly: 60, subTracks: {} },
}

/** Convert stored allocation % to absolute minute targets per sub-track (WeekPlanner shape). */
export function allocationsPercentToTrackTargets(allocations) {
  const result = {}
  for (const [track, cfg] of Object.entries(allocations)) {
    const subTracks = {}
    for (const [st, pct] of Object.entries(cfg.subTracks ?? {})) {
      subTracks[st] = Math.round((pct / 100) * cfg.weekly)
    }
    result[track] = { weekly: cfg.weekly, subTracks }
  }
  return result
}

/**
 * @param {object[]} weekEvents  CoSA-tagged calendar events (cosaTag === cosa-event)
 * @param {Record<string, object>} calendarTags gcal id → tag row from Supabase
 * @param {string|null} nowISO   ISO timestamp ceiling — events that start after this
 *                               are excluded. Pass null to include all (past weeks).
 */
export function buildCalendarHealthModel(weekEvents, calendarTags, trackTargets, weekRangeStart, weekRangeEnd, nowISO = null) {
  // Derive today's date string for calendarTags date-filtering (YYYY-MM-DD).
  const todayStr = nowISO ? nowISO.slice(0, 10) : null
  const totals = {}
  const contributors = {}

  function ensureTrack(t) {
    if (!totals[t]) {
      totals[t] = { total: 0, sub: {} }
      contributors[t] = { all: [], bySub: {} }
    }
  }

  function addContribution(track, minutes, meta, subKey) {
    ensureTrack(track)
    const item = { minutes, ...meta }
    contributors[track].all.push(item)
    totals[track].total += minutes
    if (subKey) {
      totals[track].sub[subKey] = (totals[track].sub[subKey] ?? 0) + minutes
      if (!contributors[track].bySub[subKey]) contributors[track].bySub[subKey] = []
      contributors[track].bySub[subKey].push(item)
    }
  }

  const ADV_NET_SUB = 'Networking & Business Development'
  const JS_NET_SUB = 'Network Development & Outreach'

  function addNetworkingSplit(minutes, metaBase, rawSub) {
    const h1 = Math.floor(minutes / 2)
    const h2 = minutes - h1
    const advBucket = trackTargets.advisors?.subTracks?.[ADV_NET_SUB] != null ? ADV_NET_SUB : null
    const jsBucket = trackTargets.jobSearch?.subTracks?.[JS_NET_SUB] != null ? JS_NET_SUB : null
    const note =
      'Track: Shared Networking — time split 50/50 to Advisors (Networking & BD) and Job Search (Net Dev & Outreach).'
    addContribution('advisors', h1, {
      ...metaBase,
      id: `${metaBase.id}-split-adv`,
      splitFromNetworking: true,
      splitNote: note,
      rawSubTrack: rawSub || null,
      allocationBucket: advBucket,
    }, advBucket)
    addContribution('jobSearch', h2, {
      ...metaBase,
      id: `${metaBase.id}-split-js`,
      splitFromNetworking: true,
      splitNote: note,
      rawSubTrack: rawSub || null,
      allocationBucket: jsBucket,
    }, jsBucket)
  }

  for (const ev of weekEvents) {
    // Skip future events — don't count time that hasn't happened yet.
    if (nowISO && ev.start?.dateTime && ev.start.dateTime > nowISO) continue
    const priv = ev.extendedProperties?.private ?? {}
    const track = priv.cosaTrack || null
    const subTrack = priv.cosaSubTrack || null
    if (!track) continue
    const dur = eventDurationMins(ev)
    const startISO = ev.start?.dateTime ?? null
    const dayLabel = startISO
      ? new Date(startISO).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
      : '—'
    const metaBase = {
      id: `gcal-${ev.id}`,
      source: 'cosa-calendar',
      title: ev.summary ?? '(untitled)',
      startISO,
      sortKey: startISO || '',
      dayLabel,
    }
    if (track === 'networking') {
      addNetworkingSplit(dur, metaBase, subTrack)
      continue
    }
    const bucketKeys = Object.keys(trackTargets[track]?.subTracks ?? {})
    const subKey = allocationSubTrackKey(track, subTrack, bucketKeys)
    addContribution(
      track,
      dur,
      {
        ...metaBase,
        rawSubTrack: subTrack || null,
        allocationBucket: subKey,
      },
      subKey,
    )
  }

  for (const [gcalId, tag] of Object.entries(calendarTags)) {
    const { track, subTrack, durationMin, date: tagDate } = tag
    if (!track || !durationMin) continue
    if (!tagDate || tagDate < weekRangeStart || tagDate > weekRangeEnd) continue
    // Skip tagged events whose date is in the future.
    if (todayStr && tagDate > todayStr) continue
    const dayLabel = tagDate
      ? new Date(`${tagDate}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
      : '—'
    const metaBase = {
      id: `tag-${gcalId}`,
      source: 'personal-tagged',
      title: tag.title || '(tagged event)',
      startISO: null,
      sortKey: `${tagDate}T12:00:00`,
      dayLabel,
    }
    if (track === 'networking') {
      addNetworkingSplit(durationMin, metaBase, subTrack)
      continue
    }
    const bucketKeys = Object.keys(trackTargets[track]?.subTracks ?? {})
    const subKey = allocationSubTrackKey(track, subTrack, bucketKeys)
    addContribution(
      track,
      durationMin,
      {
        ...metaBase,
        rawSubTrack: subTrack || null,
        allocationBucket: subKey,
      },
      subKey,
    )
  }

  return { totals, contributors }
}
