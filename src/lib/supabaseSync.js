import { supabase } from './supabaseClient'

// ─── Task Templates ───────────────────────────────────────────────────────────

function taskToRow(task, userId) {
  return {
    id: task.id,
    user_id: userId,
    name: task.name ?? '',
    track: task.track ?? 'advisors',
    sub_track: task.subTrack ?? null,
    default_estimate_minutes: task.defaultTimeEstimate ?? 25,
    kpi_mapping: task.kpiMapping ?? '',
    status: task.status ?? 'Active',
    subtasks: Array.isArray(task.subtasks) ? task.subtasks : [],
    updated_at: new Date().toISOString(),
  }
}

function rowToTask(row) {
  return {
    id: row.id,
    name: row.name,
    track: row.track,
    subTrack: row.sub_track ?? null,
    defaultTimeEstimate: row.default_estimate_minutes,
    kpiMapping: row.kpi_mapping,
    status: row.status,
    subtasks: Array.isArray(row.subtasks) ? row.subtasks : [],
  }
}

export async function upsertTaskTemplates(tasks, userId) {
  if (!supabase || !userId || !tasks.length) return
  try {
    const rows = tasks.map((t) => taskToRow(t, userId))
    const { error } = await supabase
      .from('task_templates')
      .upsert(rows, { onConflict: 'id' })
    if (error) console.error('[upsertTaskTemplates]', error.message)
  } catch (err) {
    console.error('[upsertTaskTemplates]', err.message)
  }
}

export async function loadTaskTemplates(userId) {
  if (!supabase || !userId) return null
  try {
    const { data, error } = await supabase
      .from('task_templates')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
    if (error) { console.error('[loadTaskTemplates]', error.message); return null }
    return (data ?? []).map(rowToTask)
  } catch (err) {
    console.error('[loadTaskTemplates]', err.message)
    return null
  }
}

// ─── Today Task Instances ─────────────────────────────────────────────────────

function todayTaskToRow(task, userId, date, index) {
  return {
    id: task.id,
    user_id: userId,
    scheduled_for_date: date,
    queue_order: index,
    name_snapshot: task.name ?? '',
    track_snapshot: task.track ?? 'advisors',
    estimate_minutes_snapshot: task.estimateMinutes ?? 25,
    kpi_mapping_snapshot: task.kpiMapping ?? '',
    template_id_snapshot: task.templateId ?? null,
    calendar_event_id: task.calendarEventId ?? null,
  }
}

function rowToTodayTask(row) {
  return {
    id: row.id,
    templateId: row.template_id_snapshot,
    name: row.name_snapshot,
    track: row.track_snapshot,
    estimateMinutes: row.estimate_minutes_snapshot,
    kpiMapping: row.kpi_mapping_snapshot,
    calendarEventId: row.calendar_event_id ?? null,
  }
}

export async function upsertTodayTasks(tasks, userId, date) {
  if (!supabase || !userId || !tasks.length) return
  try {
    const rows = tasks.map((t, i) => todayTaskToRow(t, userId, date, i))
    const { error } = await supabase
      .from('today_task_instances')
      .upsert(rows, { onConflict: 'id' })
    if (error) console.error('[upsertTodayTasks]', error.message)
  } catch (err) {
    console.error('[upsertTodayTasks]', err.message)
  }
}

/**
 * Replace all today tasks for a given date with a fresh set.
 * Used when a Week Ahead plan is published or replanned so the Today queue
 * stays in sync with the plan without leaving stale rows from prior deploys.
 */
export async function replaceTodayTasks(tasks, userId, date) {
  if (!supabase || !userId || !tasks.length) return
  try {
    const { error: delError } = await supabase
      .from('today_task_instances')
      .delete()
      .eq('user_id', userId)
      .eq('scheduled_for_date', date)
    if (delError) { console.error('[replaceTodayTasks:delete]', delError.message); return }
    const rows = tasks.map((t, i) => todayTaskToRow(t, userId, date, i))
    const { error } = await supabase
      .from('today_task_instances')
      .insert(rows)
    if (error) console.error('[replaceTodayTasks:insert]', error.message)
  } catch (err) {
    console.error('[replaceTodayTasks]', err.message)
  }
}

