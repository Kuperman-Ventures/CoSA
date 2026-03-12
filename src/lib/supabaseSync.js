import { supabase } from './supabaseClient'

// ─── Completion Log ───────────────────────────────────────────────────────────

export function logEntryToRow(entry, userId) {
  return {
    id: entry.id,
    user_id: userId,
    task_name: entry.taskName ?? '',
    track: entry.track ?? '',
    kpi_mapping: entry.kpiMapping ?? '',
    completion_type: entry.completionType ?? 'Done',
    outcome_achieved: entry.outcomeAchieved ?? null,
    definition_of_done_used: Boolean(entry.definitionOfDoneUsed),
    completed_at: entry.completedAt,
    estimate_seconds: entry.estimateSeconds ?? 0,
    elapsed_seconds: entry.elapsedSeconds ?? 0,
    pause_count: entry.pauseCount ?? 0,
    pause_duration_seconds: entry.pauseDurationSeconds ?? 0,
    cancelled_seconds: entry.cancelledSeconds ?? 0,
  }
}

export function rowToLogEntry(row) {
  return {
    id: row.id,
    taskName: row.task_name,
    track: row.track,
    kpiMapping: row.kpi_mapping,
    completionType: row.completion_type,
    outcomeAchieved: row.outcome_achieved,
    definitionOfDoneUsed: row.definition_of_done_used,
    completedAt: row.completed_at,
    estimateSeconds: row.estimate_seconds,
    elapsedSeconds: row.elapsed_seconds,
    pauseCount: row.pause_count,
    pauseDurationSeconds: row.pause_duration_seconds,
    cancelledSeconds: row.cancelled_seconds,
  }
}

export async function syncLogEntries(entries, userId) {
  if (!supabase || !userId || entries.length === 0) return
  const rows = entries.map((e) => logEntryToRow(e, userId))
  await supabase.from('completion_log').upsert(rows, { onConflict: 'id' })
}

export async function loadCompletionLog(userId) {
  if (!supabase || !userId) return []
  const { data, error } = await supabase
    .from('completion_log')
    .select('*')
    .eq('user_id', userId)
    .order('completed_at', { ascending: true })
  if (error) return []
  return (data ?? []).map(rowToLogEntry)
}

// ─── Task Library ─────────────────────────────────────────────────────────────

export async function saveTaskLibrary(library, userId) {
  if (!supabase || !userId) return
  await supabase.from('task_library').upsert({
    user_id: userId,
    library,
    updated_at: new Date().toISOString(),
  })
}

export async function loadTaskLibrary(userId) {
  if (!supabase || !userId) return null
  const { data, error } = await supabase
    .from('task_library')
    .select('library')
    .eq('user_id', userId)
    .single()
  if (error || !data) return null
  return Array.isArray(data.library) ? data.library : null
}

// ─── Friday Reviews ───────────────────────────────────────────────────────────

export async function saveFridayReview(review, userId) {
  if (!supabase || !userId) return
  await supabase.from('friday_reviews').upsert(
    { ...review, user_id: userId, updated_at: new Date().toISOString() },
    { onConflict: 'user_id,week_start' },
  )
}

export async function loadFridayReviews(userId) {
  if (!supabase || !userId) return []
  const { data, error } = await supabase
    .from('friday_reviews')
    .select('*')
    .eq('user_id', userId)
    .order('week_start', { ascending: false })
    .limit(12)
  if (error) return []
  return data ?? []
}
