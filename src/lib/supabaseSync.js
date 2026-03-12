import { supabase } from './supabaseClient'

// ─── Task Templates ───────────────────────────────────────────────────────────

function taskToRow(task, userId) {
  return {
    id: task.id,
    user_id: userId,
    name: task.name ?? '',
    track: task.track ?? 'advisors',
    time_block: task.timeBlock ?? 'BD',
    default_estimate_minutes: task.defaultTimeEstimate ?? 25,
    completion_type: task.completionType ?? 'Done',
    status: task.status ?? 'Active',
    requires_definition_of_done: Boolean(task.requiresDefinitionOfDone),
    frequency: task.frequency ?? 'Weekly',
    kpi_mapping: task.kpiMapping ?? '',
    subtasks: Array.isArray(task.subtasks)
      ? task.subtasks.join('\n')
      : (task.subtasks ?? ''),
    outcome_prompt: task.outcomePrompt ?? '',
    updated_at: new Date().toISOString(),
  }
}

function rowToTask(row) {
  return {
    id: row.id,
    name: row.name,
    track: row.track,
    timeBlock: row.time_block,
    defaultTimeEstimate: row.default_estimate_minutes,
    completionType: row.completion_type,
    status: row.status,
    requiresDefinitionOfDone: row.requires_definition_of_done,
    frequency: row.frequency,
    kpiMapping: row.kpi_mapping,
    subtasks: row.subtasks ?? '',
    outcomePrompt: row.outcome_prompt ?? '',
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
    time_block_snapshot: task.timeBlock ?? 'BD',
    estimate_minutes_snapshot: task.estimateMinutes ?? 25,
    completion_type_snapshot: task.completionType ?? 'Done',
    frequency_snapshot: task.frequency ?? 'Weekly',
    kpi_mapping_snapshot: task.kpiMapping ?? '',
    subtasks_snapshot: Array.isArray(task.subtasks)
      ? task.subtasks.join('\n')
      : (task.subtasks ?? ''),
    outcome_prompt_snapshot: task.outcomePrompt ?? '',
    template_id_snapshot: task.templateId ?? null,
    requires_definition_of_done: Boolean(task.requiresDefinitionOfDone),
    calendar_event_id: task.calendarEventId ?? null,
  }
}

function rowToTodayTask(row) {
  return {
    id: row.id,
    templateId: row.template_id_snapshot,
    name: row.name_snapshot,
    track: row.track_snapshot,
    timeBlock: row.time_block_snapshot,
    estimateMinutes: row.estimate_minutes_snapshot,
    completionType: row.completion_type_snapshot,
    frequency: row.frequency_snapshot,
    kpiMapping: row.kpi_mapping_snapshot,
    subtasks: row.subtasks_snapshot
      ? row.subtasks_snapshot.split('\n').map((s) => s.trim()).filter(Boolean)
      : [],
    outcomePrompt: row.outcome_prompt_snapshot ?? '',
    requiresDefinitionOfDone: Boolean(row.requires_definition_of_done),
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
    kpi_mapping: task.kpiMapping ?? '',
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

function rowToLogEntry(row) {
  return {
    id: row.id,
    taskName: row.task_name,
    track: row.track,
    kpiMapping: row.kpi_mapping,
    completionType: row.completion_type,
    outcomeAchieved: row.outcome_achieved,
    definitionOfDoneUsed: Boolean(row.definition_of_done?.trim()),
    completedAt: row.completed_at ?? row.updated_at,
    estimateSeconds: row.estimate_seconds,
    elapsedSeconds: row.elapsed_seconds,
    pauseCount: row.pause_count,
    pauseDurationSeconds: row.pause_duration_seconds,
    cancelledSeconds: row.cancelled_seconds,
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

// ─── Reschedule Queue ─────────────────────────────────────────────────────────

function queueItemToRow(item, userId) {
  return {
    id: item.id,
    user_id: userId,
    task_name: item.taskName ?? item.task_name ?? '',
    track: item.track ?? 'advisors',
    time_block: item.timeBlock ?? item.time_block ?? 'BD',
    reason: item.reason ?? 'cancelled',
    remaining_minutes: item.remainingMinutes ?? null,
    status: item.status ?? 'pending',
    suggested_date: item.suggestedDate ?? null,
    suggested_time_block: item.suggestedTimeBlock ?? null,
  }
}

function rowToQueueItem(row) {
  return {
    id: row.id,
    taskName: row.task_name,
    track: row.track,
    timeBlock: row.time_block,
    reason: row.reason,
    remainingMinutes: row.remaining_minutes,
    status: row.status,
    suggestedDate: row.suggested_date,
    suggestedTimeBlock: row.suggested_time_block,
  }
}

export async function syncRescheduleQueue(items, userId) {
  if (!supabase || !userId || !items.length) return
  try {
    const rows = items.map((item) => queueItemToRow(item, userId))
    const { error } = await supabase
      .from('reschedule_queue')
      .upsert(rows, { onConflict: 'id' })
    if (error) console.error('[syncRescheduleQueue]', error.message)
  } catch (err) {
    console.error('[syncRescheduleQueue]', err.message)
  }
}

export async function loadRescheduleQueue(userId) {
  if (!supabase || !userId) return null
  try {
    const { data, error } = await supabase
      .from('reschedule_queue')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    if (error) { console.error('[loadRescheduleQueue]', error.message); return null }
    return (data ?? []).map(rowToQueueItem)
  } catch (err) {
    console.error('[loadRescheduleQueue]', err.message)
    return null
  }
}

export async function updateRescheduleItem(id, status, userId) {
  if (!supabase || !userId) return
  try {
    const update = {
      status,
      ...(status === 'confirmed' ? { confirmed_at: new Date().toISOString() } : {}),
      ...(status === 'dismissed' ? { dismissed_at: new Date().toISOString() } : {}),
    }
    const { error } = await supabase
      .from('reschedule_queue')
      .update(update)
      .eq('id', id)
      .eq('user_id', userId)
    if (error) console.error('[updateRescheduleItem]', error.message)
  } catch (err) {
    console.error('[updateRescheduleItem]', err.message)
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