export async function loadTodayTasks(userId, date) {
  if (!supabase || !userId) return null
  try {
    const { data, error } = await supabase
      .from('today_task_instances')
      .select('*')
      .eq('user_id', userId)
      .eq('scheduled_for_date', date)
      .order('queue_order', { ascending: true })
    if (error) { console.error('[loadTodayTasks]', error.message); return null }
    return (data ?? []).map(rowToTodayTask)
  } catch (err) {
    console.error('[loadTodayTasks]', err.message)
    return null
  }
}

// ─── Timer Sessions ───────────────────────────────────────────────────────────

function sessionToRow(session, task, userId) {
  return {
    id: session.sessionId,
    user_id: userId,
    task_instance_id: task.id,
    task_name: task.name ?? '',
    track: task.track ?? 'advisors',
    sub_track: task.subTrack ?? '',
    kpi_mapping: task.kpiMapping ?? '',
    kpi_values: session.kpiValues && Object.keys(session.kpiValues).length > 0
      ? session.kpiValues
      : null,
    quantity: session.quantity ?? 1,
    timer_state: session.timerState ?? 'notStarted',
    completion_type: session.completionType ?? null,
    estimate_seconds: session.estimateSeconds ?? 0,
    elapsed_seconds: session.elapsedSeconds ?? 0,
    pause_count: session.pauseCount ?? 0,
    pause_duration_seconds: session.pauseDurationSeconds ?? 0,
    overrun_seconds: Math.max(0, (session.elapsedSeconds ?? 0) - (session.estimateSeconds ?? 0)),
    cancelled_seconds: session.cancelledSeconds ?? 0,
    outcome_achieved: session.outcomeAchieved ?? null,
    definition_of_done: session.definitionOfDone ?? '',
    actual_completed: session.actualCompleted ?? '',
    started_at: session.startedAtISO ?? null,
    completed_at: session.completionLoggedAtISO ?? null,
    updated_at: new Date().toISOString(),
  }
}

function rowToSession(row) {
  const estimateSeconds = row.estimate_seconds ?? 0
  const elapsedSeconds = row.elapsed_seconds ?? 0
  // If the timer was running when saved, restore as paused — the timer is no longer live.
  const savedState = row.timer_state ?? 'notStarted'
  const timerState = savedState === 'running' ? 'paused' : savedState
  return {
    sessionId: row.id,
    taskId: row.task_instance_id,
    timerState,
    estimateSeconds,
    remainingSeconds: Math.max(0, estimateSeconds - elapsedSeconds),
    elapsedSeconds,
    pauseCount: row.pause_count ?? 0,
    pauseDurationSeconds: row.pause_duration_seconds ?? 0,
    currentPauseStartedAtMs: null,
    cancelledSeconds: row.cancelled_seconds ?? 0,
    startedAtISO: row.started_at ?? null,
    completionType: row.completion_type ?? null,
    definitionOfDone: row.definition_of_done ?? '',
    actualCompleted: row.actual_completed ?? '',
    outcomeAchieved: row.outcome_achieved ?? null,
    completionLoggedAtISO: row.completed_at ?? null,
    kpiValues: row.kpi_values && typeof row.kpi_values === 'object' ? row.kpi_values : {},
  }
}

function rowToLogEntry(row) {
  return {
    id: row.id,
    taskName: row.task_name,
    track: row.track,
    subTrack: row.sub_track ?? '',
    kpiMapping: row.kpi_mapping,
    kpiValues: row.kpi_values ?? {},
    quantity: row.quantity ?? 1,
    completionType: row.completion_type,
    outcomeAchieved: row.outcome_achieved,
    definitionOfDoneUsed: Boolean(row.definition_of_done?.trim()),
    completedAt: row.completed_at ?? row.updated_at,
    estimateSeconds: row.estimate_seconds,
    elapsedSeconds: row.elapsed_seconds,
    pauseCount: row.pause_count,
    pauseDurationSeconds: row.pause_duration_seconds,
    cancelledSeconds: row.cancelled_seconds,
    isQuickLog: Boolean(row.is_quick_log),
  }
}

export async function upsertTimerSession(session, task, userId) {
  if (!supabase || !userId || !session?.sessionId) return
  try {
    const row = sessionToRow(session, task, userId)
    const { error } = await supabase
      .from('timer_sessions')
      .upsert(row, { onConflict: 'id' })
    if (error) console.error('[upsertTimerSession]', error.message)
  } catch (err) {
    console.error('[upsertTimerSession]', err.message)
  }
}

