import { useEffect, useMemo, useRef, useState } from 'react'
import WeekPlanner from './components/WeekPlanner'
import { Pause, Play, SquareCheck, StopCircle, GripVertical, AlertTriangle, Clock, Settings, ChevronDown, ChevronRight } from 'lucide-react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { isSupabaseConfigured, supabase } from './lib/supabaseClient'
import {
  upsertTaskTemplates,
  loadTaskTemplates,
  upsertTodayTasks,
  replaceTodayTasks,
  loadTodayTasks,
  upsertTimerSession,
  loadTimerSessions,
  loadTodayTimerSessions,
  upsertFridayReview,
  loadFridayReviews,
  loadUserPreferences,
  upsertUserPreferences,
  upsertQuickLogEntry,
  loadQuickLogEntries,
} from './lib/supabaseSync'
import { createEventsForSnapshot, fetchCoSACalendarEvents } from './lib/googleCalendar'

const TRACKS = {
  advisors: {
    key: 'advisors',
    label: 'Kuperman Advisors',
    color: '#1E6B3C',
    priority: 1,
  },
  networking: {
    key: 'networking',
    label: 'Shared (Networking)',
    color: '#B8600B',
    priority: 1.5,
  },
  jobSearch: {
    key: 'jobSearch',
    label: 'Job Search',
    color: '#2E75B6',
    priority: 2,
  },
  ventures: {
    key: 'ventures',
    label: 'Kuperman Ventures',
    color: '#9B6BAE',
    priority: 3,
  },
  cosaAdmin: {
    key: 'cosaAdmin',
    label: 'CoSA Administration',
    color: '#0891b2',
    priority: 4,
  },
}

const TIMER_STATES = {
  notStarted: 'Not Started',
  running: 'Running',
  paused: 'Paused',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

const LIBRARY_STATUSES = ['Active', 'Paused', 'Archived']
const TIME_BLOCK_ORDER = ['BD', 'Networking', 'Job Search', 'Encore OS', 'Friday']
const ALL_WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
// Sub-tracks per track — kept in sync with WeekPlanner SUB_TRACK_TARGETS
const TRACK_SUB_TRACKS = {
  advisors:  ['Business Development', 'Materials', 'Content', 'Meetings'],
  jobSearch: ['Networking', 'Searching', 'Applications', 'L&D', 'Boards', 'Admin', 'Other'],
  ventures:  ['Alpha', 'Growth', 'Product', 'Research', 'Subscription', 'Build'],
  cosaAdmin: ['Friday Review'],
}
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const INITIAL_TASK_LIBRARY = [
  // ─── KUPERMAN ADVISORS — BD Block ─────────────────────────────────────────
  {
    id: 'lib-v2-advisors-1',
    name: 'ICP Research',
    track: TRACKS.advisors.key,
    subTrack: 'Business Development',
    defaultTimeEstimate: 30,
    kpiMapping: 'Outreach messages sent',
    status: 'Active',
  },
  {
    id: 'lib-v2-advisors-2',
    name: 'ICP Contact Research',
    track: TRACKS.advisors.key,
    subTrack: 'Business Development',
    defaultTimeEstimate: 25,
    kpiMapping: 'Outreach messages sent',
    status: 'Active',
  },
  {
    id: 'lib-v2-advisors-3',
    name: 'Deep Research',
    track: TRACKS.advisors.key,
    subTrack: 'Business Development',
    defaultTimeEstimate: 45,
    kpiMapping: 'Companies researched',
    status: 'Active',
  },
  {
    id: 'lib-v2-advisors-4',
    name: 'Outreach Emails',
    track: TRACKS.advisors.key,
    subTrack: 'Business Development',
    defaultTimeEstimate: 30,
    kpiMapping: 'Outreach messages sent',
    status: 'Active',
  },
  {
    id: 'lib-v2-advisors-5',
    name: 'Apollo Sequences',
    track: TRACKS.advisors.key,
    subTrack: 'Business Development',
    defaultTimeEstimate: 30,
    kpiMapping: 'Outreach messages sent',
    status: 'Active',
  },
  {
    id: 'lib-v2-advisors-6',
    name: 'Materials Refinement',
    track: TRACKS.advisors.key,
    subTrack: 'Materials',
    defaultTimeEstimate: 45,
    kpiMapping: 'Case study progress',
    status: 'Active',
  },
  {
    id: 'lib-v2-advisors-7',
    name: 'LinkedIn Content',
    track: TRACKS.advisors.key,
    subTrack: 'Content',
    defaultTimeEstimate: 45,
    kpiMapping: 'LinkedIn comments posted',
    status: 'Active',
  },
  {
    id: 'lib-v2-advisors-8',
    name: 'Connective Meeting Prep',
    track: TRACKS.advisors.key,
    subTrack: 'Meetings',
    defaultTimeEstimate: 20,
    kpiMapping: 'Connective attendance',
    status: 'Active',
  },
  {
    id: 'lib-v2-advisors-9',
    name: 'Discovery Call',
    track: TRACKS.advisors.key,
    subTrack: 'Meetings',
    defaultTimeEstimate: 60,
    kpiMapping: 'Discovery calls held',
    status: 'Active',
  },
  {
    id: 'lib-v2-advisors-10',
    name: 'Follow-Up Review',
    track: TRACKS.advisors.key,
    subTrack: 'Business Development',
    defaultTimeEstimate: 20,
    kpiMapping: 'Outreach messages sent',
    status: 'Active',
  },
  {
    id: 'lib-v2-advisors-11',
    name: 'Proposals',
    track: TRACKS.advisors.key,
    subTrack: 'Business Development',
    defaultTimeEstimate: 60,
    kpiMapping: 'Discovery calls held',
    status: 'Paused',
  },
  {
    id: 'lib-v2-advisors-12',
    name: 'Agreements',
    track: TRACKS.advisors.key,
    subTrack: 'Business Development',
    defaultTimeEstimate: 45,
    kpiMapping: 'Discovery calls held',
    status: 'Paused',
  },
  {
    id: 'lib-v2-advisors-13',
    name: 'Follow Up on Responses',
    track: TRACKS.advisors.key,
    subTrack: 'Business Development',
    defaultTimeEstimate: 25,
    kpiMapping: 'Outreach messages sent',
    status: 'Active',
  },
  // ─── JOB SEARCH — Job Search Block ───────────────────────────────────────
  {
    id: 'lib-v2-jobsearch-1',
    name: 'Network Follow-Ups',
    track: TRACKS.jobSearch.key,
    subTrack: 'Networking',
    defaultTimeEstimate: 20,
    kpiMapping: 'Recruiter touchpoints',
    status: 'Active',
  },
  {
    id: 'lib-v2-jobsearch-2',
    name: 'Warm Reconnect Outreach',
    track: TRACKS.jobSearch.key,
    subTrack: 'Networking',
    defaultTimeEstimate: 15,
    kpiMapping: 'Warm reconnects sent',
    status: 'Active',
  },
  {
    id: 'lib-v2-jobsearch-3',
    name: 'Cold Outreach',
    track: TRACKS.jobSearch.key,
    subTrack: 'Networking',
    defaultTimeEstimate: 25,
    kpiMapping: 'Outreach messages sent',
    status: 'Active',
  },
  {
    id: 'lib-v2-jobsearch-4',
    name: 'Industry Reading & L&D',
    track: TRACKS.jobSearch.key,
    subTrack: 'L&D',
    defaultTimeEstimate: 30,
    kpiMapping: 'Completion Rate',
    status: 'Active',
  },
  {
    id: 'lib-v2-jobsearch-5',
    name: 'Target Company List Review',
    track: TRACKS.jobSearch.key,
    subTrack: 'Searching',
    defaultTimeEstimate: 30,
    kpiMapping: 'Companies researched',
    status: 'Active',
  },
  {
    id: 'lib-v2-jobsearch-6',
    name: 'Job Listing Review',
    track: TRACKS.jobSearch.key,
    subTrack: 'Searching',
    defaultTimeEstimate: 30,
    kpiMapping: 'Applications submitted',
    status: 'Active',
  },
  {
    id: 'lib-v2-jobsearch-7',
    name: 'Tailored Application',
    track: TRACKS.jobSearch.key,
    subTrack: 'Applications',
    defaultTimeEstimate: 60,
    kpiMapping: 'Applications submitted',
    status: 'Active',
  },
  {
    id: 'lib-v2-jobsearch-8',
    name: 'Update EncoreOS Tracker',
    track: TRACKS.jobSearch.key,
    subTrack: 'Admin',
    defaultTimeEstimate: 15,
    kpiMapping: 'Completion Rate',
    status: 'Active',
  },
  {
    id: 'lib-v2-jobsearch-9',
    name: 'Networking Meeting or Event',
    track: TRACKS.jobSearch.key,
    subTrack: 'Networking',
    defaultTimeEstimate: 60,
    kpiMapping: 'Coffee chats held',
    status: 'Active',
  },
  {
    id: 'lib-v2-jobsearch-10',
    name: 'Resume Customisation',
    track: TRACKS.jobSearch.key,
    subTrack: 'Applications',
    defaultTimeEstimate: 45,
    kpiMapping: 'Applications submitted',
    status: 'Active',
  },
  {
    id: 'lib-v2-jobsearch-11',
    name: 'Board Research',
    track: TRACKS.jobSearch.key,
    subTrack: 'Boards',
    defaultTimeEstimate: 30,
    kpiMapping: 'Companies researched',
    status: 'Active',
  },
  // ─── KUPERMAN VENTURES — Encore OS Block ─────────────────────────────────
  {
    id: 'lib-v2-ventures-1',
    name: 'Alpha Tester Outreach',
    track: TRACKS.ventures.key,
    subTrack: 'Alpha',
    defaultTimeEstimate: 30,
    kpiMapping: 'Tester touchpoints',
    status: 'Active',
  },
  {
    id: 'lib-v2-ventures-2',
    name: 'Alpha Growth Outreach',
    track: TRACKS.ventures.key,
    subTrack: 'Growth',
    defaultTimeEstimate: 25,
    kpiMapping: 'Tester touchpoints',
    status: 'Active',
  },
  {
    id: 'lib-v2-ventures-3',
    name: 'Roadmap Review',
    track: TRACKS.ventures.key,
    subTrack: 'Product',
    defaultTimeEstimate: 30,
    kpiMapping: 'Things shipped',
    status: 'Active',
  },
  {
    id: 'lib-v2-ventures-4',
    name: 'Feature Research',
    track: TRACKS.ventures.key,
    subTrack: 'Research',
    defaultTimeEstimate: 25,
    kpiMapping: 'Things shipped',
    status: 'Active',
  },
  {
    id: 'lib-v2-ventures-5',
    name: 'Subscription Research',
    track: TRACKS.ventures.key,
    subTrack: 'Subscription',
    defaultTimeEstimate: 25,
    kpiMapping: 'Things shipped',
    status: 'Active',
  },
  {
    id: 'lib-v2-ventures-6',
    name: 'Cursor Build Session',
    track: TRACKS.ventures.key,
    subTrack: 'Build',
    defaultTimeEstimate: 90,
    kpiMapping: 'Things shipped',
    status: 'Active',
  },
  {
    id: 'lib-v2-ventures-7',
    name: 'New User Targeting',
    track: TRACKS.ventures.key,
    subTrack: 'Growth',
    defaultTimeEstimate: 30,
    kpiMapping: 'Tester touchpoints',
    status: 'Active',
  },
  // ─── MARC WHITMAN — Temporary Tasks ──────────────────────────────────────
  {
    id: 'lib-ventures-marc-prep-20260315',
    name: 'Marc Whitman — Meeting Prep',
    track: TRACKS.ventures.key,
    subTrack: 'Growth',
    defaultTimeEstimate: 30,
    kpiMapping: 'Tester touchpoints',
    status: 'Active',
  },
  {
    id: 'lib-ventures-marc-debrief-20260315',
    name: 'Marc Whitman — Debrief',
    track: TRACKS.ventures.key,
    subTrack: 'Growth',
    defaultTimeEstimate: 20,
    kpiMapping: 'Tester touchpoints',
    status: 'Active',
  },
  // ─── FRIDAY REVIEW Block ──────────────────────────────────────────────────
  {
    id: 'lib-friday-1',
    name: 'Score the Week',
    track: TRACKS.advisors.key,
    defaultTimeEstimate: 20,
    kpiMapping: 'Completion Rate',
    status: 'Active',
  },
  {
    id: 'lib-friday-2',
    name: 'Three Questions',
    track: TRACKS.advisors.key,
    defaultTimeEstimate: 15,
    kpiMapping: 'Completion Rate',
    status: 'Active',
  },
  {
    id: 'lib-friday-3',
    name: 'Plan Next Week',
    track: TRACKS.advisors.key,
    defaultTimeEstimate: 20,
    kpiMapping: 'Completion Rate',
    status: 'Active',
  },
  {
    id: 'lib-friday-4',
    name: 'Clean Up',
    track: TRACKS.advisors.key,
    defaultTimeEstimate: 5,
    kpiMapping: 'Completion Rate',
    status: 'Active',
  },
]

const NAV_ITEMS = [
  { id: 'today', label: 'Today' },
  { id: 'taskLibrary', label: 'Task Library' },
  { id: 'weekPlanner', label: 'Calendar' },
  { id: 'kpi', label: 'Weekly Review' },
  { id: 'settings', label: 'Settings' },
]
const STORAGE_KEY = 'cosa.phase1_phase2.local_state.v5'
const COMPLETION_LOG_KEY = 'cosa.completion_log.v1'

const KPI_DEFINITIONS = [
  // ─── Kuperman Advisors ────────────────────────────────────────────────────
  { id: 'outreach-messages',  label: 'Outreach messages sent',   target: 6, period: 'week',  kpiMapping: 'Outreach messages sent',  trackGroup: 'Kuperman Advisors',    color: '#1E6B3C' },
  { id: 'discovery-held',     label: 'Discovery calls held',      target: 1, period: 'week',  kpiMapping: 'Discovery calls held',    trackGroup: 'Kuperman Advisors',    color: '#1E6B3C' },
  { id: 'discovery-booked',   label: 'Discovery calls booked',    target: 2, period: 'week',  kpiMapping: 'Discovery calls booked',  trackGroup: 'Kuperman Advisors',    color: '#1E6B3C' },
  { id: 'connective',         label: 'Connective attendance',     target: 1, period: 'week',  kpiMapping: 'Connective attendance',   trackGroup: 'Kuperman Advisors',    color: '#1E6B3C' },
  { id: 'case-study',         label: 'Case study progress',       target: 1, period: 'month', kpiMapping: 'Case study progress',     trackGroup: 'Kuperman Advisors',    color: '#1E6B3C' },
  // ─── Shared (Networking) ─────────────────────────────────────────────────
  { id: 'warm-reconnects',    label: 'Warm reconnects sent',      target: 3, period: 'week',  kpiMapping: 'Warm reconnects sent',    trackGroup: 'Shared (Networking)',  color: '#2E75B6' },
  { id: 'coffee-chats',       label: 'Coffee chats held',         target: 1, period: 'week',  kpiMapping: 'Coffee chats held',       trackGroup: 'Shared (Networking)',  color: '#2E75B6' },
  { id: 'linkedin-comments',  label: 'LinkedIn comments posted',  target: 5, period: 'week',  kpiMapping: 'LinkedIn comments posted',trackGroup: 'Shared (Networking)',  color: '#2E75B6' },
  // ─── Job Search ──────────────────────────────────────────────────────────
  { id: 'companies-researched',label:'Companies researched',      target: 2, period: 'week',  kpiMapping: 'Companies researched',    trackGroup: 'Job Search',           color: '#2E75B6' },
  { id: 'applications',       label: 'Applications submitted',    target: 2, period: 'week',  kpiMapping: 'Applications submitted',  trackGroup: 'Job Search',           color: '#2E75B6' },
  { id: 'recruiter-touchpoints',label:'Recruiter touchpoints',    target: 3, period: 'week',  kpiMapping: 'Recruiter touchpoints',   trackGroup: 'Job Search',           color: '#2E75B6' },
  // ─── Kuperman Ventures ───────────────────────────────────────────────────
  { id: 'tester-touchpoints', label: 'Tester touchpoints',        target: 2, period: 'week',  kpiMapping: 'Tester touchpoints',      trackGroup: 'Kuperman Ventures',    color: '#9B6BAE' },
  { id: 'definition-used',    label: 'Definition of done used',   target: null,period:'week', kpiMapping: 'Definition of done used', trackGroup: 'Kuperman Ventures',    color: '#9B6BAE', isRate: true },
  { id: 'things-shipped',     label: 'Things shipped',            target: 1, period: 'week',  kpiMapping: 'Things shipped',          trackGroup: 'Kuperman Ventures',    color: '#9B6BAE' },
]

const KPI_TRACK_GROUPS = ['Kuperman Advisors', 'Shared (Networking)', 'Job Search', 'Kuperman Ventures']

// Quick Log: KPI options grouped by track, with the track key used for timer_sessions
const QUICK_LOG_KPI_GROUPS = [
  {
    group: 'Kuperman Advisors',
    track: 'advisors',
    color: '#1E6B3C',
    dot: 'bg-emerald-700',
    kpis: [
      'Outreach messages sent',
      'Discovery calls booked',
      'Discovery calls held',
      'Connective attendance',
      'Case study progress',
    ],
  },
  {
    group: 'Shared Networking',
    track: 'networking',
    color: '#C2762A',
    dot: 'bg-orange-500',
    kpis: [
      'Warm reconnects sent',
      'Coffee chats held',
      'LinkedIn comments posted',
    ],
  },
  {
    group: 'Job Search',
    track: 'jobsearch',
    color: '#2E75B6',
    dot: 'bg-blue-600',
    kpis: [
      'Companies researched',
      'Applications submitted',
      'Recruiter touchpoints',
    ],
  },
  {
    group: 'Kuperman Ventures',
    track: 'ventures',
    color: '#9B6BAE',
    dot: 'bg-purple-500',
    kpis: [
      'Tester touchpoints',
      'Things shipped',
      'Definition of done used',
    ],
  },
]

// Map a KPI label → its track key (for creating timer_sessions)
const KPI_LABEL_TO_TRACK = {}
for (const g of QUICK_LOG_KPI_GROUPS) {
  for (const kpi of g.kpis) KPI_LABEL_TO_TRACK[kpi] = g.track
}

const QUICK_LOG_LOCAL_KEY = 'cosa_quick_logs_v1'

function loadCompletionLog() {
  if (typeof window === 'undefined') return []
  const raw = window.localStorage.getItem(COMPLETION_LOG_KEY)
  const parsed = safeParseJSON(raw)
  return Array.isArray(parsed) ? parsed : []
}

function saveCompletionLog(log) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(COMPLETION_LOG_KEY, JSON.stringify(log))
}

// ─── Weekly Planner helpers ───────────────────────────────────────────────────

function getWeekStartDateStr(date = new Date()) {
  const d = new Date(date)
  const day = d.getDay()
  const daysToMonday = day === 0 ? 6 : day - 1
  d.setDate(d.getDate() - daysToMonday)
  d.setHours(0, 0, 0, 0)
  return d.toISOString().split('T')[0]
}

function getNextMondayStr(fromDate = new Date()) {
  const d = new Date(fromDate)
  const day = d.getDay()
  const daysUntil = day === 0 ? 1 : day === 1 ? 7 : 8 - day
  d.setDate(d.getDate() + daysUntil)
  d.setHours(0, 0, 0, 0)
  return d.toISOString().split('T')[0]
}

function getDayDate(weekStartDateStr, dayName) {
  const offsets = { Monday: 0, Tuesday: 1, Wednesday: 2, Thursday: 3, Friday: 4 }
  const d = new Date(weekStartDateStr + 'T12:00:00')
  d.setDate(d.getDate() + (offsets[dayName] ?? 0))
  return d.toISOString().split('T')[0]
}

// ─────────────────────────────────────────────────────────────────────────────

function getWeekBounds(offsetWeeks = 0) {
  const now = new Date()
  const dayOfWeek = now.getDay()
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  const monday = new Date(now)
  monday.setDate(now.getDate() - daysToMonday + offsetWeeks * 7)
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)
  return { start: monday, end: sunday }
}

function getMonthBoundsForWeek(offsetWeeks = 0) {
  const { start } = getWeekBounds(offsetWeeks)
  const monthStart = new Date(start.getFullYear(), start.getMonth(), 1, 0, 0, 0, 0)
  const monthEnd = new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59, 999)
  return { start: monthStart, end: monthEnd }
}

function countKpi(log, kpiDef, weekStart, weekEnd, monthStart, monthEnd) {
  const rangeStart = kpiDef.period === 'month' ? monthStart : weekStart
  const rangeEnd = kpiDef.period === 'month' ? monthEnd : weekEnd

  if (kpiDef.isRate) {
    const allVentures = log.filter((e) => {
      const d = new Date(e.completedAt)
      return d >= rangeStart && d <= rangeEnd && e.track === 'ventures' &&
        (e.completionType === 'Done' || e.completionType === 'Done + Outcome')
    })
    const dodUsed = allVentures.filter((e) => e.definitionOfDoneUsed)
    return { count: dodUsed.length, total: allVentures.length }
  }

  const count = log.filter((e) => {
    const d = new Date(e.completedAt)
    if (d < rangeStart || d > rangeEnd) return false
    if (e.kpiMapping !== kpiDef.kpiMapping) return false
    if (e.completionType === 'Partial' || e.completionType === 'Cancelled') return false
    return true
  }).length

  return { count, total: null }
}

function isKpiHit(count, total, kpiDef) {
  if (kpiDef.isRate) return total > 0 && count === total
  if (!kpiDef.target) return count > 0
  return count >= kpiDef.target
}

function formatWeekLabel(weekStart, weekEnd) {
  const opts = { month: 'short', day: 'numeric' }
  return `${weekStart.toLocaleDateString('en-US', opts)} – ${weekEnd.toLocaleDateString('en-US', { ...opts, year: 'numeric' })}`
}

function calcMetrics(log, weekStart, weekEnd, trackFilter = null) {
  const entries = log.filter((e) => {
    const d = new Date(e.completedAt)
    if (d < weekStart || d > weekEnd) return false
    if (trackFilter && e.track !== trackFilter) return false
    return true
  })

  const completed = entries.filter(
    (e) => e.completionType === 'Done' || e.completionType === 'Done + Outcome',
  )

  const timeSavedSeconds = completed.reduce(
    (sum, e) => sum + Math.max(0, e.estimateSeconds - e.elapsedSeconds),
    0,
  )
  const overrunSeconds = completed.reduce(
    (sum, e) => sum + Math.max(0, e.elapsedSeconds - e.estimateSeconds),
    0,
  )
  const pauseCount = entries.reduce((sum, e) => sum + (e.pauseCount ?? 0), 0)
  const pauseDurationSeconds = entries.reduce((sum, e) => sum + (e.pauseDurationSeconds ?? 0), 0)
  const cancelledSeconds = entries
    .filter((e) => e.completionType === 'Cancelled')
    .reduce((sum, e) => sum + (e.cancelledSeconds ?? 0), 0)
  const total = entries.length
  const completedCount = completed.length
  const completionRate = total > 0 ? Math.round((completedCount / total) * 100) : null

  return { timeSavedSeconds, overrunSeconds, pauseCount, pauseDurationSeconds, cancelledSeconds, completionRate, completedCount, total }
}

function getTomorrowDateString() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

function getTodayDateString() {
  return new Date().toISOString().slice(0, 10)
}

// Returns the logical "target" date for a deploy: today if it's a weekday, next Monday if weekend.
function getDeployTargetDate() {
  const d = new Date()
  const day = d.getDay()
  if (day === 0) d.setDate(d.getDate() + 1)       // Sunday → Monday
  else if (day === 6) d.setDate(d.getDate() + 2)  // Saturday → Monday
  return d.toISOString().slice(0, 10)
}

// Formats an ISO date string as "Monday, March 16"
function formatQueueDate(isoDate) {
  if (!isoDate) return ''
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

function formatDate(isoDate) {
  if (!isoDate) return ''
  const [year, month, day] = isoDate.split('-')
  const d = new Date(Number(year), Number(month) - 1, Number(day))
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function wordsCount(text) {
  return text.trim().split(/\s+/).filter(Boolean).length
}

function formatDuration(totalSeconds) {
  const safeSeconds = Math.max(0, totalSeconds)
  const mins = Math.floor(safeSeconds / 60)
  const secs = safeSeconds % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

function getTrackMeta(trackKey) {
  return Object.values(TRACKS).find((track) => track.key === trackKey)
}

function mapLibraryTaskToTodayTask(task, deploymentId, index) {
  return {
    id: `today-${deploymentId}-${task.id}-${index + 1}`,
    templateId: task.id,
    name: task.name,
    track: task.track,
    estimateMinutes: task.defaultTimeEstimate,
    kpiMapping: task.kpiMapping ?? '',
  }
}

// Maps a Week Ahead plan task → today_task_instance shape.
function planTaskToTodayTask(planTask, library, dayName, planId, index) {
  const libTask = library.find((t) => t.id === planTask.templateId)
  return {
    id: `today-plan-${planId ?? 'x'}-${dayName}-${index}`,
    templateId: planTask.templateId ?? null,
    name: planTask.name ?? '',
    track: planTask.track ?? 'advisors',
    estimateMinutes: planTask.estimateMinutes ?? libTask?.defaultTimeEstimate ?? 25,
    kpiMapping: planTask.kpiMapping ?? libTask?.kpiMapping ?? '',
    calendarEventId: planTask.gcalEventId ?? null,
  }
}

// Maps a Google Calendar CoSA event → today_task_instance shape.
function gcalEventToTodayTask(ev) {
  const priv = ev.extendedProperties?.private ?? {}
  const startDT = ev.start?.dateTime
  const endDT   = ev.end?.dateTime
  const durationMin = startDT && endDT
    ? Math.round((new Date(endDT) - new Date(startDT)) / 60000)
    : 30
  return {
    id: `gcal-${ev.id}`,
    templateId: priv.cosaTemplateId ?? null,
    name: ev.summary ?? '(untitled)',
    track: priv.cosaTrack ?? 'advisors',
    subTrack: priv.cosaSubTrack ?? null,
    estimateMinutes: Math.max(5, durationMin),
    kpiMapping: '',
    calendarEventId: ev.id,
  }
}

function buildSessionsFromTodayTasks(tasks) {
  return tasks.reduce((acc, task) => {
    acc[task.id] = getInitialSession(task)
    return acc
  }, {})
}

function safeParseJSON(value) {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

function loadPersistedState() {
  if (typeof window === 'undefined') return null
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  const parsed = safeParseJSON(raw)
  if (!parsed || typeof parsed !== 'object') return null
  return parsed
}

function persistState(state) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

function getDefaultTodaySnapshot(libraryTasks, targetDate = new Date()) {
  const deploymentId = Date.now()
  const todayName = DAY_NAMES[targetDate.getDay()]
  return libraryTasks
    .filter((task) => task.status === 'Active')
    .map((task, index) => mapLibraryTaskToTodayTask(task, deploymentId, index))
}

function validateLibraryTask(task) {
  const errors = []
  if (!task.name?.trim()) errors.push('Name is required.')
  if (!Object.values(TRACKS).some((track) => track.key === task.track)) errors.push('Track is required.')
  if (!Number.isFinite(Number(task.defaultTimeEstimate)) || Number(task.defaultTimeEstimate) < 5) {
    errors.push('Default time estimate must be at least 5 minutes.')
  }
  if (!LIBRARY_STATUSES.includes(task.status)) errors.push('Status is required.')
  return errors
}

function getStatusBehavior(status) {
  if (status === 'Active') return 'Active tasks deploy to Today snapshots.'
  if (status === 'Paused') return 'Paused tasks stay in the library but are excluded from deployment.'
  return 'Archived tasks are kept for history but hidden from deployment.'
}

function getInitialSession(task) {
  const estimateSeconds = task.estimateMinutes * 60
  return {
    sessionId: crypto.randomUUID(),
    taskId: task.id,
    timerState: TIMER_STATES.notStarted,
    estimateSeconds,
    remainingSeconds: estimateSeconds,
    elapsedSeconds: 0,
    pauseCount: 0,
    pauseDurationSeconds: 0,
    currentPauseStartedAtMs: null,
    cancelledSeconds: 0,
    startedAtISO: null,
    definitionOfDone: '',
    actualCompleted: '',
    outcomeAchieved: null,
    completionLoggedAtISO: null,
  }
}

function SortableTaskRow({ task, session, trackMeta }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }
  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
    >
      <button
        type="button"
        className="cursor-grab text-slate-400 hover:text-slate-600 active:cursor-grabbing"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
      >
        <GripVertical size={16} />
      </button>
      <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: trackMeta?.color }} />
      <div className="flex-1 min-w-0">
        <p className="truncate font-medium">{task.name}</p>
        <p className="text-xs text-slate-500">{task.timeBlock} · {task.estimateMinutes}m · {session?.timerState}</p>
      </div>
    </li>
  )
}