export async function loadTimerSessions(userId, days = 90) {
  if (!supabase || !userId) return null
  try {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
    const { data, error } = await supabase
      .from('timer_sessions')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', since)
      .not('completion_type', 'is', null)
      .order('completed_at', { ascending: true })
    if (error) { console.error('[loadTimerSessions]', error.message); return null }
    return (data ?? []).map(rowToLogEntry)
  } catch (err) {
    console.error('[loadTimerSessions]', err.message)
    return null
  }
}

export async function loadTodayTimerSessions(userId, taskInstanceIds) {
  if (!supabase || !userId || !taskInstanceIds?.length) return null
  try {
    const { data, error } = await supabase
      .from('timer_sessions')
      .select('*')
      .eq('user_id', userId)
      .in('task_instance_id', taskInstanceIds)
    if (error) { console.error('[loadTodayTimerSessions]', error.message); return null }
    return (data ?? []).map(rowToSession)
  } catch (err) {
    console.error('[loadTodayTimerSessions]', err.message)
    return null
  }
}


// ─── Friday Reviews ───────────────────────────────────────────────────────────

export async function upsertFridayReview(record, userId) {
  if (!supabase || !userId) return
  try {
    const { error } = await supabase
      .from('friday_reviews')
      .upsert(
        { ...record, user_id: userId, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,week_start' },
      )
    if (error) console.error('[upsertFridayReview]', error.message)
  } catch (err) {
    console.error('[upsertFridayReview]', err.message)
  }
}

export async function loadFridayReviews(userId) {
  if (!supabase || !userId) return []
  try {
    const { data, error } = await supabase
      .from('friday_reviews')
      .select('*')
      .eq('user_id', userId)
      .order('week_start', { ascending: false })
    if (error) { console.error('[loadFridayReviews]', error.message); return [] }
    return data ?? []
  } catch (err) {
    console.error('[loadFridayReviews]', err.message)
    return []
  }
}


// ─── User Preferences ─────────────────────────────────────────────────────────

export async function loadUserPreferences(userId) {
  if (!supabase || !userId) return null
  try {
    const { data, error } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()
    if (error) { console.error('[loadUserPreferences]', error.message); return null }
    return data ?? null
  } catch (err) {
    console.error('[loadUserPreferences]', err.message)
    return null
  }
}

// ─── Weekly Plans (Phase 2: will be removed when WeekPlanner is replaced) ─────

export async function upsertWeeklyPlan(plan, weekStartDate, userId) {
  if (!supabase || !userId) return null
  try {
    const row = {
      user_id:         userId,
      week_start_date: weekStartDate,
      plan_data:       plan,
      status:          plan.status ?? 'draft',
      updated_at:      new Date().toISOString(),
      ...(plan.status === 'published' || plan.status === 'replanned'
        ? { published_at: new Date().toISOString() }
        : {}),
    }
    const { data, error } = await supabase
      .from('weekly_plans')
      .upsert(row, { onConflict: 'user_id,week_start_date' })
      .select('id')
      .single()
    if (error) { console.error('[upsertWeeklyPlan]', error.message); return null }
    return data?.id ?? null
  } catch (err) {
    console.error('[upsertWeeklyPlan]', err.message)
    return null
  }
}

export async function loadCurrentWeekPlan(weekStartDate, userId) {
  if (!supabase || !userId || !weekStartDate) return null
  try {
    const { data, error } = await supabase
      .from('weekly_plans')
      .select('*')
      .eq('user_id', userId)
      .eq('week_start_date', weekStartDate)
      .maybeSingle()
    if (error) { console.error('[loadCurrentWeekPlan]', error.message); return null }
    if (!data) return null
    return { ...data.plan_data, id: data.id, status: data.status }
  } catch (err) {
    console.error('[loadCurrentWeekPlan]', err.message)
    return null
  }
}

export async function updatePlanAfterPublish(planId, updatedPlanData, userId) {
  if (!supabase || !userId || !planId) return
  try {
    const { error } = await supabase
      .from('weekly_plans')
      .update({
        plan_data:    updatedPlanData,
        status:       updatedPlanData.status,
        published_at: new Date().toISOString(),
        updated_at:   new Date().toISOString(),
      })
      .eq('id', planId)
      .eq('user_id', userId)
    if (error) console.error('[updatePlanAfterPublish]', error.message)
  } catch (err) {
    console.error('[updatePlanAfterPublish]', err.message)
  }
}

// ─── Quick Log Entries ────────────────────────────────────────────────────────

export async function upsertQuickLogEntry(entry, userId) {
  if (!supabase || !userId) return null
  try {
    const { data, error } = await supabase
      .from('quick_log_entries')
      .insert({
        user_id:          userId,
        who:              entry.who,
        activity_type:    entry.activityType,
        duration_minutes: entry.durationMinutes,
        kpi_credits:      entry.kpiCredits,
        note:             entry.note ?? null,
        logged_at:        new Date().toISOString(),
      })
      .select('id')
      .single()
    if (error) { console.error('[upsertQuickLogEntry]', error.message); return null }
    return data?.id ?? null
  } catch (err) {
    console.error('[upsertQuickLogEntry]', err.message)
    return null
  }
}

export async function loadQuickLogEntries(weekStart, weekEnd, userId) {
  if (!supabase || !userId) return []
  try {
    const { data, error } = await supabase
      .from('quick_log_entries')
      .select('*')
      .eq('user_id', userId)
      .gte('logged_at', weekStart)
      .lte('logged_at', weekEnd)
      .order('logged_at', { ascending: false })
    if (error) { console.error('[loadQuickLogEntries]', error.message); return [] }
    return data ?? []
  } catch (err) {
    console.error('[loadQuickLogEntries]', err.message)
    return []
  }
}

export async function upsertUserPreferences(prefs, userId) {
  if (!supabase || !userId) return
  try {
    const { error } = await supabase
      .from('user_preferences')
      .upsert(
        { user_id: userId, ...prefs, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' },
      )
    if (error) console.error('[upsertUserPreferences]', error.message)
  } catch (err) {
    console.error('[upsertUserPreferences]', err.message)
  }
}


// ─── Calendar Event Tags ──────────────────────────────────────────────────────
// Persist user-assigned Track / Sub-track for personal Google Calendar events.

/**
 * Load all saved calendar event tags for a user.
 * Returns { [gcalEventId]: { track, subTrack, title, durationMin, date, kpiCredits?, kpiQuantities? } }
 */
export async function loadCalendarEventTags(userId) {
  if (!supabase || !userId) return {}
  try {
    const { data, error } = await supabase
      .from('calendar_event_tags')
      .select('*')
      .eq('user_id', userId)
    if (error) { console.error('[loadCalendarEventTags]', error.message); return {} }
    return Object.fromEntries(
      (data ?? []).map((row) => [
        row.gcal_event_id,
        {
          track:       row.track,
          subTrack:    row.sub_track ?? null,
          title:       row.event_title ?? '',
          durationMin: row.duration_min ?? 0,
          date:        row.event_date ?? null,
          kpiCredits:  Array.isArray(row.kpi_credits) ? row.kpi_credits : [],
          kpiQuantities:
            row.kpi_quantities && typeof row.kpi_quantities === 'object' && !Array.isArray(row.kpi_quantities)
              ? row.kpi_quantities
              : {},
        },
      ]),
    )
  } catch (err) {
    console.error('[loadCalendarEventTags]', err.message)
    return {}
  }
}

/**
 * Create or update a calendar event tag (upsert on user_id + gcal_event_id).
 */
export async function upsertCalendarEventTag(userId, gcalEventId, {
  track,
  subTrack,
  title,
  durationMin,
  date,
  kpiCredits = [],
  kpiQuantities = {},
}) {
  if (!supabase || !userId || !gcalEventId) return
  const credits = Array.isArray(kpiCredits) ? kpiCredits : []
  const quantities = kpiQuantities && typeof kpiQuantities === 'object' && !Array.isArray(kpiQuantities)
    ? kpiQuantities
    : {}
  try {
    const { error } = await supabase
      .from('calendar_event_tags')
      .upsert(
        {
          user_id:       userId,
          gcal_event_id: gcalEventId,
          track,
          sub_track:     subTrack ?? null,
          event_title:   title ?? null,
          duration_min:  durationMin ?? null,
          event_date:    date ?? null,
          kpi_credits:   credits,
          kpi_quantities: quantities,
          updated_at:    new Date().toISOString(),
        },
        { onConflict: 'user_id,gcal_event_id' },
      )
    if (error) console.error('[upsertCalendarEventTag]', error.message)
  } catch (err) {
    console.error('[upsertCalendarEventTag]', err.message)
  }
}