function App() {
  const supabaseConfigured = isSupabaseConfigured()
  const bootstrap = useMemo(() => {
    const persisted = loadPersistedState()
    const library = Array.isArray(persisted?.taskLibrary)
      ? persisted.taskLibrary
      : INITIAL_TASK_LIBRARY
    const today = Array.isArray(persisted?.todayTasks)
      ? persisted.todayTasks
      : getDefaultTodaySnapshot(library)
    const sessionState =
      persisted?.sessions && typeof persisted.sessions === 'object'
        ? persisted.sessions
        : buildSessionsFromTodayTasks(today)

    return {
      taskLibrary: library,
      todayTasks: today,
      sessions: sessionState,
      activeTaskId: persisted?.activeTaskId ?? today[0]?.id ?? null,
      lastDeploymentAt: persisted?.lastDeploymentAt ?? new Date().toISOString(),
      queueDate: persisted?.queueDate ?? getDeployTargetDate(),
    }
  }, [])

  const [activeScreen, setActiveScreen] = useState('today')
  const [taskLibrary, setTaskLibrary] = useState(bootstrap.taskLibrary)
  const [selectedLibraryTaskId, setSelectedLibraryTaskId] = useState(bootstrap.taskLibrary[0]?.id ?? null)
  const [todayTasks, setTodayTasks] = useState(bootstrap.todayTasks)
  const [activeTaskId, setActiveTaskId] = useState(bootstrap.activeTaskId)
  const [sessions, setSessions] = useState(bootstrap.sessions)
  const [completionInput, setCompletionInput] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [session, setSession] = useState(null)
  const [authBusy, setAuthBusy] = useState(false)
  const [authMessage, setAuthMessage] = useState('')
  const [libraryMessage, setLibraryMessage] = useState('')
  const [lastDeploymentAt, setLastDeploymentAt] = useState(bootstrap.lastDeploymentAt)
  const [queueDate, setQueueDate] = useState(bootstrap.queueDate)
  const [libraryFilter, setLibraryFilter] = useState('Active')
  const [collapsedLibraryTracks, setCollapsedLibraryTracks] = useState({})
  const [archiveConfirmId, setArchiveConfirmId] = useState(null)
  const [completionLog, setCompletionLog] = useState(() => loadCompletionLog())
  const [weekOffset, setWeekOffset] = useState(0)
  const [fridayReviews, setFridayReviews] = useState([])
  const [reviewDraft, setReviewDraft] = useState({ q1: '', q2: '', q3: '', mondayIntention: '' })
  const [reviewSaving, setReviewSaving] = useState(false)
  const [kpiCreditVotes, setKpiCreditVotes] = useState({}) // templateId → boolean
  const [todayPreviewDate, setTodayPreviewDate] = useState(null)
  const [clearedDates, setClearedDates] = useState(() => {
    try { return JSON.parse(window.localStorage.getItem('cosa.clearedDates') ?? '[]') } catch { return [] }
  })
  const [showQuickLog, setShowQuickLog] = useState(false)
  const [quickLogForm, setQuickLogForm] = useState({ who: '', activityType: '', durationMinutes: null, kpiCredits: [], note: '' })
  const [quickLogErrors, setQuickLogErrors] = useState({})
  const [quickLogSubmitting, setQuickLogSubmitting] = useState(false)
  const [quickLogToast, setQuickLogToast] = useState(false)
  const [quickLogEntries, setQuickLogEntries] = useState(() => {
    try { return JSON.parse(window.localStorage.getItem(QUICK_LOG_LOCAL_KEY) ?? '[]') } catch { return [] }
  })
  const [showClearDayModal, setShowClearDayModal] = useState(false)
  const [clearFrom, setClearFrom] = useState(getTodayDateString())
  const [clearTo, setClearTo] = useState(getTodayDateString())
  const taskLibrarySyncTimer = useRef(null)
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const effectiveSelectedLibraryTaskId = taskLibrary.some((task) => task.id === selectedLibraryTaskId)
    ? selectedLibraryTaskId
    : taskLibrary[0]?.id ?? null

  const activeTask = useMemo(
    () => todayTasks.find((task) => task.id === activeTaskId) ?? null,
    [activeTaskId, todayTasks],
  )
  const activeSession = activeTask ? sessions[activeTask.id] : null
  const selectedLibraryTask = useMemo(
    () => taskLibrary.find((task) => task.id === effectiveSelectedLibraryTaskId) ?? null,
    [effectiveSelectedLibraryTaskId, taskLibrary],
  )

  useEffect(() => {
    if (!activeSession) return
    if (activeSession.timerState !== TIMER_STATES.running) return

    const tick = window.setInterval(() => {
      setSessions((prev) => {
        const current = prev[activeTask.id]
        if (!current) return prev
        if (
          current.timerState !== TIMER_STATES.running &&
          current.timerState !== TIMER_STATES.overrun
        ) {
          return prev
        }

        const nextElapsed = current.elapsedSeconds + 1
        const nextRemaining = Math.max(0, current.remainingSeconds - 1)

        return {
          ...prev,
          [activeTask.id]: {
            ...current,
            elapsedSeconds: nextElapsed,
            remainingSeconds: nextRemaining,
          },
        }
      })
    }, 1000)

    return () => window.clearInterval(tick)
  }, [activeSession, activeTask])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now())
    }, 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!supabaseConfigured || !supabase) return undefined

    let isMounted = true

    const hydrateSession = async () => {
      const { data, error } = await supabase.auth.getSession()
      if (!isMounted) return
      if (error) {
        setAuthMessage(`Unable to load session: ${error.message}`)
        return
      }
      setSession(data.session ?? null)
    }

    hydrateSession()

    const { data } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!isMounted) return
      setSession(newSession)
      setAuthMessage('')
    })

    return () => {
      isMounted = false
      data.subscription.unsubscribe()
    }
  }, [supabaseConfigured])

  async function handleGoogleLogin() {
    if (!supabaseConfigured || !supabase) {
      setAuthMessage('Supabase is not configured yet. Add VITE_SUPABASE_* values first.')
      return
    }

    setAuthBusy(true)
    setAuthMessage('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        scopes: 'https://www.googleapis.com/auth/calendar.events',
      },
    })

    if (error) {
      setAuthMessage(`Google sign-in failed: ${error.message}`)
    }
    setAuthBusy(false)
  }

  async function handleSignOut() {
    if (!supabase) return
    const { error } = await supabase.auth.signOut()
    if (error) {
      setAuthMessage(`Sign out failed: ${error.message}`)
      return
    }
    setSession(null)
  }

  const tasksByBlock = useMemo(
    () =>
      TIME_BLOCK_ORDER.map((timeBlock) => ({
        timeBlock,
        tasks: todayTasks.filter((task) => task.timeBlock === timeBlock),
      })),
    [todayTasks],
  )
  const filteredTaskLibrary = useMemo(() => {
    if (libraryFilter === 'All') return taskLibrary
    return taskLibrary.filter((task) => task.status === libraryFilter)
  }, [libraryFilter, taskLibrary])

  // Set of library task IDs currently (or recently) deployed to the active queue.
  // Resets automatically the day after the queue date passes.
  const deployedTemplateIds = useMemo(() => {
    if (!queueDate || queueDate < getTodayDateString()) return new Set()
    return new Set(todayTasks.map((t) => t.templateId).filter(Boolean))
  }, [todayTasks, queueDate])
  const libraryValidationMap = useMemo(
    () =>
      taskLibrary.reduce((acc, task) => {
        acc[task.id] = validateLibraryTask(task)
        return acc
      }, {}),
    [taskLibrary],
  )
  const activeDeployCandidates = useMemo(
    () =>
      taskLibrary
        .filter((task) => task.status === 'Active')
        .map((task) => ({
          ...task,
          errors: libraryValidationMap[task.id] ?? [],
        })),
    [libraryValidationMap, taskLibrary],
  )
  const deployableCandidates = useMemo(
    () => activeDeployCandidates.filter((task) => task.errors.length === 0),
    [activeDeployCandidates],
  )
  const blockedActiveCandidates = useMemo(
    () => activeDeployCandidates.filter((task) => task.errors.length > 0),
    [activeDeployCandidates],
  )
  const pausedCount = useMemo(
    () => taskLibrary.filter((task) => task.status === 'Paused').length,
    [taskLibrary],
  )
  const archivedCount = useMemo(
    () => taskLibrary.filter((task) => task.status === 'Archived').length,
    [taskLibrary],
  )

  // Day-scroll helpers for Today Queue sidebar preview
  function formatScrollLabel(dateStr) {
    const today = getTodayDateString()
    if (dateStr === today) return 'Today'
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = tomorrow.toISOString().slice(0, 10)
    const d = new Date(dateStr + 'T12:00:00')
    const label = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    if (dateStr === tomorrowStr) return `Tomorrow — ${label}`
    return label
  }

  function getWeekdayOffsetDate(baseStr, offsetDays) {
    const d = new Date(baseStr + 'T12:00:00')
    d.setDate(d.getDate() + offsetDays)
    return d.toISOString().slice(0, 10)
  }

  const previewScrollBase = todayPreviewDate ?? getTodayDateString()
  const weekScrollStart = getWeekStartDateStr()
  const weekScrollEnd = (() => {
    const d = new Date(weekScrollStart + 'T12:00:00')
    d.setDate(d.getDate() + 4)
    return d.toISOString().slice(0, 10)
  })()

  function canScrollPrev() {
    return previewScrollBase > weekScrollStart
  }
  function canScrollNext() {
    return previewScrollBase < weekScrollEnd
  }
  function goToPrevDay() {
    let d = new Date(previewScrollBase + 'T12:00:00')
    d.setDate(d.getDate() - 1)
    if (d.getDay() === 0) d.setDate(d.getDate() - 2)
    if (d.getDay() === 6) d.setDate(d.getDate() - 1)
    const next = d.toISOString().slice(0, 10)
    setTodayPreviewDate(next === getTodayDateString() ? null : next)
  }
  function goToNextDay() {
    let d = new Date(previewScrollBase + 'T12:00:00')
    d.setDate(d.getDate() + 1)
    if (d.getDay() === 6) d.setDate(d.getDate() + 2)
    if (d.getDay() === 0) d.setDate(d.getDate() + 1)
    const next = d.toISOString().slice(0, 10)
    setTodayPreviewDate(next)
  }

  const previewTasks = null

  const kpiSummary = useMemo(() => {
    const { start: ws, end: we } = getWeekBounds(weekOffset)
    const { start: ms, end: me } = getMonthBoundsForWeek(weekOffset)
    const results = KPI_DEFINITIONS.map((def) => {
      const { count, total } = countKpi(completionLog, def, ws, we, ms, me)
      return { ...def, count, total, hit: isKpiHit(count, total, def) }
    })
    const weekly = results.filter((k) => !k.isRate && k.period === 'week' && k.target)
    const hit = weekly.filter((k) => k.hit).length
    const score = hit >= 7 ? 'green' : hit >= 4 ? 'yellow' : 'red'
    return { kpisHit: hit, kpisTotal: weekly.length, weekScore: score, kpiResults: results }
  }, [completionLog, weekOffset])

  const hasLockedTodayTimers = useMemo(
    () =>
      Object.values(sessions).some((sessionItem) =>
        [TIMER_STATES.running, TIMER_STATES.paused, TIMER_STATES.overrun].includes(
          sessionItem.timerState,
        ),
      ),
    [sessions],
  )

  useEffect(() => {
    persistState({
      taskLibrary,
      todayTasks,
      sessions,
      activeTaskId,
      lastDeploymentAt,
      queueDate,
    })
  }, [activeTaskId, lastDeploymentAt, queueDate, sessions, taskLibrary, todayTasks])

  useEffect(() => {
    saveCompletionLog(completionLog)
  }, [completionLog])

  // ── Sign-in: load all state from Supabase (source of truth) ─────────────
  useEffect(() => {
    if (!supabaseConfigured || !supabase || !session?.user?.id) return
    const userId = session.user.id
    const todayStr = getTodayDateString()
    // On weekends, load the next Monday's queue so pre-deployed Week Ahead tasks show up.
    const targetStr = getDeployTargetDate()

    const doSync = async () => {
      // 1. Task library
      let activeLibrary = taskLibrary
      const remoteLibrary = await loadTaskTemplates(userId)
      if (remoteLibrary && remoteLibrary.length > 0) {
        setTaskLibrary(remoteLibrary)
        activeLibrary = remoteLibrary
      } else {
        upsertTaskTemplates(taskLibrary, userId)
      }

      // 2. Today tasks — load from Supabase, fall back to 9am auto-deploy
      {
        const remoteTodayTasks = await loadTodayTasks(userId, targetStr)
        if (remoteTodayTasks && remoteTodayTasks.length > 0) {
          setTodayTasks(remoteTodayTasks)
          setQueueDate(targetStr)
          setSessions((prev) => {
            const next = { ...prev }
            remoteTodayTasks.forEach((task) => {
              if (!next[task.id]) next[task.id] = getInitialSession(task)
            })
            return next
          })
          const taskIds = remoteTodayTasks.map((t) => t.id)
          const remoteTimerSessions = await loadTodayTimerSessions(userId, taskIds)
          if (remoteTimerSessions) {
            setSessions((prev) => {
              const next = { ...prev }
              remoteTimerSessions.forEach((remoteSession) => {
                const { taskId } = remoteSession
                if (!taskId) return
                const hasProgress =
                  remoteSession.timerState !== 'notStarted' || remoteSession.elapsedSeconds > 0
                if (hasProgress) {
                  next[taskId] = { ...(next[taskId] ?? {}), ...remoteSession }
                }
              })
              return next
            })
          }
          const prefs = await loadUserPreferences(userId)
          if (prefs?.cleared_dates) {
            setClearedDates(prefs.cleared_dates)
            window.localStorage.setItem('cosa.clearedDates', JSON.stringify(prefs.cleared_dates))
          }
        } else {
          // No plan and no existing tasks — check for 9am auto-population (weekdays only)
          const nowDate = new Date()
          const weekday = nowDate.getDay() // 0=Sun, 6=Sat
          const hour = nowDate.getHours()
          const lastAutoDate = window.localStorage.getItem('cosa.lastAutoDeployDate')
          const localCleared = JSON.parse(window.localStorage.getItem('cosa.clearedDates') ?? '[]')
          if (
            weekday >= 1 && weekday <= 5 &&
            hour >= 9 &&
            lastAutoDate !== todayStr &&
            !localCleared.includes(todayStr)
          ) {
            const deployable = activeLibrary
              .filter((t) => t.status === 'Active')
              .sort((a, b) => TIME_BLOCK_ORDER.indexOf(a.timeBlock) - TIME_BLOCK_ORDER.indexOf(b.timeBlock))
            const validDeployable = deployable.filter((t) => validateLibraryTask(t).length === 0)
            if (validDeployable.length > 0) {
              const deployId = Date.now()
              let snapshot = validDeployable.map((t, i) => mapLibraryTaskToTodayTask(t, deployId, i))

              // Create calendar events for auto-deployed tasks
              const providerToken = (await supabase.auth.getSession()).data.session?.provider_token
              if (providerToken) {
                const eventIdMap = await createEventsForSnapshot(snapshot, providerToken, todayStr)
                if (Object.keys(eventIdMap).length > 0) {
                  snapshot = snapshot.map((t) => ({
                    ...t,
                    calendarEventId: eventIdMap[t.id] ?? null,
                  }))
                }
              }

              setTodayTasks(snapshot)
              setSessions(buildSessionsFromTodayTasks(snapshot))
              setActiveTaskId(snapshot[0]?.id ?? null)
              setQueueDate(todayStr)
              window.localStorage.setItem('cosa.lastAutoDeployDate', todayStr)
              upsertTodayTasks(snapshot, userId, todayStr)
              setStatusMessage("Today's tasks auto-deployed from your library.")
            }
          }
        }
      }

      // 3. Merge today's CoSA calendar events into the queue
      {
        const providerToken = (await supabase.auth.getSession()).data.session?.provider_token
        if (providerToken) {
          const timeMin = `${todayStr}T00:00:00Z`
          const timeMax = `${todayStr}T23:59:59Z`
          const gcalEvents = await fetchCoSACalendarEvents(providerToken, timeMin, timeMax)
          if (gcalEvents.length > 0) {
            setTodayTasks((prev) => {
              const existingCalIds = new Set(prev.map((t) => t.calendarEventId).filter(Boolean))
              const newFromGcal = gcalEvents
                .filter((ev) => !existingCalIds.has(ev.id))
                .map(gcalEventToTodayTask)
              if (newFromGcal.length === 0) return prev
              const merged = [...prev, ...newFromGcal]
              // Persist the new GCal-sourced tasks to Supabase
              upsertTodayTasks(merged, userId, todayStr)
              setSessions((s) => {
                const next = { ...s }
                newFromGcal.forEach((t) => { if (!next[t.id]) next[t.id] = getInitialSession(t) })
                return next
              })
              return merged
            })
            setQueueDate(todayStr)
          }
        }
      }

      // 4. Timer sessions → completion log for KPI/analytics
      const remoteSessions = await loadTimerSessions(userId)
      if (remoteSessions && remoteSessions.length > 0) {
        setCompletionLog(remoteSessions)
      }

      // 5. Friday reviews
      const reviews = await loadFridayReviews(userId)
      setFridayReviews(reviews)

      // 4. Quick log entries for this week (for KPI display)
      const { start: qlStart, end: qlEnd } = getWeekBounds(0)
      const qlEntries = await loadQuickLogEntries(qlStart.toISOString(), qlEnd.toISOString(), userId)
      if (qlEntries.length > 0) setQuickLogEntries(qlEntries)

    }

    doSync()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id, supabaseConfigured])

  // ── Sync task library edits to Supabase (debounced 500ms) ────────────────
  useEffect(() => {
    if (!supabaseConfigured || !supabase || !session?.user?.id) return
    const userId = session.user.id
    clearTimeout(taskLibrarySyncTimer.current)
    taskLibrarySyncTimer.current = setTimeout(() => {
      upsertTaskTemplates(taskLibrary, userId)
    }, 500)
    return () => clearTimeout(taskLibrarySyncTimer.current)
  }, [taskLibrary, session?.user?.id, supabaseConfigured])

  // ── Load current week's review into draft when week changes ─────────────
  useEffect(() => {
    const weekStartStr = getWeekBounds(weekOffset).start.toISOString().slice(0, 10)
    const existing = fridayReviews.find((r) => r.week_start === weekStartStr)
    setReviewDraft({
      q1: existing?.q1 ?? '',
      q2: existing?.q2 ?? '',
      q3: existing?.q3 ?? '',
      mondayIntention: existing?.monday_intention ?? '',
    })
  }, [weekOffset, fridayReviews])

  function updateLibraryTask(taskId, field, value) {
    setTaskLibrary((prev) =>
      prev.map((task) => (task.id === taskId ? { ...task, [field]: value } : task)),
    )
    setLibraryMessage('Saved to Task Library template. Changes apply to future deployments only.')
  }

  function archiveLibraryTask(taskId) {
    setTaskLibrary((prev) =>
      prev.map((task) => (task.id === taskId ? { ...task, status: 'Archived' } : task)),
    )
    setSelectedLibraryTaskId(null)
    setLibraryMessage('Task archived and removed from active library.')
    setArchiveConfirmId(null)
  }

  // ─────────────────────────────────────────────────────────────────────────

  function createLibraryTask() {
    const nextId = `lib-${Date.now()}`
    const nextTask = {
      id: nextId,
      name: 'New Task',
      track: TRACKS.advisors.key,
      subTrack: null,
      defaultTimeEstimate: 25,
      kpiMapping: '',
      status: 'Active',
    }
    setTaskLibrary((prev) => [nextTask, ...prev])
    setSelectedLibraryTaskId(nextId)
    setLibraryMessage('New task created.')
  }

  async function deployLibraryToToday() {
    if (hasLockedTodayTimers) {
      setLibraryMessage('Finish, cancel, or pause-proof active timers before deploying a new Today snapshot.')
      return
    }

    if (blockedActiveCandidates.length > 0) {
      setLibraryMessage(
        `${blockedActiveCandidates.length} Active task(s) have missing required fields. Fix validation errors before deployment.`,
      )
      return
    }

    const dayFilteredCandidates = deployableCandidates

    if (dayFilteredCandidates.length === 0) {
      setLibraryMessage('No Active tasks in the library to deploy.')
      return
    }

    const deploymentId = Date.now()
    const snapshot = dayFilteredCandidates.map((task, index) =>
      mapLibraryTaskToTodayTask(task, deploymentId, index),
    )

    const deployTargetDate = getDeployTargetDate()

    // Create Google Calendar events (if Calendar scope granted)
    let finalSnapshot = snapshot
    const providerToken = session?.provider_token
    if (providerToken) {
      const eventIdMap = await createEventsForSnapshot(snapshot, providerToken, deployTargetDate)
      if (Object.keys(eventIdMap).length > 0) {
        finalSnapshot = snapshot.map((t) => ({
          ...t,
          calendarEventId: eventIdMap[t.id] ?? null,
        }))
      }
    }

    setTodayTasks(finalSnapshot)
    setSessions(buildSessionsFromTodayTasks(finalSnapshot))
    setActiveTaskId(finalSnapshot[0]?.id ?? null)
    setDefinitionInput('')
    setCompletionInput('')
    setOutcomeSelection(null)
    setStatusMessage('')
    setLastDeploymentAt(new Date().toISOString())
    setQueueDate(deployTargetDate)
    setLibraryMessage(
      `Deployed ${finalSnapshot.length} Active task template(s) to Today.${providerToken ? ' Calendar events created.' : ''} Paused (${pausedCount}) and Archived (${archivedCount}) tasks were excluded.`,
    )
    if (supabaseConfigured && session?.user?.id) {
      upsertTodayTasks(finalSnapshot, session.user.id, deployTargetDate)
    }

    // If this date was manually cleared, un-clear it — intent has changed
    if (clearedDates.includes(deployTargetDate)) {
      const next = clearedDates.filter((d) => d !== deployTargetDate)
      setClearedDates(next)
      window.localStorage.setItem('cosa.clearedDates', JSON.stringify(next))
      if (session?.user?.id) upsertUserPreferences({ cleared_dates: next }, session.user.id)
    }
  }

  function setActiveTask(taskId) {
    const selectedSession = sessions[taskId]
    if (!selectedSession) return
    if (selectedSession.timerState === TIMER_STATES.running) return
    setActiveTaskId(taskId)
    setStatusMessage('')
    setCompletionInput(selectedSession.actualCompleted ?? '')
  }

  function handleStart() {
    if (!activeTask || !activeSession) return
    setStatusMessage('')
    const current = sessions[activeTask.id]
    if (!current) return

    const pauseDelta = current.currentPauseStartedAtMs
      ? Math.floor((Date.now() - current.currentPauseStartedAtMs) / 1000)
      : 0

    const nextSession = {
      ...current,
      timerState: TIMER_STATES.running,
      pauseDurationSeconds: current.pauseDurationSeconds + Math.max(0, pauseDelta),
      currentPauseStartedAtMs: null,
      startedAtISO: current.startedAtISO ?? new Date().toISOString(),
    }

    setSessions((prev) => ({ ...prev, [activeTask.id]: nextSession }))
    if (supabaseConfigured && session?.user?.id) {
      upsertTimerSession(nextSession, activeTask, session.user.id)
    }
  }

  function handlePause() {
    if (!activeTask || !activeSession) return
    if (activeSession.timerState !== TIMER_STATES.running) return

    const current = sessions[activeTask.id]
    if (!current) return

    const nextSession = {
      ...current,
      timerState: TIMER_STATES.paused,
      pauseCount: current.pauseCount + 1,
      currentPauseStartedAtMs: Date.now(),
    }

    setSessions((prev) => ({ ...prev, [activeTask.id]: nextSession }))
    if (supabaseConfigured && session?.user?.id) {
      upsertTimerSession(nextSession, activeTask, session.user.id)
    }
  }

  function handleCancel() {
    if (!activeTask || !activeSession) return
    const current = sessions[activeTask.id]
    if (!current) return

    const pauseDelta =
      current.timerState === TIMER_STATES.paused && current.currentPauseStartedAtMs
        ? Math.floor((Date.now() - current.currentPauseStartedAtMs) / 1000)
        : 0

    const now = new Date().toISOString()
    const nextSession = {
      ...current,
      timerState: TIMER_STATES.cancelled,
      cancelledSeconds: current.remainingSeconds,
      pauseDurationSeconds: current.pauseDurationSeconds + Math.max(0, pauseDelta),
      currentPauseStartedAtMs: null,
      completionLoggedAtISO: now,
    }

    setSessions((prev) => ({ ...prev, [activeTask.id]: nextSession }))

    if (supabaseConfigured && session?.user?.id) {
      upsertTimerSession(nextSession, activeTask, session.user.id)
    }

    const logEntry = {
      id: current.sessionId ?? `log-${Date.now()}`,
      taskName: activeTask.name,
      track: activeTask.track,
      kpiMapping: activeTask.kpiMapping ?? '',
      outcomeAchieved: null,
      definitionOfDoneUsed: false,
      completedAt: now,
      estimateSeconds: current.estimateSeconds,
      elapsedSeconds: current.elapsedSeconds,
      pauseCount: current.pauseCount,
      pauseDurationSeconds: current.pauseDurationSeconds + Math.max(0, pauseDelta),
      cancelledSeconds: current.remainingSeconds,
    }
    setCompletionLog((prev) => [...prev, logEntry])

    setStatusMessage('Task cancelled.')
  }

  function handleComplete() {
    if (!activeTask || !activeSession) return

    const current = sessions[activeTask.id]
    if (!current) return

    const pauseDelta =
      current.timerState === TIMER_STATES.paused && current.currentPauseStartedAtMs
        ? Math.floor((Date.now() - current.currentPauseStartedAtMs) / 1000)
        : 0

    const now = new Date().toISOString()

    const nextSession = {
      ...current,
      timerState: TIMER_STATES.completed,
      actualCompleted: completionInput.trim(),
      pauseDurationSeconds: current.pauseDurationSeconds + Math.max(0, pauseDelta),
      currentPauseStartedAtMs: null,
      completionLoggedAtISO: now,
    }

    setSessions((prev) => ({ ...prev, [activeTask.id]: nextSession }))

    if (supabaseConfigured && session?.user?.id) {
      upsertTimerSession(nextSession, activeTask, session.user.id)
    }

    const logEntry = {
      id: current.sessionId ?? `log-${Date.now()}`,
      taskName: activeTask.name,
      track: activeTask.track,
      kpiMapping: activeTask.kpiMapping ?? '',
      completedAt: now,
      estimateSeconds: current.estimateSeconds,
      elapsedSeconds: current.elapsedSeconds,
      pauseDurationSeconds: current.pauseDurationSeconds + Math.max(0, pauseDelta),
      cancelledSeconds: 0,
    }
    setCompletionLog((prev) => [...prev, logEntry])
    setStatusMessage('Task completed.')
  }

  async function handleSaveFridayReview() {
    const weekStartStr = getWeekBounds(weekOffset).start.toISOString().slice(0, 10)
    const record = {
      week_start: weekStartStr,
      week_score: kpiSummary.weekScore,
      kpis_hit: kpiSummary.kpisHit,
      kpis_total: kpiSummary.kpisTotal,
      q1: reviewDraft.q1,
      q2: reviewDraft.q2,
      q3: reviewDraft.q3,
      monday_intention: reviewDraft.mondayIntention,
    }
    setReviewSaving(true)
    if (supabaseConfigured && session?.user?.id) {
      await upsertFridayReview(record, session.user.id)
      const updated = await loadFridayReviews(session.user.id)
      setFridayReviews(updated)
    } else {
      setFridayReviews((prev) => {
        const filtered = prev.filter((r) => r.week_start !== weekStartStr)
        return [{ ...record, id: `local-${weekStartStr}` }, ...filtered]
      })
    }
    setReviewSaving(false)
  }

  function handlePrintReview() {
    const { start: weekStart, end: weekEnd } = getWeekBounds(weekOffset)
    const scoreColors = { green: '#d1fae5', yellow: '#fef3c7', red: '#fee2e2' }
    const scoreTextColors = { green: '#065f46', yellow: '#92400e', red: '#991b1b' }
    const score = kpiSummary.weekScore
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Friday Review — ${formatWeekLabel(weekStart, weekEnd)}</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; max-width: 760px; margin: 32px auto; color: #111827; line-height: 1.5; }
    h1 { font-size: 26px; margin-bottom: 4px; }
    .sub { color: #6b7280; font-size: 14px; margin-bottom: 20px; }
    .badge { display: inline-block; padding: 4px 14px; border-radius: 99px; font-weight: 700; font-size: 13px; background: ${scoreColors[score]}; color: ${scoreTextColors[score]}; margin-bottom: 20px; }
    h2 { font-size: 15px; font-weight: 700; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; margin-top: 28px; }
    p { font-size: 14px; white-space: pre-wrap; min-height: 40px; }
    .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af; }
  </style>
</head>
<body>
  <h1>Friday Review</h1>
  <p class="sub">${formatWeekLabel(weekStart, weekEnd)}</p>
  <div class="badge">${score.toUpperCase()} — ${kpiSummary.kpisHit} of ${kpiSummary.kpisTotal} KPIs hit</div>
  <h2>What actually got in the way?</h2>
  <p>${reviewDraft.q1 || '(not answered)'}</p>
  <h2>One thing to do differently next week?</h2>
  <p>${reviewDraft.q2 || '(not answered)'}</p>
  <h2>One thing done well this week?</h2>
  <p>${reviewDraft.q3 || '(not answered)'}</p>
  <h2>Monday intention</h2>
  <p>${reviewDraft.mondayIntention || '(not set)'}</p>
  <div class="footer">Chief of Staff — generated ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
</body>
</html>`
    const win = window.open('', '_blank')
    win.document.write(html)
    win.document.close()
    win.print()
  }

  // ── Clear Day handlers ────────────────────────────────────────────────────

  async function handleConfirmClearDay() {
    const from = new Date(clearFrom + 'T12:00:00')
    const to = new Date(clearTo + 'T12:00:00')
    const dates = []
    for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
      dates.push(d.toISOString().split('T')[0])
    }

    const next = [...new Set([...clearedDates, ...dates])]
    setClearedDates(next)
    window.localStorage.setItem('cosa.clearedDates', JSON.stringify(next))

    // Clear today's tasks if today is in the range
    if (dates.includes(getTodayDateString())) {
      setTodayTasks([])
      setSessions({})
      setActiveTaskId(null)
    }

    if (session?.user?.id) {
      await upsertUserPreferences({ cleared_dates: next }, session.user.id)
    }

    setShowClearDayModal(false)
    setClearFrom(getTodayDateString())
    setClearTo(getTodayDateString())
  }

  // ── Week Ahead handlers ───────────────────────────────────────────────────

  async function handleGenerateWeekPlan() {
    setWeekPlanLoading(true)
    setWeekPlanMessage('')
    setShowAiRationale(false)

    const today = new Date()
    const dayOfWeek = today.getDay() // 0=Sun, 1=Mon … 6=Sat
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
    const isFridayGen = dayOfWeek === 5
    const planWeekStartDate = isWeekend || isFridayGen
      ? getNextMondayStr()
      : getWeekStartDateStr()

    try {
      const ALL_PLAN_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
      const planDayNames = (isWeekend || isFridayGen)
        ? ALL_PLAN_DAYS
        : ALL_PLAN_DAYS.slice(Math.max(0, dayOfWeek - 1))
      const hydratedDays = {}

      for (const dayName of planDayNames) {
        const dayTasks = taskLibrary
          .filter((t) => t.status === 'Active')
          .map((t) => ({
            templateId:      t.id,
            name:            t.name,
            track:           t.track,
            estimateMinutes: t.defaultTimeEstimate ?? 25,
            gcalEventId:     null,
            status:          'planned',
          }))

        hydratedDays[dayName] = {
          date:  getDayDate(planWeekStartDate, dayName),
          tasks: dayTasks,
        }
      }

      const totalTasks = Object.values(hydratedDays).reduce((n, d) => n + d.tasks.length, 0)
      const dayRange = planDayNames.length === 5
        ? `week of ${planWeekStartDate}`
        : `${planDayNames[0]}–Friday of week of ${planWeekStartDate}`
      const aiRationale = JSON.stringify({
        summary: `${totalTasks} tasks scheduled for ${dayRange}.`,
        note: 'Review the plan, adjust as needed, then click Publish to Calendar.',
      })

      const newPlan = {
        status:        'draft',
        weekStartDate: planWeekStartDate,
        generatedAt:   new Date().toISOString(),
        aiRationale,
        days:          hydratedDays,
      }

      const planId = session?.user?.id
        ? await upsertWeeklyPlan(newPlan, planWeekStartDate, session.user.id)
        : null

      setWeekPlan({ ...newPlan, id: planId })
    } catch (err) {
      setWeekPlanMessage(`Failed to generate plan: ${err.message}`)
    } finally {
      setWeekPlanLoading(false)
    }
  }

  function handleRemoveTaskFromDraft(dayName, taskIndex) {
    setWeekPlan((prev) => {
      if (!prev) return prev
      const updatedTasks = (prev.days[dayName]?.tasks ?? []).filter((_, i) => i !== taskIndex)
      return {
        ...prev,
        days: {
          ...prev.days,
          [dayName]: { ...prev.days[dayName], tasks: updatedTasks },
        },
      }
    })
  }

  function handleReplanWeekFromToday() {
    setActiveScreen('weekPlanner')
  }

  // ─── Quick Log ────────────────────────────────────────────────────────────

  function openQuickLog() {
    setQuickLogForm({ who: '', activityType: '', durationMinutes: null, kpiCredits: [], note: '' })
    setQuickLogErrors({})
    setShowQuickLog(true)
  }

  async function handleQuickLogSubmit() {
    const errors = {}
    if (!quickLogForm.who.trim()) errors.who = 'Required'
    if (!quickLogForm.activityType) errors.activityType = 'Required'
    if (!quickLogForm.durationMinutes) errors.durationMinutes = 'Required'
    if (quickLogForm.kpiCredits.length === 0) errors.kpiCredits = 'Select at least one KPI'
    if (Object.keys(errors).length > 0) { setQuickLogErrors(errors); return }

    setQuickLogSubmitting(true)
    const now = new Date().toISOString()
    const elapsedSeconds = quickLogForm.durationMinutes * 60
    const note = quickLogForm.note.trim() || `Quick log: ${quickLogForm.activityType} with ${quickLogForm.who}`

    // Determine unique tracks from selected KPIs
    const tracks = [...new Set(quickLogForm.kpiCredits.map((k) => KPI_LABEL_TO_TRACK[k]).filter(Boolean))]

    // Build one completion log entry per track (for KPI counting)
    const newLogEntries = tracks.map((track) => {
      const trackKpis = quickLogForm.kpiCredits.filter((k) => KPI_LABEL_TO_TRACK[k] === track)
      return {
        id: `ql-${Date.now()}-${track}`,
        taskName: `Quick Log: ${quickLogForm.activityType} with ${quickLogForm.who}`,
        track,
        kpiMapping: trackKpis[0] ?? '',
        outcomeAchieved: true,
        definitionOfDoneUsed: false,
        completedAt: now,
        estimateSeconds: elapsedSeconds,
        elapsedSeconds,
        pauseCount: 0,
        pauseDurationSeconds: 0,
        cancelledSeconds: 0,
        isQuickLog: true,
      }
    })

    // Update completion log immediately (KPI dashboard reacts instantly)
    setCompletionLog((prev) => [...prev, ...newLogEntries])

    // Save to Supabase if signed in
    if (supabaseConfigured && supabase && session?.user?.id) {
      const userId = session.user.id

      // 1. Save quick_log_entries record
      await upsertQuickLogEntry(
        {
          who: quickLogForm.who.trim(),
          activityType: quickLogForm.activityType,
          durationMinutes: quickLogForm.durationMinutes,
          kpiCredits: quickLogForm.kpiCredits,
          note: quickLogForm.note.trim() || null,
        },
        userId,
      )

      // 2. One timer_sessions record per unique track
      for (const track of tracks) {
        const trackKpis = quickLogForm.kpiCredits.filter((k) => KPI_LABEL_TO_TRACK[k] === track)
        const row = {
          id: crypto.randomUUID(),
          user_id: userId,
          task_instance_id: null,
          task_name: `Quick Log: ${quickLogForm.activityType} with ${quickLogForm.who}`,
          track,
          kpi_mapping: trackKpis[0] ?? '',
          timer_state: 'Completed',
          completion_type: 'Done',
          estimate_seconds: elapsedSeconds,
          elapsed_seconds: elapsedSeconds,
          pause_count: 0,
          pause_duration_seconds: 0,
          overrun_seconds: 0,
          cancelled_seconds: 0,
          outcome_achieved: true,
          definition_of_done: '',
          actual_completed: '',
          started_at: null,
          completed_at: now,
          updated_at: now,
          is_quick_log: true,
          notes: note,
        }
        const { error } = await supabase.from('timer_sessions').insert(row)
        if (error) console.error('[QuickLog timer_session]', error.message)
      }
    } else {
      // Offline: persist to localStorage for later sync
      const stored = (() => {
        try { return JSON.parse(window.localStorage.getItem(QUICK_LOG_LOCAL_KEY) ?? '[]') } catch { return [] }
      })()
      stored.push({
        who: quickLogForm.who.trim(),
        activityType: quickLogForm.activityType,
        durationMinutes: quickLogForm.durationMinutes,
        kpiCredits: quickLogForm.kpiCredits,
        note: quickLogForm.note.trim() || null,
        loggedAt: now,
      })
      window.localStorage.setItem(QUICK_LOG_LOCAL_KEY, JSON.stringify(stored))
      setQuickLogEntries(stored)
    }

    setQuickLogSubmitting(false)
    setShowQuickLog(false)
    setQuickLogToast(true)
    setTimeout(() => setQuickLogToast(false), 2000)
  }

  // ─────────────────────────────────────────────────────────────────────────

  if (supabaseConfigured && !session) {
    return (
      <main className="mx-auto flex min-h-screen max-w-5xl items-center justify-center bg-slate-50 p-4 text-slate-900">
        <section className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <img src="/logo.png" alt="CoSA" className="mb-3 h-16 w-auto" />
          <p className="mt-1 text-sm text-slate-600">Sign in with Google to sync data across devices.</p>
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={authBusy}
            className="mt-4 w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {authBusy ? 'Connecting...' : 'Continue with Google'}
          </button>
          {authMessage ? (
            <p className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{authMessage}</p>
          ) : null}
        </section>
      </main>
    )
  }

  const hasActiveTodayTask = Boolean(activeTask && activeSession)
  const trackMeta = hasActiveTodayTask ? getTrackMeta(activeTask.track) : null
  const isCompleted = hasActiveTodayTask && activeSession.timerState === TIMER_STATES.completed
  const isCancelled = hasActiveTodayTask && activeSession.timerState === TIMER_STATES.cancelled
  const activeScreenLabel = NAV_ITEMS.find((item) => item.id === activeScreen)?.label ?? 'Today'



  function renderTaskLibrary() {
    return (
      <>
      <section className="grid gap-4 p-4 lg:grid-cols-[340px_1fr]">
        <aside className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase text-slate-500">Library Tasks</h2>
              <button
                type="button"
                onClick={createLibraryTask}
                className="rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-white"
              >
                Add Task
              </button>
            </div>
            <div className="flex gap-1">
              {['Active', ...LIBRARY_STATUSES.filter((s) => s !== 'Active'), 'All'].map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setLibraryFilter(f)}
                  className={`flex-1 rounded-md px-1 py-1 text-[11px] font-medium transition-colors ${
                    libraryFilter === f
                      ? 'bg-slate-900 text-white'
                      : 'border border-slate-200 bg-white text-slate-500 hover:border-slate-400 hover:text-slate-700'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            {filteredTaskLibrary.length === 0 ? (
              <p className="rounded-md border border-dashed border-slate-300 p-2 text-xs text-slate-500">
                No tasks in this filter.
              </p>
            ) : (() => {
              // Group by track in display order
              const trackOrder = [TRACKS.advisors.key, TRACKS.jobSearch.key, TRACKS.ventures.key]
              const grouped = {}
              for (const tk of trackOrder) grouped[tk] = []
              for (const task of filteredTaskLibrary) {
                const key = task.track ?? TRACKS.advisors.key
                if (!grouped[key]) grouped[key] = []
                grouped[key].push(task)
              }
              return trackOrder.map((trackKey) => {
                const group = grouped[trackKey]
                if (group.length === 0) return null
                const meta = getTrackMeta(trackKey)
                const collapsed = collapsedLibraryTracks[trackKey]
                return (
                  <div key={trackKey}>
                    <button
                      type="button"
                      onClick={() => setCollapsedLibraryTracks((p) => ({ ...p, [trackKey]: !p[trackKey] }))}
                      className="flex w-full items-center justify-between rounded-md px-1 py-1 hover:bg-slate-50"
                    >
                      <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: meta?.color }}>
                        {meta?.label ?? trackKey}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                          {group.length}
                        </span>
                        {collapsed
                          ? <ChevronRight size={12} className="text-slate-400" />
                          : <ChevronDown size={12} className="text-slate-400" />
                        }
                      </div>
                    </button>
                    {!collapsed && (
                      <ul className="mt-1 space-y-1.5 pl-1">
                        {group.map((task) => {
                          const selected = task.id === effectiveSelectedLibraryTaskId
                          const isDeployed = deployedTemplateIds.has(task.id)
                          return (
                            <li key={task.id}>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedLibraryTaskId(task.id)
                                  setLibraryMessage('')
                                }}
                                className={`w-full rounded-md border px-2 py-2 text-left text-sm ${
                                  selected
                                    ? 'border-slate-900 bg-slate-900 text-white'
                                    : isDeployed
                                      ? 'border-emerald-400 bg-emerald-50 hover:bg-emerald-100'
                                      : task.status === 'Paused'
                                        ? 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                                        : task.status === 'Archived'
                                          ? 'border-slate-100 bg-white opacity-50 hover:opacity-100'
                                          : 'border-slate-200 bg-white hover:bg-slate-50'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="min-w-0 truncate font-medium">{task.name}</span>
                                  <div className="flex flex-shrink-0 items-center gap-1">
                                    {isDeployed ? (
                                      <span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold ${
                                        selected ? 'bg-emerald-500 text-white' : 'bg-emerald-100 text-emerald-700'
                                      }`}>
                                        In Today
                                      </span>
                                    ) : null}
                                    {task.status === 'Paused' && !selected && (
                                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700">
                                        Paused
                                      </span>
                                    )}
                                    {task.status === 'Archived' && !selected && (
                                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold text-slate-500">
                                        Archived
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="mt-1 flex items-center justify-between text-xs opacity-70">
                                  <span>{task.subTrack ?? '—'}</span>
                                  <span>{task.defaultTimeEstimate}m</span>
                                </div>
                              </button>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </div>
                )
              })
            })()}
          </div>
          <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-2">
            <p className="text-[11px] font-semibold uppercase text-slate-500">
              Today&apos;s Deploy Preview · {DAY_NAMES[new Date().getDay()]}
            </p>
            <ul className="mt-1 space-y-1 text-xs text-slate-700">
              {activeDeployCandidates.map((task) => (
                <li key={`preview-${task.id}`} className="flex items-center justify-between gap-2">
                  <span className="truncate">{task.name}</span>
                  <span
                    className={
                      task.errors.length === 0
                        ? 'rounded bg-emerald-100 px-1 py-0.5 text-[10px] text-emerald-700'
                        : 'rounded bg-rose-100 px-1 py-0.5 text-[10px] text-rose-700'
                    }
                  >
                    {task.errors.length === 0 ? 'Ready' : 'Blocked'}
                  </span>
                </li>
              ))}
              {activeDeployCandidates.length === 0 ? (
                <li className="text-slate-500">No Active tasks in the library.</li>
              ) : null}
            </ul>
          </div>
        </aside>

        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold">Task Library</h2>
          <p className="mt-1 text-sm text-slate-600">
            Library edits update template data only. They do not retroactively change current Today tasks.
          </p>
          <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
            <p className="font-semibold">Deployment preview</p>
            <p className="mt-1">
              Deployable Active: {deployableCandidates.length} | Blocked Active:{' '}
              {blockedActiveCandidates.length} | Paused: {pausedCount} | Archived: {archivedCount}
            </p>
          </div>

          {!selectedLibraryTask ? (
            <p className="mt-4 text-sm text-slate-600">Select a task to edit.</p>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                <span className="mb-1 block text-slate-600">Name</span>
                <input
                  value={selectedLibraryTask.name}
                  onChange={(event) =>
                    updateLibraryTask(selectedLibraryTask.id, 'name', event.target.value)
                  }
                  className="w-full rounded-md border border-slate-300 px-2 py-2 outline-none ring-blue-300 focus:ring-2"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-slate-600">Track</span>
                <select
                  value={selectedLibraryTask.track}
                  onChange={(event) => {
                    updateLibraryTask(selectedLibraryTask.id, 'track', event.target.value)
                    // Clear sub-track if it doesn't belong to the new track
                    const newSubTracks = TRACK_SUB_TRACKS[event.target.value] ?? []
                    if (selectedLibraryTask.subTrack && !newSubTracks.includes(selectedLibraryTask.subTrack)) {
                      updateLibraryTask(selectedLibraryTask.id, 'subTrack', null)
                    }
                  }}
                  className="w-full rounded-md border border-slate-300 px-2 py-2 outline-none ring-blue-300 focus:ring-2"
                >
                  {Object.values(TRACKS).map((track) => (
                    <option key={track.key} value={track.key}>
                      {track.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-slate-600">Sub-Track</span>
                <select
                  value={selectedLibraryTask.subTrack ?? ''}
                  onChange={(event) =>
                    updateLibraryTask(selectedLibraryTask.id, 'subTrack', event.target.value || null)
                  }
                  className="w-full rounded-md border border-slate-300 px-2 py-2 outline-none ring-blue-300 focus:ring-2"
                >
                  <option value="">— none —</option>
                  {(TRACK_SUB_TRACKS[selectedLibraryTask.track] ?? []).map((sub) => (
                    <option key={sub} value={sub}>{sub}</option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-slate-400">
                  Used for weekly allocation tracking in the Week Planner.
                </p>
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-slate-600">Default Time Estimate (minutes)</span>
                <input
                  type="number"
                  min={5}
                  step={5}
                  value={selectedLibraryTask.defaultTimeEstimate}
                  onChange={(event) =>
                    updateLibraryTask(
                      selectedLibraryTask.id,
                      'defaultTimeEstimate',
                      Math.max(5, Number(event.target.value || 5)),
                    )
                  }
                  className="w-full rounded-md border border-slate-300 px-2 py-2 outline-none ring-blue-300 focus:ring-2"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-slate-600">KPI Mapping</span>
                <input
                  value={selectedLibraryTask.kpiMapping}
                  onChange={(event) =>
                    updateLibraryTask(selectedLibraryTask.id, 'kpiMapping', event.target.value)
                  }
                  className="w-full rounded-md border border-slate-300 px-2 py-2 outline-none ring-blue-300 focus:ring-2"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-slate-600">Time Block</span>
                <select
                  value={selectedLibraryTask.timeBlock}
                  onChange={(event) =>
                    updateLibraryTask(selectedLibraryTask.id, 'timeBlock', event.target.value)
                  }
                  className="w-full rounded-md border border-slate-300 px-2 py-2 outline-none ring-blue-300 focus:ring-2"
                >
                  {TIME_BLOCK_ORDER.map((timeBlock) => (
                    <option key={timeBlock} value={timeBlock}>
                      {timeBlock}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-slate-600">Status</span>
                <select
                  value={selectedLibraryTask.status}
                  onChange={(event) =>
                    updateLibraryTask(selectedLibraryTask.id, 'status', event.target.value)
                  }
                  className="w-full rounded-md border border-slate-300 px-2 py-2 outline-none ring-blue-300 focus:ring-2"
                >
                  {LIBRARY_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-slate-500">
                  {getStatusBehavior(selectedLibraryTask.status)}
                </p>
              </label>
              {(libraryValidationMap[selectedLibraryTask.id] ?? []).length > 0 ? (
                <div className="sm:col-span-2 rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                  <p className="font-semibold">Fix before deployment:</p>
                  <ul className="mt-1 space-y-1">
                    {(libraryValidationMap[selectedLibraryTask.id] ?? []).map((errorText) => (
                      <li key={errorText}>- {errorText}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="sm:col-span-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700">
                  Ready to deploy.
                </div>
              )}

              {/* Archive / Delete */}
              <div className="sm:col-span-2 flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                {archiveConfirmId === selectedLibraryTask.id ? (
                  <>
                    <span className="text-xs text-slate-500">Archive this task? It won't be deleted, just hidden.</span>
                    <button
                      type="button"
                      onClick={() => setArchiveConfirmId(null)}
                      className="rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => archiveLibraryTask(selectedLibraryTask.id)}
                      className="rounded-md bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700"
                    >
                      Yes, Archive
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setArchiveConfirmId(selectedLibraryTask.id)}
                    className="rounded-md border border-rose-200 px-3 py-1.5 text-xs text-rose-600 hover:border-rose-300 hover:bg-rose-50"
                  >
                    Archive Task
                  </button>
                )}
              </div>
            </div>
          )}
          {libraryMessage ? (
            <p className="mt-3 rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-700">
              {libraryMessage}
            </p>
          ) : null}
        </article>
      </section>
      </>
    )
  }

  function renderSettingsScreen() {
    const isSignedIn = Boolean(session?.user?.id)

    return (
      <section className="mx-auto max-w-2xl p-4 space-y-6">
        <h2 className="text-base font-semibold text-slate-800">Settings</h2>

      </section>
    )
  }

  function renderKpiDashboard() {
    const { start: weekStart, end: weekEnd } = getWeekBounds(weekOffset)
    const isCurrentWeek = weekOffset === 0

    const { kpisHit, kpisTotal, weekScore, kpiResults } = kpiSummary
    const weeklyKpis = kpiResults.filter((k) => !k.isRate && k.period === 'week' && k.target)

    const scoreConfig = {
      green:  { label: 'Green',  desc: '7+ KPIs hit — strong week',     bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-300' },
      yellow: { label: 'Yellow', desc: '4–6 KPIs hit — room to improve', bg: 'bg-amber-100',   text: 'text-amber-800',   border: 'border-amber-300'   },
      red:    { label: 'Red',    desc: '3 or fewer KPIs hit — regroup',  bg: 'bg-rose-100',    text: 'text-rose-800',    border: 'border-rose-300'    },
    }
    const score = scoreConfig[weekScore]

    // Time This Week: hours logged per track from the completion log
    const TRACK_HOUR_TARGETS = {
      advisors:  16, // 960 min
      networking: 3, // 180 min
      jobSearch: 16, // 960 min
      ventures:   8, // 480 min
      cosaAdmin:  2, // 120 min
    }
    const timeByTrack = Object.values(TRACKS).map((track) => {
      const entries = completionLog.filter((e) => {
        const d = new Date(e.completedAt)
        return d >= weekStart && d <= weekEnd && e.track === track.key
      })
      const minutesLogged = entries.reduce((sum, e) => sum + Math.round((e.elapsedSeconds ?? 0) / 60), 0)
      const hoursLogged = minutesLogged / 60
      const targetHours = TRACK_HOUR_TARGETS[track.key] ?? 0
      const pct = targetHours > 0 ? Math.min(100, Math.round((hoursLogged / targetHours) * 100)) : 0
      return { track, hoursLogged, targetHours, pct }
    }).filter((t) => t.targetHours > 0)

    const weekStartStr = weekStart.toISOString().slice(0, 10)
    const savedReview = fridayReviews.find((r) => r.week_start === weekStartStr)

    return (
      <section className="space-y-4 p-4">
        {/* Week navigation */}
        <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <button
            type="button"
            onClick={() => setWeekOffset((o) => o - 1)}
            className="rounded-md border border-slate-200 px-3 py-1 text-sm text-slate-600 hover:bg-slate-50"
          >
            ← Prev
          </button>
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Weekly Review</p>
            <p className="text-sm font-semibold text-slate-900">{formatWeekLabel(weekStart, weekEnd)}</p>
            {isCurrentWeek ? <p className="text-xs text-slate-500">Current week</p> : null}
          </div>
          <button
            type="button"
            onClick={() => setWeekOffset((o) => Math.min(0, o + 1))}
            disabled={isCurrentWeek}
            className="rounded-md border border-slate-200 px-3 py-1 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-30"
          >
            Next →
          </button>
        </div>

        {/* Week score */}
        <article className={`rounded-xl border ${score.border} ${score.bg} p-4`}>
          <p className="text-xs font-semibold uppercase tracking-wide opacity-70">Week Score</p>
          <p className={`mt-1 text-2xl font-bold ${score.text}`}>{score.label}</p>
          <p className={`text-sm ${score.text}`}>{score.desc}</p>
          <p className={`mt-1 text-xs ${score.text} opacity-80`}>
            {kpisHit} of {weeklyKpis.length} weekly KPIs hit
          </p>
        </article>

        {/* Time This Week by Track */}
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Time This Week</h2>
          <div className="space-y-3">
            {timeByTrack.map(({ track, hoursLogged, targetHours, pct }) => (
              <div key={track.key}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-700">{track.label}</span>
                  <span className={`font-semibold ${pct >= 100 ? 'text-emerald-700' : pct >= 60 ? 'text-amber-700' : 'text-slate-500'}`}>
                    {hoursLogged.toFixed(1)}h <span className="font-normal text-slate-400">/ {targetHours}h target</span>
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, backgroundColor: track.color }}
                  />
                </div>
              </div>
            ))}
            {completionLog.filter((e) => { const d = new Date(e.completedAt); return d >= weekStart && d <= weekEnd }).length === 0 && (
              <p className="text-xs text-slate-400 italic">No logged sessions this week yet.</p>
            )}
          </div>
        </article>

        {/* KPI scorecard by track group */}
        {KPI_TRACK_GROUPS.map((group) => {
          const groupKpis = kpiResults.filter((k) => k.trackGroup === group)
          return (
            <article key={group} className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-2" style={{ backgroundColor: `${groupKpis[0]?.color}18` }}>
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: groupKpis[0]?.color }} />
                <h2 className="text-sm font-semibold text-slate-800">{group}</h2>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs text-slate-500">
                    <th className="px-4 py-2 font-medium">KPI</th>
                    <th className="px-3 py-2 text-center font-medium">Target</th>
                    <th className="px-3 py-2 text-center font-medium">This {groupKpis[0]?.period === 'month' ? 'Month' : 'Week'}</th>
                    <th className="px-3 py-2 text-center font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {groupKpis.map((kpi) => (
                    <tr key={kpi.id} className="border-b border-slate-50 last:border-0">
                      <td className="px-4 py-2.5 text-slate-700">{kpi.label}</td>
                      <td className="px-3 py-2.5 text-center text-slate-500">
                        {kpi.isRate ? 'Every session' : kpi.target ? `${kpi.target}/${kpi.period === 'month' ? 'mo' : 'wk'}` : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-center font-medium text-slate-900">
                        {kpi.isRate
                          ? kpi.total > 0 ? `${kpi.count}/${kpi.total}` : '—'
                          : kpi.count}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {kpi.isRate && kpi.total === 0 ? (
                          <span className="text-slate-400 text-xs">No sessions</span>
                        ) : kpi.hit ? (
                          <span className="inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">✓ Hit</span>
                        ) : (
                          <span className="inline-block rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-700">✗ Miss</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </article>
          )
        })}


        {/* ── Friday Review ─────────────────────────────────────────────── */}
        <article className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-800">Friday Review</h2>
              <p className="text-xs text-slate-500">{formatWeekLabel(weekStart, weekEnd)}</p>
            </div>
            <div className="flex items-center gap-2">
              {savedReview ? (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">Saved</span>
              ) : null}
              {(reviewDraft.q1 || reviewDraft.q2 || reviewDraft.q3 || reviewDraft.mondayIntention) && savedReview ? (
                <button
                  type="button"
                  onClick={handlePrintReview}
                  className="rounded-md border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50"
                >
                  Export PDF
                </button>
              ) : null}
            </div>
          </div>

          <div className="space-y-4 p-4">
            {/* Score summary (read-only, auto-populated) */}
            <div className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${scoreConfig[weekScore].bg} ${scoreConfig[weekScore].border}`}>
              <span className={`text-sm font-bold ${scoreConfig[weekScore].text}`}>{scoreConfig[weekScore].label} week</span>
              <span className={`text-xs ${scoreConfig[weekScore].text} opacity-80`}>{kpisHit} of {kpisTotal} KPIs hit — auto-filled from above</span>
            </div>

            <div className="space-y-3">
              <label className="block">
                <p className="mb-1 text-xs font-semibold text-slate-700">What actually got in the way this week?</p>
                <textarea
                  rows={3}
                  value={reviewDraft.q1}
                  onChange={(e) => setReviewDraft((d) => ({ ...d, q1: e.target.value }))}
                  placeholder="Be honest — what blocked you or slowed you down?"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-slate-400 focus:outline-none resize-none"
                />
              </label>

              <label className="block">
                <p className="mb-1 text-xs font-semibold text-slate-700">One thing to do differently next week?</p>
                <textarea
                  rows={3}
                  value={reviewDraft.q2}
                  onChange={(e) => setReviewDraft((d) => ({ ...d, q2: e.target.value }))}
                  placeholder="One concrete change — be specific."
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-slate-400 focus:outline-none resize-none"
                />
              </label>

              <label className="block">
                <p className="mb-1 text-xs font-semibold text-slate-700">One thing you did well this week?</p>
                <textarea
                  rows={3}
                  value={reviewDraft.q3}
                  onChange={(e) => setReviewDraft((d) => ({ ...d, q3: e.target.value }))}
                  placeholder="Don't skip this — it matters."
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-slate-400 focus:outline-none resize-none"
                />
              </label>

              <label className="block">
                <p className="mb-1 text-xs font-semibold text-slate-700">Monday intention</p>
                <textarea
                  rows={2}
                  value={reviewDraft.mondayIntention}
                  onChange={(e) => setReviewDraft((d) => ({ ...d, mondayIntention: e.target.value }))}
                  placeholder="What's the one thing Monday must deliver?"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-slate-400 focus:outline-none resize-none"
                />
              </label>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={handleSaveFridayReview}
                disabled={reviewSaving}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
              >
                {reviewSaving ? 'Saving…' : savedReview ? 'Update Review' : 'Save Review'}
              </button>
              {savedReview ? (
                <button
                  type="button"
                  onClick={handlePrintReview}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Export PDF
                </button>
              ) : null}
            </div>
          </div>
        </article>

        {/* Past reviews (last 5, excluding current week) */}
        {fridayReviews.filter((r) => r.week_start !== weekStartStr).length > 0 ? (
          <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold uppercase text-slate-500">Past Reviews</h2>
            <ul className="space-y-2">
              {fridayReviews
                .filter((r) => r.week_start !== weekStartStr)
                .slice(0, 5)
                .map((r) => {
                  const sc = scoreConfig[r.week_score] ?? scoreConfig.red
                  return (
                    <li key={r.week_start} className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${sc.bg} ${sc.text}`}>{r.week_score?.toUpperCase()}</span>
                      <span className="text-xs font-medium text-slate-700">{formatDate(r.week_start)}</span>
                      <span className="text-xs text-slate-500">{r.kpis_hit}/{r.kpis_total} KPIs</span>
                      {r.monday_intention ? (
                        <span className="ml-auto max-w-[160px] truncate text-xs text-slate-400 italic">"{r.monday_intention}"</span>
                      ) : null}
                    </li>
                  )
                })}
            </ul>
          </article>
        ) : null}

        {/* Quick Logs — this week's impromptu activity */}
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold uppercase text-slate-500">Quick Logs — This Week</h2>
          {quickLogEntries.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No quick logs this week. Use the ⚡ button to log an impromptu call, coffee chat, or message.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {quickLogEntries.map((entry, i) => {
                const loggedAt = entry.logged_at ?? entry.loggedAt
                const timeStr = loggedAt
                  ? new Date(loggedAt).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
                  : ''
                const kpis = Array.isArray(entry.kpi_credits ?? entry.kpiCredits)
                  ? (entry.kpi_credits ?? entry.kpiCredits)
                  : []
                return (
                  <li key={entry.id ?? i} className="py-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-800">
                          {entry.activity_type ?? entry.activityType}
                          <span className="ml-1 font-normal text-slate-500">with {entry.who}</span>
                          <span className="ml-1 text-slate-400">· {entry.duration_minutes ?? entry.durationMinutes}m</span>
                        </p>
                        {kpis.length > 0 && (
                          <p className="mt-0.5 text-[11px] text-slate-500">{kpis.join(' · ')}</p>
                        )}
                        {(entry.note) && (
                          <p className="mt-0.5 text-[11px] italic text-slate-400">"{entry.note}"</p>
                        )}
                      </div>
                      <span className="shrink-0 text-[11px] text-slate-400">{timeStr}</span>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </article>

      </section>
    )
  }

  function renderPlaceholderScreen(title, message) {
    return (
      <section className="p-4">
        <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="mt-2 text-sm text-slate-600">{message}</p>
        </article>
      </section>
    )
  }

  return (
    <main className="mx-auto min-h-screen max-w-5xl bg-slate-50 pb-24 text-slate-900">

      {/* Clear Day Modal */}
      {showClearDayModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <h2 className="text-base font-semibold text-slate-900">Clear Day</h2>
            <p className="mt-1 text-xs text-slate-500">
              No tasks will be deployed for these dates. Auto-population will be suppressed.
            </p>
            <div className="mt-4 space-y-3">
              <label className="block text-xs text-slate-600">
                From
                <input
                  type="date"
                  value={clearFrom}
                  onChange={(e) => setClearFrom(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm outline-none ring-blue-300 focus:ring-2"
                />
              </label>
              <label className="block text-xs text-slate-600">
                To
                <input
                  type="date"
                  value={clearTo}
                  min={clearFrom}
                  onChange={(e) => setClearTo(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm outline-none ring-blue-300 focus:ring-2"
                />
              </label>
            </div>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setShowClearDayModal(false)}
                className="flex-1 rounded-md border border-slate-300 py-2 text-sm text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmClearDay}
                className="flex-1 rounded-md bg-slate-900 py-2 text-sm font-medium text-white hover:bg-slate-700"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <section className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="CoSA" className="h-10 w-auto" />
            <div>
              <p className="text-sm text-slate-600">{activeScreenLabel}</p>
              {activeScreen === 'today' && todayTasks.length > 0 && queueDate ? (
                <p className="text-xs font-medium text-slate-500">
                  {queueDate > getTodayDateString()
                    ? `Tomorrow's Queue — ${formatQueueDate(queueDate)}`
                    : formatQueueDate(queueDate)}
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs sm:text-sm">
            {session?.provider_token ? (
              <span className="rounded-md bg-emerald-50 px-2 py-1 text-emerald-700 font-medium">
                📅 Calendar sync on
              </span>
            ) : supabaseConfigured && session ? (
              <button
                type="button"
                onClick={handleGoogleLogin}
                className="rounded-md bg-amber-50 px-2 py-1 text-amber-700 hover:bg-amber-100"
                title="Click to reconnect Google Calendar"
              >
                📅 Reconnect Calendar
              </button>
            ) : null}
            {supabaseConfigured && session?.user?.email ? (
              <span className="rounded-md bg-slate-100 px-2 py-1 text-slate-700">{session.user.email}</span>
            ) : (
              <span className="rounded-md bg-amber-100 px-2 py-1 text-amber-800">Local mode (no Supabase env)</span>
            )}
            {supabaseConfigured && session ? (
              <button
                type="button"
                onClick={handleSignOut}
                className="rounded-md bg-slate-900 px-2 py-1 font-medium text-white"
              >
                Sign out
              </button>
            ) : null}
          </div>
        </div>
        {!supabaseConfigured ? (
          <p className="mt-2 rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-800">
            Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to `.env.local` to enable Google login and sync.
          </p>
        ) : null}
      </section>
      {activeScreen === 'today' ? (
        <section className="grid gap-4 p-4 lg:grid-cols-[1fr_320px]">
        {hasActiveTodayTask ? (
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs uppercase text-slate-500">Active Task</p>
              <h2 className="text-lg font-semibold">{activeTask.name}</h2>
            </div>
            <span
              className="rounded-full px-3 py-1 text-xs font-semibold text-white"
              style={{ backgroundColor: trackMeta?.color }}
            >
              {trackMeta?.label}
            </span>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-3 rounded-lg bg-slate-100 p-3 text-sm">
            <div>
              <p className="text-xs text-slate-500">Estimate</p>
              <p className="font-medium">{formatDuration(activeSession.estimateSeconds)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Status</p>
              <p className="font-medium">{activeSession.timerState}</p>
            </div>
          </div>

          <div className="mb-4 rounded-xl bg-slate-900 p-4 text-center text-white">
            <p className="text-xs uppercase tracking-wide">
              {activeSession.remainingSeconds === 0 ? 'Time Up' : 'Remaining'}
            </p>
            <p className="text-4xl font-semibold tabular-nums">
              {formatDuration(activeSession?.remainingSeconds ?? 0)}
            </p>
            {activeSession.remainingSeconds === 0 && (
              <p className="mt-1 text-xs text-slate-400">
                {formatDuration(activeSession?.elapsedSeconds ?? 0)} elapsed
              </p>
            )}
          </div>

          <div className="mb-4 grid gap-2 sm:grid-cols-4">
            <button
              type="button"
              className="flex items-center justify-center gap-1 rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:bg-emerald-300 disabled:cursor-not-allowed active:scale-95"
              onClick={handleStart}
              disabled={isCompleted || isCancelled}
            >
              <Play size={16} />
              Start / Resume
            </button>
            <button
              type="button"
              className="flex items-center justify-center gap-1 rounded-md bg-amber-500 px-3 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:bg-amber-200 disabled:cursor-not-allowed active:scale-95"
              onClick={handlePause}
              disabled={isCompleted || isCancelled || activeSession.timerState !== TIMER_STATES.running}
            >
              <Pause size={16} />
              Pause
            </button>
            <button
              type="button"
              className="flex items-center justify-center gap-1 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed active:scale-95"
              onClick={handleComplete}
              disabled={isCompleted || isCancelled || activeSession.timerState === TIMER_STATES.notStarted}
            >
              <SquareCheck size={16} />
              Complete
            </button>
            <button
              type="button"
              className="flex items-center justify-center gap-1 rounded-md bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:bg-rose-300 disabled:cursor-not-allowed active:scale-95"
              onClick={handleCancel}
              disabled={isCompleted || isCancelled || activeSession.timerState === TIMER_STATES.notStarted}
            >
              <StopCircle size={16} />
              Cancel
            </button>
          </div>

          <div className="rounded-lg border border-slate-200 p-3">
            <label className="mb-1 block text-sm font-medium text-slate-700">Note (optional)</label>
            <textarea
              value={completionInput}
              onChange={(event) => setCompletionInput(event.target.value)}
              rows={2}
              className="w-full rounded-md border border-slate-300 p-2 text-sm outline-none ring-blue-300 focus:ring-2"
              placeholder="What did you accomplish? Any blockers?"
              disabled={isCompleted || isCancelled}
            />
          </div>

          {statusMessage ? (
            <p className="mt-3 rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-700">
              {statusMessage}
            </p>
          ) : null}

        </article>
        ) : (
        <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">No tasks scheduled for today</h2>
          <p className="mt-2 text-sm text-slate-600">
            Build your week in the <strong>Week Planner</strong> and publish to populate today&apos;s queue.
          </p>
        </article>
        )}

        <aside className="space-y-4">
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={goToPrevDay}
                  disabled={!canScrollPrev()}
                  className="rounded px-1 py-0.5 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                  title="Previous day"
                >
                  ←
                </button>
                <h3 className="text-sm font-semibold uppercase text-slate-500">
                  {todayPreviewDate ? formatScrollLabel(todayPreviewDate) : 'Today Queue'}
                </h3>
                <button
                  type="button"
                  onClick={goToNextDay}
                  disabled={!canScrollNext()}
                  className="rounded px-1 py-0.5 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                  title="Next day"
                >
                  →
                </button>
              </div>
              <div className="flex items-center gap-1.5">
                {todayPreviewDate && (
                  <button
                    type="button"
                    onClick={() => setTodayPreviewDate(null)}
                    className="rounded border border-slate-200 px-2 py-0.5 text-[11px] text-slate-500 hover:border-slate-300 hover:text-slate-700"
                  >
                    Back to Today
                  </button>
                )}
                {!todayPreviewDate && (
                  <button
                    type="button"
                    onClick={() => {
                      setClearFrom(getTodayDateString())
                      setClearTo(getTodayDateString())
                      setShowClearDayModal(true)
                    }}
                    className="rounded border border-slate-200 px-2 py-0.5 text-[11px] text-slate-400 hover:border-slate-300 hover:text-slate-600"
                  >
                    Clear Day
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleReplanWeekFromToday}
                  className="rounded border border-blue-200 px-2 py-0.5 text-[11px] text-blue-500 hover:border-blue-300 hover:text-blue-700"
                >
                  Replan Week
                </button>
              </div>
            </div>

            {todayPreviewDate ? (
              <>
                <p className="mb-2 text-xs text-slate-400">Preview — read only</p>
                {previewTasks && previewTasks.length > 0 ? (
                  <ul className="space-y-1">
                    {previewTasks.map((task) => {
                      const lib = taskLibrary.find((t) => t.id === task.templateId)
                      const meta = getTrackMeta(lib?.track ?? '')
                      return (
                        <li key={task.id ?? task.templateId} className="rounded-md border border-slate-200 px-2 py-2 text-sm">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-slate-700">{task.name ?? lib?.name ?? '—'}</span>
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: meta?.color }} />
                          </div>
                          <p className="mt-0.5 text-xs text-slate-400">{task.estimateMinutes ?? lib?.defaultTimeEstimate}m · {task.timeBlock}</p>
                        </li>
                      )
                    })}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-400">No tasks planned for this day yet.</p>
                )}
              </>
            ) : (
              <>
                <p className="mb-2 text-xs text-slate-500">
                  {queueDate ? `Queue for: ${formatQueueDate(queueDate)}` : `Deployed: ${new Date(lastDeploymentAt).toLocaleDateString()}`}
                </p>
                {tasksByBlock.map((group) => (
                  <div key={group.timeBlock} className="mb-3">
                    <p className="mb-1 text-xs font-semibold text-slate-500">{group.timeBlock}</p>
                    <ul className="space-y-1">
                      {group.tasks.map((task) => {
                        const session = sessions[task.id]
                        const selected = task.id === activeTaskId
                        const meta = getTrackMeta(task.track)
                        return (
                          <li key={task.id}>
                            <button
                              type="button"
                              onClick={() => setActiveTask(task.id)}
                              className={`w-full rounded-md border px-2 py-2 text-left text-sm ${
                                selected
                                  ? 'border-slate-900 bg-slate-900 text-white'
                                  : 'border-slate-200 bg-white hover:bg-slate-50'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span>{task.name}</span>
                                <span
                                  className="h-2 w-2 rounded-full"
                                  style={{ backgroundColor: meta?.color }}
                                />
                              </div>
                              <div className="mt-1 flex items-center justify-between text-xs opacity-80">
                                <span>{session.timerState}</span>
                                <span>{task.estimateMinutes}m</span>
                              </div>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                ))}
              </>
            )}
          </section>
        </aside>
      </section>
      ) : null}
      {activeScreen === 'taskLibrary' ? renderTaskLibrary() : null}
      {activeScreen === 'weekPlanner' ? (
        <WeekPlanner
          taskLibrary={taskLibrary}
          session={session}
          supabaseConfigured={supabaseConfigured}
        />
      ) : null}
      {activeScreen === 'kpi' ? renderKpiDashboard() : null}
      {activeScreen === 'settings' ? renderSettingsScreen() : null}

      {/* ── Floating Quick Log button ─────────────────────────────────── */}
      <button
        type="button"
        onClick={openQuickLog}
        title="Quick Log"
        className="fixed bottom-20 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-white shadow-lg transition hover:bg-slate-700 active:scale-95"
        aria-label="Open Quick Log"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
        </svg>
      </button>

      {/* ── Success toast ─────────────────────────────────────────────── */}
      {quickLogToast && (
        <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-lg">
          Logged ✓
        </div>
      )}

      {/* ── Quick Log Modal ───────────────────────────────────────────── */}
      {showQuickLog && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={() => setShowQuickLog(false)}>
          <div
            className="w-full max-w-lg rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">Quick Log</h2>
              <button type="button" onClick={() => setShowQuickLog(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <div className="max-h-[75vh] overflow-y-auto space-y-4 pr-1">

              {/* Who */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Who was this with?</label>
                <input
                  type="text"
                  value={quickLogForm.who}
                  onChange={(e) => setQuickLogForm((f) => ({ ...f, who: e.target.value }))}
                  placeholder="Name or company"
                  className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-900 ${quickLogErrors.who ? 'border-rose-400' : 'border-slate-200'}`}
                />
                {quickLogErrors.who && <p className="mt-1 text-[11px] text-rose-600">{quickLogErrors.who}</p>}
              </div>

              {/* Type */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Type</label>
                <div className="flex flex-wrap gap-2">
                  {['Call', 'Coffee Chat', 'Message', 'Meeting', 'Event'].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setQuickLogForm((f) => ({ ...f, activityType: t }))}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                        quickLogForm.activityType === t
                          ? 'bg-slate-900 text-white'
                          : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                {quickLogErrors.activityType && <p className="mt-1 text-[11px] text-rose-600">{quickLogErrors.activityType}</p>}
              </div>

              {/* Duration */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Duration</label>
                <div className="flex flex-wrap gap-2">
                  {[15, 30, 45, 60, 90].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setQuickLogForm((f) => ({ ...f, durationMinutes: m }))}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                        quickLogForm.durationMinutes === m
                          ? 'bg-slate-900 text-white'
                          : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {m}m
                    </button>
                  ))}
                </div>
                {quickLogErrors.durationMinutes && <p className="mt-1 text-[11px] text-rose-600">{quickLogErrors.durationMinutes}</p>}
              </div>

              {/* KPI Credits */}
              <div>
                <label className="mb-2 block text-xs font-semibold text-slate-700">KPI Credits</label>
                {quickLogErrors.kpiCredits && <p className="mb-1 text-[11px] text-rose-600">{quickLogErrors.kpiCredits}</p>}
                <div className="space-y-3">
                  {QUICK_LOG_KPI_GROUPS.map((grp) => (
                    <div key={grp.group}>
                      <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: grp.color }} />
                        {grp.group}
                      </p>
                      <div className="space-y-1">
                        {grp.kpis.map((kpi) => {
                          const checked = quickLogForm.kpiCredits.includes(kpi)
                          return (
                            <label key={kpi} className="flex cursor-pointer items-center gap-2">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() =>
                                  setQuickLogForm((f) => ({
                                    ...f,
                                    kpiCredits: checked
                                      ? f.kpiCredits.filter((k) => k !== kpi)
                                      : [...f.kpiCredits, kpi],
                                  }))
                                }
                                className="h-3.5 w-3.5 rounded accent-slate-900"
                              />
                              <span className="text-xs text-slate-700">{kpi}</span>
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Note */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  One-line note <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <input
                  type="text"
                  value={quickLogForm.note}
                  onChange={(e) => setQuickLogForm((f) => ({ ...f, note: e.target.value }))}
                  placeholder="e.g. Former OUTFRONT colleague, also alpha tester"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

            </div>

            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setShowQuickLog(false)}
                className="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleQuickLogSubmit}
                disabled={quickLogSubmitting}
                className="flex-1 rounded-lg bg-slate-900 py-2.5 text-sm font-medium text-white disabled:opacity-50"
              >
                {quickLogSubmitting ? 'Logging…' : 'Log Activity'}
              </button>
            </div>
          </div>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 border-t border-slate-200 bg-white">
        <ul className="mx-auto grid max-w-5xl grid-cols-5 gap-1 p-2 text-center text-xs sm:text-sm">
          {NAV_ITEMS.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => setActiveScreen(item.id)}
                className={`block w-full rounded-md px-1 py-2 ${
                  item.id === activeScreen
                    ? 'bg-slate-900 font-semibold text-white'
                    : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </main>
  )
}

export default App
