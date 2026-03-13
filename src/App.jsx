import { useEffect, useMemo, useRef, useState } from 'react'
import { Pause, Play, SquareCheck, StopCircle, GripVertical, Sparkles, AlertTriangle, Clock } from 'lucide-react'
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
  loadTodayTasks,
  upsertTimerSession,
  loadTimerSessions,
  syncRescheduleQueue,
  loadRescheduleQueue,
  updateRescheduleItem,
  upsertFridayReview,
  loadFridayReviews,
  upsertWeeklyPlan,
  loadCurrentWeekPlan,
  updatePlanAfterPublish,
  loadUserPreferences,
  upsertUserPreferences,
} from './lib/supabaseSync'
import {
  createEventsForSnapshot,
  moveCalendarEvent,
  createWeekPlanEvents,
  fetchCoSACalendarEvents,
  BLOCK_CAPACITY_MINUTES,
} from './lib/googleCalendar'

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
}

const TIMER_STATES = {
  notStarted: 'Not Started',
  running: 'Running',
  paused: 'Paused',
  completed: 'Completed',
  cancelled: 'Cancelled',
  overrun: 'Overrun',
}

const FREQUENCIES = ['Daily', 'Weekly', 'Monthly', 'As scheduled']
const COMPLETION_TYPES = ['Done', 'Done + Outcome', 'Partial']
const LIBRARY_STATUSES = ['Active', 'Paused', 'Archived']
const TIME_BLOCK_ORDER = ['BD', 'Networking', 'Job Search', 'Encore OS', 'Friday']
const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const ALL_WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

const INITIAL_TASK_LIBRARY = [
  // ─── TRACK 1: KUPERMAN ADVISORS — BD Block ────────────────────────────────
  {
    id: 'lib-advisors-1',
    name: 'LinkedIn Profile Optimization',
    track: TRACKS.advisors.key,
    timeBlock: 'BD',
    defaultTimeEstimate: 45,
    frequency: 'Weekly',
    completionType: 'Done',
    kpiMapping: 'Case study progress',
    subtasks: 'Review current headline and about section against latest positioning\nDraft one improvement or update\nPublish change and note what was updated',
    status: 'Active',
    requiresDefinitionOfDone: false,
    outcomePrompt: '',
    daysOfWeek: ['Monday'],
  },
  {
    id: 'lib-advisors-2',
    name: 'Case Study Development',
    track: TRACKS.advisors.key,
    timeBlock: 'BD',
    defaultTimeEstimate: 45,
    frequency: 'Weekly',
    completionType: 'Done',
    kpiMapping: 'Case study progress',
    subtasks: 'Open case study draft document\nWrite or refine one section (problem / approach / result / lesson)\nReview for tone — does it sound like you?\nSave and note where you left off',
    status: 'Active',
    requiresDefinitionOfDone: false,
    outcomePrompt: '',
    daysOfWeek: ['Monday'],
  },
  {
    id: 'lib-advisors-3',
    name: 'LinkedIn Thought Leadership Post',
    track: TRACKS.advisors.key,
    timeBlock: 'BD',
    defaultTimeEstimate: 45,
    frequency: 'Weekly',
    completionType: 'Done',
    kpiMapping: 'LinkedIn comments posted',
    subtasks: 'Identify one insight, lesson, or point of view from this week\nDraft post (150–300 words)\nReview: does it speak to your ICP\'s pain?\nSchedule or publish',
    status: 'Active',
    requiresDefinitionOfDone: false,
    outcomePrompt: '',
    daysOfWeek: ['Monday'],
  },
  {
    id: 'lib-advisors-4',
    name: 'One-Pager / Outreach Asset Update',
    track: TRACKS.advisors.key,
    timeBlock: 'BD',
    defaultTimeEstimate: 45,
    frequency: 'Monthly',
    completionType: 'Done',
    kpiMapping: 'Outreach messages sent',
    subtasks: 'Review current one-pager or email template\nIdentify one thing to sharpen based on recent conversations\nUpdate and save new version',
    status: 'Active',
    requiresDefinitionOfDone: false,
    outcomePrompt: '',
    daysOfWeek: ['Monday'],
  },
  {
    id: 'lib-advisors-5',
    name: 'Pipeline Review',
    track: TRACKS.advisors.key,
    timeBlock: 'BD',
    defaultTimeEstimate: 15,
    frequency: 'Weekly',
    completionType: 'Done',
    kpiMapping: 'Outreach messages sent',
    subtasks: 'Open fractional CMO pipeline tracker\nIdentify who needs a follow-up today\nFlag anyone who has gone cold — add to outreach list\nNote total pipeline status: how many in each stage?',
    status: 'Active',
    requiresDefinitionOfDone: false,
    outcomePrompt: '',
    daysOfWeek: ['Monday'],
  },
  {
    id: 'lib-advisors-6',
    name: 'Send Outreach Messages (x3)',
    track: TRACKS.advisors.key,
    timeBlock: 'BD',
    defaultTimeEstimate: 30,
    frequency: 'Weekly',
    completionType: 'Done + Outcome',
    kpiMapping: 'Outreach messages sent',
    subtasks: 'Write and send message #1 — Connective member or warm contact\nWrite and send message #2 — former colleague or LinkedIn connection\nWrite and send message #3 — next on priority list\nLog all three in pipeline tracker immediately',
    status: 'Active',
    requiresDefinitionOfDone: false,
    outcomePrompt: 'Did any of these outreach messages generate a reply or booked call?',
    daysOfWeek: ['Tuesday', 'Thursday'],
  },
  {
    id: 'lib-advisors-7',
    name: 'Follow-Up on Open Threads',
    track: TRACKS.advisors.key,
    timeBlock: 'BD',
    defaultTimeEstimate: 15,
    frequency: 'Weekly',
    completionType: 'Done',
    kpiMapping: 'Outreach messages sent',
    subtasks: "Review all contacts in 'Contacted' or 'Replied' status\nSend follow-up to anyone who hasn't responded in 5+ days\nUpdate pipeline tracker with new status",
    status: 'Active',
    requiresDefinitionOfDone: false,
    outcomePrompt: '',
    daysOfWeek: ['Tuesday', 'Thursday'],
  },
  {
    id: 'lib-advisors-8',
    name: 'Connective Meeting Prep',
    track: TRACKS.advisors.key,
    timeBlock: 'BD',
    defaultTimeEstimate: 15,
    frequency: 'Weekly',
    completionType: 'Done',
    kpiMapping: 'Connective attendance',
    subtasks: "Review this week's Connective agenda or attendee list\nIdentify 2 people to prioritize connecting with\nPrepare one sentence on what you're working on and what you're looking for",
    status: 'Active',
    requiresDefinitionOfDone: false,
    outcomePrompt: '',
    daysOfWeek: ['Wednesday'],
  },
  {
    id: 'lib-advisors-9',
    name: 'Discovery Call Prep & Execution',
    track: TRACKS.advisors.key,
    timeBlock: 'BD',
    defaultTimeEstimate: 45,
    frequency: 'As scheduled',
    completionType: 'Done + Outcome',
    kpiMapping: 'Discovery calls held',
    subtasks: "Review prospect's LinkedIn and website before call\nPrepare 3 diagnostic questions\nConduct call\nSend follow-up within 2 hours of call ending\nUpdate pipeline tracker: call held, next action noted",
    status: 'Paused',
    requiresDefinitionOfDone: false,
    outcomePrompt: 'Did this discovery call result in a next step or booked follow-up?',
    daysOfWeek: ['Tuesday', 'Wednesday', 'Thursday'],
  },
  {
    id: 'lib-advisors-10',
    name: 'LinkedIn Engagement (ICP Founders)',
    track: TRACKS.advisors.key,
    timeBlock: 'BD',
    defaultTimeEstimate: 15,
    frequency: 'Weekly',
    completionType: 'Done',
    kpiMapping: 'LinkedIn comments posted',
    subtasks: "Find 5 posts from founders or CMOs in your target ICP\nLeave a thoughtful comment on each (not just 'great post')\nNote any that engage back — add to outreach list",
    status: 'Active',
    requiresDefinitionOfDone: false,
    outcomePrompt: '',
    daysOfWeek: ['Wednesday'],
  },
  // ─── SHARED: NETWORKING Block ─────────────────────────────────────────────
  {
    id: 'lib-networking-1',
    name: 'Warm Reconnect Outreach',
    track: TRACKS.networking.key,
    timeBlock: 'Networking',
    defaultTimeEstimate: 10,
    frequency: 'Daily',
    completionType: 'Done + Outcome',
    kpiMapping: 'Warm reconnects sent',
    subtasks: "Identify one person you've lost touch with\nSend reconnect message: 'been too long, would love to catch up for 20 min'\nLog in networking tracker: name, date, channel",
    status: 'Active',
    requiresDefinitionOfDone: false,
    outcomePrompt: 'Did this reconnect lead to a scheduled call or meaningful reply?',
    daysOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  },
  {
    id: 'lib-networking-2',
    name: 'Coffee Chat / Call',
    track: TRACKS.networking.key,
    timeBlock: 'Networking',
    defaultTimeEstimate: 45,
    frequency: 'As scheduled',
    completionType: 'Done + Outcome',
    kpiMapping: 'Coffee chats held',
    subtasks: 'Review prep notes before call\nConduct call — listen more than you talk\nNote: is this a fractional lead, a job search lead, or a referral source?\nSend brief follow-up same day\nLog in networking tracker with next action',
    status: 'Paused',
    requiresDefinitionOfDone: false,
    outcomePrompt: 'Did this coffee chat generate a lead, referral, or meaningful next step?',
    daysOfWeek: ['Tuesday', 'Thursday'],
  },
  {
    id: 'lib-networking-3',
    name: 'LinkedIn Engagement (Networking)',
    track: TRACKS.networking.key,
    timeBlock: 'Networking',
    defaultTimeEstimate: 15,
    frequency: 'Weekly',
    completionType: 'Done',
    kpiMapping: 'LinkedIn comments posted',
    subtasks: 'Find 3–5 posts from founders, CMOs, or ICP-adjacent people\nLeave thoughtful comments — add genuine perspective\nNote anyone who engages back — add to outreach list',
    status: 'Active',
    requiresDefinitionOfDone: false,
    outcomePrompt: '',
    daysOfWeek: ['Tuesday', 'Thursday'],
  },
  // ─── TRACK 2: JOB SEARCH — Job Search Block ──────────────────────────────
  {
    id: 'lib-jobsearch-1',
    name: 'Job Search Pipeline Review',
    track: TRACKS.jobSearch.key,
    timeBlock: 'Job Search',
    defaultTimeEstimate: 20,
    frequency: 'Weekly',
    completionType: 'Done',
    kpiMapping: 'Companies researched',
    subtasks: 'Open job search tracker\nReview all active applications — what is the status of each?\nIdentify anything that needs a follow-up this week\nIdentify 2–3 new target roles to research',
    status: 'Active',
    requiresDefinitionOfDone: false,
    outcomePrompt: '',
    daysOfWeek: ['Monday'],
  },
  {
    id: 'lib-jobsearch-2',
    name: 'Recruiter Check-In',
    track: TRACKS.jobSearch.key,
    timeBlock: 'Job Search',
    defaultTimeEstimate: 10,
    frequency: 'Weekly',
    completionType: 'Done',
    kpiMapping: 'Recruiter touchpoints',
    subtasks: "Select one recruiter or headhunter to touch base with\nSend a brief 'staying in touch' message — not desperate, just present\nNote date of contact in tracker",
    status: 'Active',
    requiresDefinitionOfDone: false,
    outcomePrompt: '',
    daysOfWeek: ['Monday'],
  },
  {
    id: 'lib-jobsearch-3',
    name: 'Target Company Deep Research',
    track: TRACKS.jobSearch.key,
    timeBlock: 'Job Search',
    defaultTimeEstimate: 30,
    frequency: 'Weekly',
    completionType: 'Done',
    kpiMapping: 'Companies researched',
    subtasks: 'Select one target company from your list\nResearch: are they growing? Funded? Marketing leadership gap?\nFind the right human contact — not just the job portal\nAdd to tracker with detailed notes',
    status: 'Active',
    requiresDefinitionOfDone: false,
    outcomePrompt: '',
    daysOfWeek: ['Tuesday'],
  },
  {
    id: 'lib-jobsearch-4',
    name: 'Second Company Research',
    track: TRACKS.jobSearch.key,
    timeBlock: 'Job Search',
    defaultTimeEstimate: 25,
    frequency: 'Weekly',
    completionType: 'Done',
    kpiMapping: 'Companies researched',
    subtasks: 'Repeat above for second target company\nCross-reference: do you have any warm connections here?\nAdd to tracker',
    status: 'Active',
    requiresDefinitionOfDone: false,
    outcomePrompt: '',
    daysOfWeek: ['Tuesday'],
  },
  {
    id: 'lib-jobsearch-5',
    name: 'Tailored Application',
    track: TRACKS.jobSearch.key,
    timeBlock: 'Job Search',
    defaultTimeEstimate: 45,
    frequency: 'Weekly',
    completionType: 'Done + Outcome',
    kpiMapping: 'Applications submitted',
    subtasks: 'Select one researched role to apply to today\nPull up job description — identify top 3 requirements\nTailor resume summary to mirror those requirements (1–2 changes only)\nWrite cover note — specific to this company and role\nSubmit application\nAttempt warm introduction alongside application\nLog in tracker: applied, contact identified, follow-up date set',
    status: 'Active',
    requiresDefinitionOfDone: false,
    outcomePrompt: 'Did you secure a warm introduction alongside this application?',
    daysOfWeek: ['Wednesday'],
  },
  {
    id: 'lib-jobsearch-6',
    name: 'Recruiter Relationship Management',
    track: TRACKS.jobSearch.key,
    timeBlock: 'Job Search',
    defaultTimeEstimate: 20,
    frequency: 'Weekly',
    completionType: 'Done',
    kpiMapping: 'Recruiter touchpoints',
    subtasks: "Send updates to 2 recruiters/headhunters you're actively working with\nBe specific: 'I had a conversation with X company this week' not just 'still looking'\nLog contact date in tracker",
    status: 'Active',
    requiresDefinitionOfDone: false,
    outcomePrompt: '',
    daysOfWeek: ['Thursday'],
  },
  {
    id: 'lib-jobsearch-7',
    name: 'New Executive Search Firm Outreach',
    track: TRACKS.jobSearch.key,
    timeBlock: 'Job Search',
    defaultTimeEstimate: 25,
    frequency: 'Weekly',
    completionType: 'Done + Outcome',
    kpiMapping: 'Recruiter touchpoints',
    subtasks: 'Research one new executive search firm focused on CMO/SVP roles\nFind the right contact — not the general inquiry form\nSend a targeted introduction message\nLog in tracker',
    status: 'Active',
    requiresDefinitionOfDone: false,
    outcomePrompt: 'Did this outreach to a new search firm result in a reply or call?',
    daysOfWeek: ['Thursday'],
  },
  // ─── TRACK 3: KUPERMAN VENTURES — Encore OS Block ─────────────────────────
  {
    id: 'lib-ventures-1',
    name: 'Alpha Tester Outreach',
    track: TRACKS.ventures.key,
    timeBlock: 'Encore OS',
    defaultTimeEstimate: 25,
    frequency: 'Weekly',
    completionType: 'Done',
    kpiMapping: 'Tester touchpoints',
    subtasks: "Draft personal message to each active alpha tester\nAsk a specific question: 'When you last logged in, what were you trying to do? Did it work?'\nSend messages\nLog responses in feedback tracker as they come in",
    status: 'Active',
    requiresDefinitionOfDone: false,
    outcomePrompt: '',
    daysOfWeek: ['Monday'],
  },
  {
    id: 'lib-ventures-2',
    name: 'Self-Directed Product Audit',
    track: TRACKS.ventures.key,
    timeBlock: 'Encore OS',
    defaultTimeEstimate: 45,
    frequency: 'Weekly',
    completionType: 'Done',
    kpiMapping: 'Things shipped',
    subtasks: 'Open Encore OS as a new user would\nWrite down every moment of confusion or friction — no editing, just capture\nCategorize: blocking issue vs. nice to have\nUpdate priority list: rank by impact on tester engagement',
    status: 'Active',
    requiresDefinitionOfDone: false,
    outcomePrompt: '',
    daysOfWeek: ['Tuesday'],
  },
  {
    id: 'lib-ventures-3',
    name: 'Cursor Build Session',
    track: TRACKS.ventures.key,
    timeBlock: 'Encore OS',
    defaultTimeEstimate: 90,
    frequency: 'Weekly',
    completionType: 'Done + Outcome',
    kpiMapping: 'Things shipped',
    subtasks: 'BEFORE OPENING CURSOR: write definition of done in the app\nOpen Cursor\nBuild only the defined item\nTest the fix before closing\nClose Cursor at 4pm regardless of status\nLog: done / not done / what\'s left',
    status: 'Active',
    requiresDefinitionOfDone: true,
    outcomePrompt: 'Did this session ship a meaningful improvement?',
    daysOfWeek: ['Wednesday', 'Thursday'],
  },
  {
    id: 'lib-ventures-4',
    name: 'Alpha Tester Call',
    track: TRACKS.ventures.key,
    timeBlock: 'Encore OS',
    defaultTimeEstimate: 30,
    frequency: 'Weekly',
    completionType: 'Done',
    kpiMapping: 'Tester touchpoints',
    subtasks: 'Book 20-minute call with one tester\nPrepare 3 specific questions based on their usage patterns\nConduct call\nLog key feedback: what\'s blocking them, what do they love, what would make them use it daily\nUpdate product priority list based on what you heard',
    status: 'Active',
    requiresDefinitionOfDone: false,
    outcomePrompt: '',
    daysOfWeek: ['Tuesday', 'Thursday'],
  },
  // ─── FRIDAY REVIEW Block ──────────────────────────────────────────────────
  {
    id: 'lib-friday-1',
    name: 'Score the Week',
    track: TRACKS.advisors.key,
    timeBlock: 'Friday',
    defaultTimeEstimate: 20,
    frequency: 'Weekly',
    completionType: 'Done',
    kpiMapping: 'Completion Rate',
    subtasks: 'Open KPI Dashboard — review auto-generated completion data\nFill in manual KPIs: discovery calls held, coffee chats, applications submitted\nMark each KPI: hit or missed\nNote overall week score: green (7+ KPIs hit) / yellow (4–6) / red (3 or fewer)',
    status: 'Active',
    requiresDefinitionOfDone: false,
    outcomePrompt: '',
    daysOfWeek: ['Friday'],
  },
  {
    id: 'lib-friday-2',
    name: 'Three Questions',
    track: TRACKS.advisors.key,
    timeBlock: 'Friday',
    defaultTimeEstimate: 15,
    frequency: 'Weekly',
    completionType: 'Done',
    kpiMapping: 'Completion Rate',
    subtasks: 'Write answer to Q1: What actually got in the way? (Be specific)\nWrite answer to Q2: What is ONE thing I am doing differently next week?\nWrite answer to Q3: What is ONE thing I did well this week?',
    status: 'Active',
    requiresDefinitionOfDone: false,
    outcomePrompt: '',
    daysOfWeek: ['Friday'],
  },
  {
    id: 'lib-friday-3',
    name: 'Plan Next Week',
    track: TRACKS.advisors.key,
    timeBlock: 'Friday',
    defaultTimeEstimate: 20,
    frequency: 'Weekly',
    completionType: 'Done',
    kpiMapping: 'Completion Rate',
    subtasks: 'Review all three pipeline trackers: what needs follow-up Monday?\nCheck calendar: any calls, Connective events, or conflicts?\nSet Monday intention: one sentence on the most important thing next week\nPopulate next week\'s Today view from Task Library',
    status: 'Active',
    requiresDefinitionOfDone: false,
    outcomePrompt: '',
    daysOfWeek: ['Friday'],
  },
  {
    id: 'lib-friday-4',
    name: 'Clean Up',
    track: TRACKS.advisors.key,
    timeBlock: 'Friday',
    defaultTimeEstimate: 5,
    frequency: 'Weekly',
    completionType: 'Done',
    kpiMapping: 'Completion Rate',
    subtasks: 'Close all open browser tabs\nClear desktop\nWrite Monday morning first task on a sticky note',
    status: 'Active',
    requiresDefinitionOfDone: false,
    outcomePrompt: '',
    daysOfWeek: ['Friday'],
  },
]

const NAV_ITEMS = [
  { id: 'today', label: 'Today' },
  { id: 'taskLibrary', label: 'Task Library' },
  { id: 'reschedule', label: 'Reschedule' },
  { id: 'weekAhead', label: 'Week Ahead' },
  { id: 'kpi', label: 'KPI Dashboard' },
  { id: 'analytics', label: 'Analytics' },
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
    timeBlock: task.timeBlock,
    estimateMinutes: task.defaultTimeEstimate,
    completionType: task.completionType,
    outcomePrompt: task.outcomePrompt,
    requiresDefinitionOfDone: Boolean(task.requiresDefinitionOfDone),
    subtasks: task.subtasks
      ? task.subtasks.split('\n').map((s) => s.trim()).filter(Boolean)
      : [],
    kpiMapping: task.kpiMapping ?? '',
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
    .filter((task) => {
      if (!task.daysOfWeek || task.daysOfWeek.length === 0) return true
      return task.daysOfWeek.includes(todayName)
    })
    .sort(
      (a, b) => TIME_BLOCK_ORDER.indexOf(a.timeBlock) - TIME_BLOCK_ORDER.indexOf(b.timeBlock),
    )
    .map((task, index) => mapLibraryTaskToTodayTask(task, deploymentId, index))
}

function validateLibraryTask(task) {
  const errors = []
  if (!task.name?.trim()) errors.push('Name is required.')
  if (!Object.values(TRACKS).some((track) => track.key === task.track)) errors.push('Track is required.')
  if (!TIME_BLOCK_ORDER.includes(task.timeBlock)) errors.push('Time block is required.')
  if (task.daysOfWeek !== undefined && task.daysOfWeek.length === 0) errors.push('Select at least one day.')
  if (!Number.isFinite(Number(task.defaultTimeEstimate)) || Number(task.defaultTimeEstimate) < 5) {
    errors.push('Default time estimate must be at least 5 minutes.')
  }
  if (!FREQUENCIES.includes(task.frequency)) errors.push('Frequency is required.')
  if (!COMPLETION_TYPES.includes(task.completionType)) errors.push('Completion type is required.')
  if (!task.kpiMapping?.trim()) errors.push('KPI mapping is required.')
  if (!task.subtasks?.trim()) errors.push('Subtasks are required.')
  if (!LIBRARY_STATUSES.includes(task.status)) errors.push('Status is required.')
  if (task.completionType === 'Done + Outcome' && !task.outcomePrompt?.trim()) {
    errors.push('Outcome prompt is required for Done + Outcome tasks.')
  }
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
    completionType: null,
    definitionOfDone: '',
    actualCompleted: '',
    outcomeAchieved: null,
    completionLoggedAtISO: null,
    subtaskChecks: Array.isArray(task.subtasks) ? task.subtasks.map(() => false) : [],
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
      rescheduleQueue: Array.isArray(persisted?.rescheduleQueue) ? persisted.rescheduleQueue : [],
      deferredTasks: Array.isArray(persisted?.deferredTasks) ? persisted.deferredTasks : [],
    }
  }, [])

  const [activeScreen, setActiveScreen] = useState('today')
  const [taskLibrary, setTaskLibrary] = useState(bootstrap.taskLibrary)
  const [selectedLibraryTaskId, setSelectedLibraryTaskId] = useState(bootstrap.taskLibrary[0]?.id ?? null)
  const [todayTasks, setTodayTasks] = useState(bootstrap.todayTasks)
  const [activeTaskId, setActiveTaskId] = useState(bootstrap.activeTaskId)
  const [sessions, setSessions] = useState(bootstrap.sessions)
  const [definitionInput, setDefinitionInput] = useState('')
  const [completionInput, setCompletionInput] = useState('')
  const [outcomeSelection, setOutcomeSelection] = useState(null)
  const [statusMessage, setStatusMessage] = useState('')
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [session, setSession] = useState(null)
  const [authBusy, setAuthBusy] = useState(false)
  const [authMessage, setAuthMessage] = useState('')
  const [libraryMessage, setLibraryMessage] = useState('')
  const [lastDeploymentAt, setLastDeploymentAt] = useState(bootstrap.lastDeploymentAt)
  const [libraryFilter, setLibraryFilter] = useState('All')
  const [rescheduleQueue, setRescheduleQueue] = useState(bootstrap.rescheduleQueue)
  const [deferredTasks, setDeferredTasks] = useState(bootstrap.deferredTasks)
  const [aiSuggestion, setAiSuggestion] = useState({ loading: false, text: '', error: '' })
  const overrunNotifiedRef = useRef(new Set())
  const [completionLog, setCompletionLog] = useState(() => loadCompletionLog())
  const [weekOffset, setWeekOffset] = useState(0)
  const [analyticsWeekOffset, setAnalyticsWeekOffset] = useState(0)
  const [fridayReviews, setFridayReviews] = useState([])
  const [reviewDraft, setReviewDraft] = useState({ q1: '', q2: '', q3: '', mondayIntention: '' })
  const [reviewSaving, setReviewSaving] = useState(false)
  const [showVenturesModal, setShowVenturesModal] = useState(false)
  const [venturesModalData, setVenturesModalData] = useState(null)
  const [weekPlan, setWeekPlan] = useState(null)
  const [weekPlanLoading, setWeekPlanLoading] = useState(false)
  const [weekPlanMessage, setWeekPlanMessage] = useState('')
  const [replanLoading, setReplanLoading] = useState(false)
  const [showAiRationale, setShowAiRationale] = useState(false)
  const [replanChoices, setReplanChoices] = useState({}) // taskKey → dayName | 'drop'
  const [clearedDates, setClearedDates] = useState(() => {
    try { return JSON.parse(window.localStorage.getItem('cosa.clearedDates') ?? '[]') } catch { return [] }
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
    if (
      activeSession.timerState !== TIMER_STATES.running &&
      activeSession.timerState !== TIMER_STATES.overrun
    ) {
      return
    }

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
        const nextRemaining = current.remainingSeconds - 1
        const didOverrun = current.timerState === TIMER_STATES.running && nextRemaining <= 0

        const overrunSeconds = nextElapsed - current.estimateSeconds
        if (
          current.timerState === TIMER_STATES.overrun &&
          overrunSeconds === 5 * 60 &&
          !overrunNotifiedRef.current.has(activeTask.id)
        ) {
          overrunNotifiedRef.current.add(activeTask.id)
          const overrunItem = {
            id: `rq-${Date.now()}`,
            taskName: activeTask.name,
            track: activeTask.track,
            timeBlock: activeTask.timeBlock,
            reason: 'overrun',
            remainingMinutes: null,
            status: 'pending',
            suggestedDate: getTomorrowDateString(),
            suggestedTimeBlock: activeTask.timeBlock,
          }
          setRescheduleQueue((q) => {
            if (q.some((item) => item.taskName === activeTask.name && item.reason === 'overrun')) return q
            if (supabaseConfigured && session?.user?.id) {
              syncRescheduleQueue([overrunItem], session.user.id)
            }
            return [...q, overrunItem]
          })
        }

        return {
          ...prev,
          [activeTask.id]: {
            ...current,
            elapsedSeconds: nextElapsed,
            remainingSeconds: didOverrun ? 0 : Math.max(0, nextRemaining),
            timerState: didOverrun ? TIMER_STATES.overrun : current.timerState,
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
      rescheduleQueue,
      deferredTasks,
    })
  }, [activeTaskId, deferredTasks, lastDeploymentAt, rescheduleQueue, sessions, taskLibrary, todayTasks])

  useEffect(() => {
    saveCompletionLog(completionLog)
  }, [completionLog])

  // ── Sign-in: load all state from Supabase (source of truth) ─────────────
  useEffect(() => {
    if (!supabaseConfigured || !supabase || !session?.user?.id) return
    const userId = session.user.id
    const todayStr = getTodayDateString()

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

      // 2. Today tasks
      const remoteTodayTasks = await loadTodayTasks(userId, todayStr)
      if (remoteTodayTasks && remoteTodayTasks.length > 0) {
        setTodayTasks(remoteTodayTasks)
        setSessions((prev) => {
          const next = { ...prev }
          remoteTodayTasks.forEach((task) => {
            if (!next[task.id]) next[task.id] = getInitialSession(task)
          })
          return next
        })
      // Load user preferences (cleared dates)
      const prefs = await loadUserPreferences(userId)
      if (prefs?.cleared_dates) {
        setClearedDates(prefs.cleared_dates)
        window.localStorage.setItem('cosa.clearedDates', JSON.stringify(prefs.cleared_dates))
      }

      } else {
        // Check for 9am auto-population
        const hour = new Date().getHours()
        const lastAutoDate = window.localStorage.getItem('cosa.lastAutoDeployDate')
        const localCleared = JSON.parse(window.localStorage.getItem('cosa.clearedDates') ?? '[]')
        if (hour >= 9 && lastAutoDate !== todayStr && !localCleared.includes(todayStr)) {
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
            window.localStorage.setItem('cosa.lastAutoDeployDate', todayStr)
            upsertTodayTasks(snapshot, userId, todayStr)
            setStatusMessage("Today's tasks auto-deployed from your library.")
          }
        }
      }

      // 3. Timer sessions → completion log for KPI/analytics
      const remoteSessions = await loadTimerSessions(userId)
      if (remoteSessions && remoteSessions.length > 0) {
        setCompletionLog(remoteSessions)
      }

      // 4. Reschedule queue
      const remoteQueue = await loadRescheduleQueue(userId)
      if (remoteQueue && remoteQueue.length > 0) {
        setRescheduleQueue(remoteQueue)
      }

      // 5. Friday reviews
      const reviews = await loadFridayReviews(userId)
      setFridayReviews(reviews)

      // 6. Weekly plan — load for current week or next week
      const today = new Date()
      const isWeekend = today.getDay() === 0 || today.getDay() === 6
      const planWeekStart = isWeekend || today.getDay() === 5
        ? getNextMondayStr()
        : getWeekStartDateStr()
      const existingPlan = await loadCurrentWeekPlan(planWeekStart, userId)
      if (existingPlan) setWeekPlan(existingPlan)
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

  function createLibraryTask() {
    const nextId = `lib-${Date.now()}`
    const nextTask = {
      id: nextId,
      name: 'New Task',
      track: TRACKS.advisors.key,
      timeBlock: 'BD',
      defaultTimeEstimate: 25,
      frequency: 'Weekly',
      completionType: 'Done',
      kpiMapping: '',
      subtasks: '',
      status: 'Active',
      requiresDefinitionOfDone: false,
      outcomePrompt: '',
    }
    setTaskLibrary((prev) => [nextTask, ...prev])
    setSelectedLibraryTaskId(nextId)
    setLibraryMessage('New task created. Complete all fields before your next deployment.')
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

    const todayName = DAY_NAMES[new Date().getDay()]
    const dayFilteredCandidates = deployableCandidates.filter((task) => {
      if (!task.daysOfWeek || task.daysOfWeek.length === 0) return true
      return task.daysOfWeek.includes(todayName)
    })

    if (dayFilteredCandidates.length === 0) {
      setLibraryMessage(`No Active tasks are scheduled for ${todayName}.`)
      return
    }

    const deploymentId = Date.now()
    const snapshot = dayFilteredCandidates.map((task, index) =>
      mapLibraryTaskToTodayTask(task, deploymentId, index),
    )

    const todayStr = getTodayDateString()

    // Create Google Calendar events (if Calendar scope granted)
    let finalSnapshot = snapshot
    const providerToken = session?.provider_token
    if (providerToken) {
      const eventIdMap = await createEventsForSnapshot(snapshot, providerToken, todayStr)
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
    setLibraryMessage(
      `Deployed ${finalSnapshot.length} Active task template(s) to Today.${providerToken ? ' Calendar events created.' : ''} Paused (${pausedCount}) and Archived (${archivedCount}) tasks were excluded.`,
    )
    if (supabaseConfigured && session?.user?.id) {
      upsertTodayTasks(finalSnapshot, session.user.id, todayStr)
    }

    // If this date was manually cleared, un-clear it — intent has changed
    if (clearedDates.includes(todayStr)) {
      const next = clearedDates.filter((d) => d !== todayStr)
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
  }

  function handleStart() {
    if (!activeTask || !activeSession) return
    const isVenturesEncore =
      activeTask.track === TRACKS.ventures.key &&
      activeTask.timeBlock === 'Encore OS' &&
      activeTask.requiresDefinitionOfDone
    const inputWords = wordsCount(definitionInput)

    if (isVenturesEncore && inputWords < 10) {
      setStatusMessage('Definition of done is required (minimum 10 words) before starting.')
      return
    }

    setStatusMessage('')
    const current = sessions[activeTask.id]
    if (!current) return

    const pauseDelta = current.currentPauseStartedAtMs
      ? Math.floor((Date.now() - current.currentPauseStartedAtMs) / 1000)
      : 0

    const nextSession = {
      ...current,
      timerState:
        current.remainingSeconds === 0 || current.timerState === TIMER_STATES.overrun
          ? TIMER_STATES.overrun
          : TIMER_STATES.running,
      pauseDurationSeconds: current.pauseDurationSeconds + Math.max(0, pauseDelta),
      currentPauseStartedAtMs: null,
      startedAtISO: current.startedAtISO ?? new Date().toISOString(),
      definitionOfDone: isVenturesEncore ? definitionInput.trim() : current.definitionOfDone,
    }

    setSessions((prev) => ({ ...prev, [activeTask.id]: nextSession }))
    if (supabaseConfigured && session?.user?.id) {
      upsertTimerSession(nextSession, activeTask, session.user.id)
    }
  }

  function handlePause() {
    if (!activeTask || !activeSession) return
    if (
      activeSession.timerState !== TIMER_STATES.running &&
      activeSession.timerState !== TIMER_STATES.overrun
    ) {
      return
    }

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
      completionType: 'Cancelled',
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
      completionType: 'Cancelled',
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

    const remainingMins = Math.ceil(current.remainingSeconds / 60)
    const newQueueItem = {
      id: `rq-${Date.now()}`,
      taskName: activeTask.name,
      track: activeTask.track,
      timeBlock: activeTask.timeBlock,
      reason: 'cancelled',
      remainingMinutes: remainingMins,
      status: 'pending',
      suggestedDate: getTomorrowDateString(),
      suggestedTimeBlock: activeTask.timeBlock,
    }
    setRescheduleQueue((q) => {
      if (q.some((item) => item.taskName === activeTask.name && item.reason === 'cancelled')) return q
      if (supabaseConfigured && session?.user?.id) {
        syncRescheduleQueue([newQueueItem], session.user.id)
      }
      return [...q, newQueueItem]
    })
    setStatusMessage('Task cancelled. Remaining time logged — see Reschedule tab.')
  }

  function handleComplete(forcePartial = false) {
    if (!activeTask || !activeSession) return

    const isPartial = forcePartial || activeTask.completionType === 'Partial'

    if (!isPartial && activeTask.completionType === 'Done + Outcome' && outcomeSelection === null) {
      setStatusMessage('Select an outcome result before completing this task.')
      return
    }

    if (!completionInput.trim()) {
      setStatusMessage('Add a quick note for what was actually completed.')
      return
    }

    const current = sessions[activeTask.id]
    if (!current) return

    const pauseDelta =
      current.timerState === TIMER_STATES.paused && current.currentPauseStartedAtMs
        ? Math.floor((Date.now() - current.currentPauseStartedAtMs) / 1000)
        : 0

    const now = new Date().toISOString()
    const finalCompletionType = isPartial ? 'Partial' : activeTask.completionType

    const nextSession = {
      ...current,
      timerState: TIMER_STATES.completed,
      actualCompleted: completionInput.trim(),
      outcomeAchieved: isPartial ? null : outcomeSelection,
      pauseDurationSeconds: current.pauseDurationSeconds + Math.max(0, pauseDelta),
      currentPauseStartedAtMs: null,
      completionLoggedAtISO: now,
      completionType: finalCompletionType,
    }

    setSessions((prev) => ({ ...prev, [activeTask.id]: nextSession }))

    if (supabaseConfigured && session?.user?.id) {
      upsertTimerSession(nextSession, activeTask, session.user.id)
    }

    // Show ventures blocking modal
    if (activeTask.track === TRACKS.ventures.key && current.definitionOfDone?.trim()) {
      setVenturesModalData({ session: nextSession, task: activeTask })
      setShowVenturesModal(true)
    }

    const logEntry = {
      id: current.sessionId ?? `log-${Date.now()}`,
      taskName: activeTask.name,
      track: activeTask.track,
      kpiMapping: activeTask.kpiMapping ?? '',
      completionType: finalCompletionType,
      outcomeAchieved: isPartial ? null : outcomeSelection,
      definitionOfDoneUsed: Boolean(current.definitionOfDone?.trim()),
      completedAt: now,
      estimateSeconds: current.estimateSeconds,
      elapsedSeconds: current.elapsedSeconds,
      pauseCount: current.pauseCount,
      pauseDurationSeconds: current.pauseDurationSeconds + Math.max(0, pauseDelta),
      cancelledSeconds: 0,
    }
    setCompletionLog((prev) => [...prev, logEntry])

    if (isPartial) {
      const remainingMins = Math.ceil(current.remainingSeconds / 60)
      const newQueueItem = {
        id: `rq-${Date.now()}`,
        taskName: activeTask.name,
        track: activeTask.track,
        timeBlock: activeTask.timeBlock,
        reason: 'partial',
        remainingMinutes: remainingMins,
        status: 'pending',
        suggestedDate: getTomorrowDateString(),
        suggestedTimeBlock: activeTask.timeBlock,
      }
      setRescheduleQueue((q) => {
        if (q.some((item) => item.taskName === activeTask.name && item.reason === 'partial')) return q
        if (supabaseConfigured && session?.user?.id) {
          syncRescheduleQueue([newQueueItem], session.user.id)
        }
        return [...q, newQueueItem]
      })
      setStatusMessage('Marked as partial. Remaining work added to Reschedule tab.')
    } else {
      setStatusMessage('Task completed and KPI data captured.')
    }
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

  function handleConfirmReschedule(queueId) {
    const item = rescheduleQueue.find((q) => q.id === queueId)
    if (!item) return

    // Move the calendar event to the suggested date
    const matchedTask = todayTasks.find((t) => t.name === item.taskName)
    if (matchedTask?.calendarEventId && session?.provider_token && item.suggestedDate) {
      moveCalendarEvent(matchedTask.calendarEventId, matchedTask, session.provider_token, item.suggestedDate)
    }

    setDeferredTasks((prev) => [...prev, { ...item, status: 'confirmed', confirmedAt: new Date().toISOString() }])
    setRescheduleQueue((prev) => prev.filter((q) => q.id !== queueId))
    if (supabaseConfigured && session?.user?.id) {
      updateRescheduleItem(queueId, 'confirmed', session.user.id)
    }
  }

  function handleDismissReschedule(queueId) {
    setRescheduleQueue((prev) => prev.filter((q) => q.id !== queueId))
    if (supabaseConfigured && session?.user?.id) {
      updateRescheduleItem(queueId, 'dismissed', session.user.id)
    }
  }

  function handleClearDeferred() {
    setDeferredTasks([])
  }

  async function handleFetchAiSuggestion() {
    const pendingItems = rescheduleQueue.filter((q) => q.status === 'pending')
    const remaining = todayTasks.filter((t) => {
      const s = sessions[t.id]
      return s && s.timerState === TIMER_STATES.notStarted
    })

    if (pendingItems.length === 0 && remaining.length === 0) return

    setAiSuggestion({ loading: true, text: '', error: '' })
    try {
      const res = await fetch('/api/suggest-reschedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rescheduleQueue: pendingItems,
          remainingTasks: remaining,
          todayDate: getTodayDateString(),
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setAiSuggestion({ loading: false, text: data.suggestion, error: '' })
    } catch (err) {
      setAiSuggestion({ loading: false, text: '', error: err.message })
    }
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
    const isWeekend = today.getDay() === 0 || today.getDay() === 6
    const planWeekStartDate = isWeekend || today.getDay() === 5
      ? getNextMondayStr()
      : getWeekStartDateStr()

    const pendingDeferred = rescheduleQueue.filter((item) => item.status === 'pending')

    try {
      // Generate plan deterministically from daysOfWeek routing — instant, no API call needed.
      // The daysOfWeek field already encodes the full POS schedule.
      const planDayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
      const hydratedDays = {}

      for (const dayName of planDayNames) {
        // Tasks assigned to this day, sorted by time block order
        const dayTasks = taskLibrary
          .filter((t) => t.status === 'Active')
          .filter((t) => (t.daysOfWeek ?? ALL_WEEKDAYS).includes(dayName))
          .sort((a, b) => TIME_BLOCK_ORDER.indexOf(a.timeBlock) - TIME_BLOCK_ORDER.indexOf(b.timeBlock))
          .map((t) => ({
            templateId: t.id,
            name:            t.name,
            track:           t.track,
            timeBlock:       t.timeBlock,
            estimateMinutes: t.defaultTimeEstimate ?? 25,
            gcalEventId:     null,
            status:          'planned',
            isDeferred:      false,
          }))

        // Prepend any deferred items that match this day's time blocks
        const deferredForDay = pendingDeferred
          .filter((item) => {
            const lib = taskLibrary.find((t) => t.name === item.taskName)
            return lib && (lib.daysOfWeek ?? ALL_WEEKDAYS).includes(dayName)
          })
          .map((item) => {
            const lib = taskLibrary.find((t) => t.name === item.taskName)
            return {
              templateId:      lib?.id ?? '',
              name:            item.taskName,
              track:           lib?.track ?? 'advisors',
              timeBlock:       lib?.timeBlock ?? 'BD',
              estimateMinutes: lib?.defaultTimeEstimate ?? 25,
              gcalEventId:     null,
              status:          'planned',
              isDeferred:      true,
            }
          })

        hydratedDays[dayName] = {
          date:  getDayDate(planWeekStartDate, dayName),
          tasks: [...deferredForDay, ...dayTasks],
        }
      }

      // Build structured rationale for the initial draft plan
      const totalTasks = Object.values(hydratedDays).reduce((n, d) => n + d.tasks.length, 0)
      const deferredCount = pendingDeferred.length
      const aiRationale = JSON.stringify({
        summary: `${totalTasks} tasks scheduled for the week of ${planWeekStartDate} using your day-of-week routing.`,
        deferred: deferredCount > 0
          ? pendingDeferred.map((i) => i.taskName)
          : [],
        note: 'Review the plan, remove tasks if needed, then click Publish to Calendar.',
      })

      const newPlan = {
        status:          'draft',
        weekStartDate:   planWeekStartDate,
        generatedAt:     new Date().toISOString(),
        aiRationale,
        deferredItems:   pendingDeferred.map((i) => i.taskName),
        days:            hydratedDays,
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

  async function handlePublishWeekPlan() {
    if (!weekPlan) return
    setWeekPlanLoading(true)
    setWeekPlanMessage('')

    let updatedDays = weekPlan.days
    const providerToken = session?.provider_token

    if (providerToken) {
      updatedDays = await createWeekPlanEvents(weekPlan.days, providerToken, weekPlan.id)
    }

    const publishedPlan = { ...weekPlan, status: 'published', days: updatedDays }

    if (session?.user?.id) {
      if (weekPlan.id) {
        await updatePlanAfterPublish(weekPlan.id, publishedPlan, session.user.id)
      } else {
        const newId = await upsertWeeklyPlan(publishedPlan, weekPlan.weekStartDate, session.user.id)
        publishedPlan.id = newId
        // Also persist the new ID back so future saves use it
        setWeekPlan((prev) => ({ ...prev, id: newId }))
      }
    }

    setWeekPlan(publishedPlan)
    setWeekPlanMessage(
      providerToken ? 'Plan published to Google Calendar.' : 'Plan saved. Enable calendar sync to publish events.',
    )
    setWeekPlanLoading(false)
  }

  async function handleReplan() {
    if (!weekPlan) return
    setReplanLoading(true)
    setWeekPlanMessage('')

    const providerToken = session?.provider_token
    if (!providerToken) {
      setWeekPlanMessage('Calendar sync is required for Replan.')
      setReplanLoading(false)
      return
    }

    try {
      const weekStart = weekPlan.weekStartDate
      const weekEnd = getDayDate(weekStart, 'Friday')
      const timeMin = `${weekStart}T00:00:00Z`
      const timeMax = `${weekEnd}T23:59:59Z`

      const calendarEvents = await fetchCoSACalendarEvents(providerToken, timeMin, timeMax)
      const todayStr = new Date().toISOString().split('T')[0]
      const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

      // If the plan week hasn't started yet, ALL days are remaining.
      // Only slice by today's day-of-week when we're inside the plan week.
      let remainingDays
      if (weekStart > todayStr) {
        remainingDays = DAY_ORDER
      } else {
        const todayName = DAY_NAMES[new Date().getDay()]
        const todayDayIndex = DAY_ORDER.indexOf(todayName)
        remainingDays = todayDayIndex >= 0 ? DAY_ORDER.slice(todayDayIndex) : DAY_ORDER
      }

      // Build templateId → daysOfWeek lookup from the task library
      const daysOfWeekMap = Object.fromEntries(
        taskLibrary.map((t) => [t.id, t.daysOfWeek ?? ALL_WEEKDAYS])
      )

      // Build two parallel lookups from live calendar events:
      //  1. by date::cosaTemplateId  (preferred — set on events published with fixed code)
      //  2. by date::normalizedTitle (fallback — for old events missing the metadata tag)
      const calendarPresent = new Set()       // date::templateId keys
      const calendarPresentByTitle = new Set() // date::title keys
      const calendarDurations = {}            // date::templateId → actual minutes
      const calendarDurationsByTitle = {}     // date::title → actual minutes

      for (const event of calendarEvents ?? []) {
        const templateId = event.extendedProperties?.private?.cosaTemplateId
        const dateStr = (event.start?.dateTime ?? event.start?.date ?? '').split('T')[0]
        const title = (event.summary ?? '').toLowerCase().trim()

        if (!dateStr) continue

        const actualMins = (event.start?.dateTime && event.end?.dateTime)
          ? Math.round((new Date(event.end.dateTime) - new Date(event.start.dateTime)) / 60000)
          : null
        const validMins = actualMins && actualMins > 0 && actualMins <= 480 ? actualMins : null

        if (templateId) {
          const key = `${dateStr}::${templateId}`
          calendarPresent.add(key)
          if (validMins) calendarDurations[key] = validMins
        }
        if (title) {
          const titleKey = `${dateStr}::${title}`
          calendarPresentByTitle.add(titleKey)
          if (validMins) calendarDurationsByTitle[titleKey] = validMins
        }
      }

      // Helper: check if a task is in the calendar on a given date,
      // using templateId first and event title as a fallback.
      const taskInCalendar = (date, task) => {
        const idKey = `${date}::${task.templateId}`
        const titleKey = `${date}::${(task.name ?? '').toLowerCase().trim()}`
        return calendarPresent.has(idKey) || calendarPresentByTitle.has(titleKey)
      }
      const getDuration = (date, task) => {
        const idKey = `${date}::${task.templateId}`
        const titleKey = `${date}::${(task.name ?? '').toLowerCase().trim()}`
        return calendarDurations[idKey] ?? calendarDurationsByTitle[titleKey] ?? null
      }

      // Find tasks whose (planned date + identity) is missing from the live calendar.
      // A task moved to a different day in GCal is treated as "deleted" from its planned day.
      const deletedTasks = []
      for (const [dayName, dayData] of Object.entries(weekPlan.days ?? {})) {
        if (!remainingDays.includes(dayName)) continue
        for (const task of dayData?.tasks ?? []) {
          if (!taskInCalendar(dayData.date, task)) {
            deletedTasks.push({ ...task, day: dayName })
          }
        }
      }

      // Start from the current published plan for remaining days, keeping only
      // tasks still present in the calendar on their planned day.
      const hydratedDays = {}
      for (const day of remainingDays) {
        const existing = weekPlan.days?.[day] ?? { date: getDayDate(weekStart, day), tasks: [] }
        const survivingTasks = (existing.tasks ?? [])
          .filter((t) => taskInCalendar(existing.date, t))
          .map((t) => {
            const actual = getDuration(existing.date, t)
            return actual && actual !== t.estimateMinutes
              ? { ...t, estimateMinutes: actual }
              : t
          })
        hydratedDays[day] = { ...existing, tasks: survivingTasks }
      }

      // Separate deleted tasks into:
      // - MOVES: task disappeared from its day but appears on another remaining day → auto-confirm
      // - PENDING: genuinely removed → ask the user what to do
      const confirmedMoves = []
      const pendingDecisions = []

      for (const task of deletedTasks) {
        const movedToDay = remainingDays.find((d) => {
          const dayDate = weekPlan.days?.[d]?.date
          return d !== task.day && dayDate && taskInCalendar(dayDate, task)
        })
        if (movedToDay) {
          // Auto-confirm the move — add to surviving days
          const alreadyThere = hydratedDays[movedToDay].tasks.some(
            (t) => t.templateId === task.templateId
          )
          if (!alreadyThere) {
            const actual = getDuration(weekPlan.days?.[movedToDay]?.date, task)
            hydratedDays[movedToDay].tasks = [
              ...hydratedDays[movedToDay].tasks,
              { ...task, gcalEventId: null, status: 'planned', estimateMinutes: actual ?? task.estimateMinutes },
            ]
          }
          confirmedMoves.push({ task, fromDay: task.day, toDay: movedToDay })
        } else {
          // Needs a human decision
          const allowed = daysOfWeekMap[task.templateId] ?? ALL_WEEKDAYS
          const suggestedDay = remainingDays.find((d) => allowed.includes(d)) ?? remainingDays[0]
          pendingDecisions.push({ task, originalDay: task.day, suggestedDay })
        }
      }

      // Re-sort surviving tasks by time block
      for (const day of remainingDays) {
        hydratedDays[day].tasks = hydratedDays[day].tasks.sort(
          (a, b) => TIME_BLOCK_ORDER.indexOf(a.timeBlock) - TIME_BLOCK_ORDER.indexOf(b.timeBlock)
        )
      }

      // Detect resized tasks
      const libraryEstimates = Object.fromEntries(taskLibrary.map((t) => [t.id, t.defaultTimeEstimate ?? 25]))
      const resizedItems = []
      for (const day of remainingDays) {
        const dayDate = weekPlan.days?.[day]?.date
        if (!dayDate) continue
        for (const task of weekPlan.days[day]?.tasks ?? []) {
          const actual = getDuration(dayDate, task)
          const baseline = libraryEstimates[task.templateId] ?? task.estimateMinutes
          if (actual && actual !== baseline) {
            resizedItems.push({ name: task.name, from: baseline, to: actual })
          }
        }
      }

      // Initialise user choices — default each pending task to its suggested day
      const initialChoices = {}
      for (const pd of pendingDecisions) {
        initialChoices[pd.task.templateId] = pd.suggestedDay ?? remainingDays[0]
      }
      setReplanChoices(initialChoices)

      const replanPlan = {
        ...weekPlan,
        status: 'reviewing',
        survivingDays: hydratedDays,
        confirmedMoves,
        pendingDecisions,
        resizedItems,
        remainingDays,
      }
      setWeekPlan(replanPlan)
      setShowAiRationale(true)
    } catch (err) {
      setWeekPlanMessage(`Replan failed: ${err.message ?? 'Unknown error'}`)
    } finally {
      setReplanLoading(false)
    }
  }

  async function handleApplyReplan() {
    if (!weekPlan) return
    setWeekPlanLoading(true)
    setWeekPlanMessage('')

    const providerToken = session?.provider_token
    let updatedDays = weekPlan.days

    if (providerToken) {
      const today = new Date()
      const todayDow = today.getDay() // 0=Sun
      const remainingDayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
        .filter((_, i) => i + 1 >= (todayDow === 0 ? 7 : todayDow))

      // Fetch live calendar events for remaining days and delete them all.
      // This is more reliable than relying on stored gcalEventIds (which may be null after reload).
      const weekStart = weekPlan.weekStartDate
      const weekEnd = weekPlan.days?.['Friday']?.date ?? weekStart
      const liveEvents = await fetchCoSACalendarEvents(
        providerToken,
        `${weekStart}T00:00:00Z`,
        `${weekEnd}T23:59:59Z`,
      )
      const CALENDAR_ID = 'c_f733c89ebd8fa8294dfb9b29147e64acc78eae845b47ea1271ddb7844e191716@group.calendar.google.com'
      for (const event of liveEvents ?? []) {
        const eventDate = (event.start?.dateTime ?? event.start?.date ?? '').split('T')[0]
        const isRemainingDay = remainingDayNames.some(
          (d) => weekPlan.days?.[d]?.date === eventDate
        )
        if (isRemainingDay) {
          await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events/${event.id}`,
            { method: 'DELETE', headers: { Authorization: `Bearer ${providerToken}` } },
          )
        }
      }

      // Build final days from surviving tasks + user choices for pending decisions
      const finalDays = { ...(weekPlan.survivingDays ?? weekPlan.days) }

      for (const pd of weekPlan.pendingDecisions ?? []) {
        const choice = replanChoices[pd.task.templateId]
        if (!choice || choice === 'drop') continue
        const targetDay = choice
        if (!finalDays[targetDay]) {
          finalDays[targetDay] = { date: weekPlan.days?.[targetDay]?.date ?? '', tasks: [] }
        }
        const alreadyThere = finalDays[targetDay].tasks.some(
          (t) => t.templateId === pd.task.templateId
        )
        if (!alreadyThere) {
          finalDays[targetDay].tasks = [
            ...finalDays[targetDay].tasks,
            { ...pd.task, gcalEventId: null, status: 'planned' },
          ]
        }
      }

      // Re-sort each day
      for (const day of Object.keys(finalDays)) {
        finalDays[day].tasks = (finalDays[day].tasks ?? []).sort(
          (a, b) => TIME_BLOCK_ORDER.indexOf(a.timeBlock) - TIME_BLOCK_ORDER.indexOf(b.timeBlock)
        )
      }

      updatedDays = await createWeekPlanEvents(finalDays, providerToken, weekPlan.id)
    }

    const appliedPlan = { ...weekPlan, status: 'replanned', days: updatedDays }

    if (session?.user?.id) {
      if (weekPlan.id) {
        await updatePlanAfterPublish(weekPlan.id, appliedPlan, session.user.id)
      } else {
        const newId = await upsertWeeklyPlan(appliedPlan, weekPlan.weekStartDate, session.user.id)
        appliedPlan.id = newId
      }
    }

    setWeekPlan(appliedPlan)
    setWeekPlanMessage('Replan applied to Google Calendar.')
    setWeekPlanLoading(false)
  }

  // ─────────────────────────────────────────────────────────────────────────

  function handleToggleSubtask(index) {
    if (!activeTask) return
    setSessions((prev) => {
      const current = prev[activeTask.id]
      if (!current) return prev
      const updated = [...(current.subtaskChecks ?? [])]
      updated[index] = !updated[index]
      return {
        ...prev,
        [activeTask.id]: { ...current, subtaskChecks: updated },
      }
    })
  }

  if (supabaseConfigured && !session) {
    return (
      <main className="mx-auto flex min-h-screen max-w-5xl items-center justify-center bg-slate-50 p-4 text-slate-900">
        <section className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold">Chief of Staff</h1>
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
  const isOverrun = hasActiveTodayTask && activeSession.timerState === TIMER_STATES.overrun
  const remainingOrOverrun = isOverrun
    ? formatDuration(activeSession.elapsedSeconds - activeSession.estimateSeconds)
    : formatDuration(activeSession?.remainingSeconds ?? 0)
  const timerLabel = isOverrun ? 'Overrun' : 'Remaining'

  const runningTimeSeconds = activeSession?.elapsedSeconds ?? 0
  const timeSavedSeconds = Math.max(0, (activeSession?.estimateSeconds ?? 0) - runningTimeSeconds)
  const overrunSeconds = Math.max(0, runningTimeSeconds - (activeSession?.estimateSeconds ?? 0))
  const livePauseSeconds = activeSession?.currentPauseStartedAtMs
    ? Math.floor((nowMs - activeSession.currentPauseStartedAtMs) / 1000)
    : 0
  const pauseDurationSeconds = (activeSession?.pauseDurationSeconds ?? 0) + Math.max(0, livePauseSeconds)
  const definitionWords = wordsCount(definitionInput)
  const activeScreenLabel = NAV_ITEMS.find((item) => item.id === activeScreen)?.label ?? 'Today'

  function renderTaskLibrary() {
    return (
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
            <label className="block text-xs text-slate-600">
              Show
              <select
                value={libraryFilter}
                onChange={(event) => setLibraryFilter(event.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1 outline-none ring-blue-300 focus:ring-2"
              >
                <option value="All">All</option>
                {LIBRARY_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={deployLibraryToToday}
              className="w-full rounded-md bg-emerald-600 px-2 py-2 text-xs font-semibold text-white"
            >
              Deploy Active Tasks to Today
            </button>
            <p className="text-[11px] text-slate-500">
              Last deployment: {new Date(lastDeploymentAt).toLocaleString()}
            </p>
          </div>
          <ul className="space-y-2">
            {filteredTaskLibrary.map((task) => {
              const selected = task.id === effectiveSelectedLibraryTaskId
              const meta = getTrackMeta(task.track)
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
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span>{task.name}</span>
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: meta?.color }} />
                    </div>
                    <div className="mt-1 flex items-center justify-between text-xs opacity-80">
                      <span>{task.status}</span>
                      <span>{task.defaultTimeEstimate}m</span>
                    </div>
                    <div className="mt-1 flex gap-0.5">
                      {['M', 'T', 'W', 'T', 'F'].map((abbr, i) => {
                        const fullDay = DAYS_OF_WEEK[i]
                        const active = (task.daysOfWeek ?? ALL_WEEKDAYS).includes(fullDay)
                        return (
                          <span
                            key={fullDay}
                            className={`rounded px-0.5 text-[9px] font-medium ${
                              active
                                ? selected ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-700'
                                : selected ? 'text-white/30' : 'text-slate-300'
                            }`}
                          >
                            {abbr}
                          </span>
                        )
                      })}
                    </div>
                  </button>
                </li>
              )
            })}
            {filteredTaskLibrary.length === 0 ? (
              <li className="rounded-md border border-dashed border-slate-300 p-2 text-xs text-slate-500">
                No tasks in this filter.
              </li>
            ) : null}
          </ul>
          <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-2">
            <p className="text-[11px] font-semibold uppercase text-slate-500">
              Today&apos;s Deploy Preview · {DAY_NAMES[new Date().getDay()]}
            </p>
            <ul className="mt-1 space-y-1 text-xs text-slate-700">
              {activeDeployCandidates
                .filter((task) => {
                  if (!task.daysOfWeek || task.daysOfWeek.length === 0) return true
                  return task.daysOfWeek.includes(DAY_NAMES[new Date().getDay()])
                })
                .map((task) => (
                  <li key={`preview-${task.id}`} className="flex items-center justify-between gap-2">
                    <span className="truncate">
                      {task.timeBlock}: {task.name}
                    </span>
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
              {activeDeployCandidates.filter((task) => {
                if (!task.daysOfWeek || task.daysOfWeek.length === 0) return true
                return task.daysOfWeek.includes(DAY_NAMES[new Date().getDay()])
              }).length === 0 ? (
                <li className="text-slate-500">No Active tasks scheduled for today.</li>
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
                  onChange={(event) =>
                    updateLibraryTask(selectedLibraryTask.id, 'track', event.target.value)
                  }
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
                <span className="mb-1 block text-slate-600">Frequency</span>
                <select
                  value={selectedLibraryTask.frequency}
                  onChange={(event) =>
                    updateLibraryTask(selectedLibraryTask.id, 'frequency', event.target.value)
                  }
                  className="w-full rounded-md border border-slate-300 px-2 py-2 outline-none ring-blue-300 focus:ring-2"
                >
                  {FREQUENCIES.map((frequency) => (
                    <option key={frequency} value={frequency}>
                      {frequency}
                    </option>
                  ))}
                </select>
              </label>
              <div className="text-sm">
                <span className="mb-1 block text-slate-600">Days of Week</span>
                <div className="flex gap-1">
                  {DAYS_OF_WEEK.map((day) => {
                    const abbrev = day.slice(0, 3)
                    const selected = (selectedLibraryTask.daysOfWeek ?? ALL_WEEKDAYS).includes(day)
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => {
                          const current = selectedLibraryTask.daysOfWeek ?? ALL_WEEKDAYS
                          const next = selected
                            ? current.filter((d) => d !== day)
                            : [...current, day]
                          updateLibraryTask(selectedLibraryTask.id, 'daysOfWeek', next)
                        }}
                        className={`flex-1 rounded py-1.5 text-xs font-medium transition-colors ${
                          selected
                            ? 'bg-blue-600 text-white'
                            : 'border border-slate-300 bg-white text-slate-500 hover:border-blue-400 hover:text-blue-600'
                        }`}
                      >
                        {abbrev}
                      </button>
                    )
                  })}
                </div>
                {(selectedLibraryTask.daysOfWeek ?? ALL_WEEKDAYS).length === 0 && (
                  <p className="mt-1 text-xs text-red-500">Select at least one day.</p>
                )}
              </div>
              <label className="text-sm">
                <span className="mb-1 block text-slate-600">Completion Type</span>
                <select
                  value={selectedLibraryTask.completionType}
                  onChange={(event) =>
                    updateLibraryTask(selectedLibraryTask.id, 'completionType', event.target.value)
                  }
                  className="w-full rounded-md border border-slate-300 px-2 py-2 outline-none ring-blue-300 focus:ring-2"
                >
                  {COMPLETION_TYPES.map((completionType) => (
                    <option key={completionType} value={completionType}>
                      {completionType}
                    </option>
                  ))}
                </select>
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
                <span className="mb-1 block text-slate-600">Outcome Prompt (optional)</span>
                <input
                  value={selectedLibraryTask.outcomePrompt ?? ''}
                  onChange={(event) =>
                    updateLibraryTask(selectedLibraryTask.id, 'outcomePrompt', event.target.value)
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
              <label className="text-sm sm:col-span-2">
                <span className="mb-1 block text-slate-600">Subtasks (one per line)</span>
                <textarea
                  rows={4}
                  value={selectedLibraryTask.subtasks}
                  onChange={(event) =>
                    updateLibraryTask(selectedLibraryTask.id, 'subtasks', event.target.value)
                  }
                  className="w-full rounded-md border border-slate-300 px-2 py-2 outline-none ring-blue-300 focus:ring-2"
                />
              </label>
              <label className="inline-flex items-center gap-2 text-sm sm:col-span-2">
                <input
                  type="checkbox"
                  checked={Boolean(selectedLibraryTask.requiresDefinitionOfDone)}
                  onChange={(event) =>
                    updateLibraryTask(
                      selectedLibraryTask.id,
                      'requiresDefinitionOfDone',
                      event.target.checked,
                    )
                  }
                />
                Require 10-word definition of done before timer start
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
            </div>
          )}
          {libraryMessage ? (
            <p className="mt-3 rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-700">
              {libraryMessage}
            </p>
          ) : null}
        </article>
      </section>
    )
  }

  function renderAnalyticsScreen() {
    const { start: weekStart, end: weekEnd } = getWeekBounds(analyticsWeekOffset)
    const { start: prevStart, end: prevEnd } = getWeekBounds(analyticsWeekOffset - 1)
    const isCurrentWeek = analyticsWeekOffset === 0

    const current = calcMetrics(completionLog, weekStart, weekEnd)
    const previous = calcMetrics(completionLog, prevStart, prevEnd)

    function trendArrow(curr, prev, lowerIsBetter = false) {
      if (prev === null || curr === null) return { arrow: '—', color: 'text-slate-400', diff: null }
      const diff = curr - prev
      if (diff === 0) return { arrow: '→', color: 'text-slate-400', diff: 0 }
      const isGood = lowerIsBetter ? diff < 0 : diff > 0
      return {
        arrow: diff > 0 ? '↑' : '↓',
        color: isGood ? 'text-emerald-600' : 'text-rose-600',
        diff,
      }
    }

    const metrics = [
      {
        id: 'time-saved',
        label: 'Time Saved',
        value: formatDuration(current.timeSavedSeconds),
        rawValue: current.timeSavedSeconds,
        prevRaw: previous.timeSavedSeconds,
        desc: 'Estimate minus actual on completed tasks',
        lowerIsBetter: false,
        diffFn: (d) => `${formatDuration(Math.abs(d))} vs last week`,
      },
      {
        id: 'overrun',
        label: 'Overrun Time',
        value: formatDuration(current.overrunSeconds),
        rawValue: current.overrunSeconds,
        prevRaw: previous.overrunSeconds,
        desc: 'Time spent beyond estimate',
        lowerIsBetter: true,
        diffFn: (d) => `${formatDuration(Math.abs(d))} vs last week`,
      },
      {
        id: 'pause-count',
        label: 'Pause Count',
        value: String(current.pauseCount),
        rawValue: current.pauseCount,
        prevRaw: previous.pauseCount,
        desc: 'Times you paused a running timer',
        lowerIsBetter: true,
        diffFn: (d) => `${Math.abs(d)} vs last week`,
      },
      {
        id: 'pause-duration',
        label: 'Pause Duration',
        value: formatDuration(current.pauseDurationSeconds),
        rawValue: current.pauseDurationSeconds,
        prevRaw: previous.pauseDurationSeconds,
        desc: 'Total time spent paused',
        lowerIsBetter: true,
        diffFn: (d) => `${formatDuration(Math.abs(d))} vs last week`,
      },
      {
        id: 'cancelled',
        label: 'Cancelled Time',
        value: formatDuration(current.cancelledSeconds),
        rawValue: current.cancelledSeconds,
        prevRaw: previous.cancelledSeconds,
        desc: 'Time committed but not delivered',
        lowerIsBetter: true,
        diffFn: (d) => `${formatDuration(Math.abs(d))} vs last week`,
      },
      {
        id: 'completion-rate',
        label: 'Completion Rate',
        value: current.completionRate !== null ? `${current.completionRate}%` : '—',
        rawValue: current.completionRate,
        prevRaw: previous.completionRate,
        desc: `${current.completedCount} done / ${current.total} total`,
        lowerIsBetter: false,
        diffFn: (d) => `${Math.abs(d)}% vs last week`,
      },
    ]

    // 4-week trend (current week + 3 prior)
    const trendWeeks = [0, -1, -2, -3].map((o) => {
      const off = analyticsWeekOffset + o
      const { start, end } = getWeekBounds(off)
      const m = calcMetrics(completionLog, start, end)
      return { label: formatWeekLabel(start, end), off, m, start, end }
    })

    // Track breakdown for current week
    const trackBreakdown = Object.values(TRACKS).map((track) => ({
      track,
      metrics: calcMetrics(completionLog, weekStart, weekEnd, track.key),
    }))

    return (
      <section className="space-y-4 p-4">
        {/* Week navigation */}
        <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <button
            type="button"
            onClick={() => setAnalyticsWeekOffset((o) => o - 1)}
            className="rounded-md border border-slate-200 px-3 py-1 text-sm text-slate-600 hover:bg-slate-50"
          >
            ← Prev
          </button>
          <div className="text-center">
            <p className="text-sm font-semibold text-slate-900">{formatWeekLabel(weekStart, weekEnd)}</p>
            {isCurrentWeek ? <p className="text-xs text-slate-500">Current week</p> : null}
          </div>
          <button
            type="button"
            onClick={() => setAnalyticsWeekOffset((o) => Math.min(0, o + 1))}
            disabled={isCurrentWeek}
            className="rounded-md border border-slate-200 px-3 py-1 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-30"
          >
            Next →
          </button>
        </div>

        {/* Six metric cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {metrics.map((m) => {
            const trend = trendArrow(m.rawValue, m.prevRaw, m.lowerIsBetter)
            return (
              <article key={m.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase text-slate-500">{m.label}</p>
                <p className="mt-1 text-3xl font-bold tabular-nums text-slate-900">{m.value}</p>
                <p className="mt-0.5 text-xs text-slate-400">{m.desc}</p>
                {trend.diff !== null ? (
                  <p className={`mt-2 text-xs font-medium ${trend.color}`}>
                    {trend.arrow} {m.diffFn(trend.diff)}
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-slate-300">No prior week data</p>
                )}
              </article>
            )
          })}
        </div>

        {/* 4-week trend table */}
        <article className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-x-auto">
          <div className="border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-semibold uppercase text-slate-500">4-Week Trend</h2>
          </div>
          <table className="w-full min-w-[620px] text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-left text-slate-500">
                <th className="px-4 py-2 font-medium">Week</th>
                <th className="px-3 py-2 text-center font-medium">Saved</th>
                <th className="px-3 py-2 text-center font-medium">Overrun</th>
                <th className="px-3 py-2 text-center font-medium">Pauses</th>
                <th className="px-3 py-2 text-center font-medium">Pause Time</th>
                <th className="px-3 py-2 text-center font-medium">Cancelled</th>
                <th className="px-3 py-2 text-center font-medium">Done %</th>
              </tr>
            </thead>
            <tbody>
              {trendWeeks.map(({ label, off, m }) => {
                const isCurrent = off === analyticsWeekOffset
                return (
                  <tr
                    key={off}
                    className={`border-b border-slate-50 last:border-0 ${isCurrent ? 'bg-slate-50 font-semibold' : ''}`}
                  >
                    <td className="px-4 py-2.5 text-slate-700 whitespace-nowrap">{label}</td>
                    <td className="px-3 py-2.5 text-center text-emerald-700">{formatDuration(m.timeSavedSeconds)}</td>
                    <td className="px-3 py-2.5 text-center text-rose-700">{formatDuration(m.overrunSeconds)}</td>
                    <td className="px-3 py-2.5 text-center text-slate-700">{m.pauseCount}</td>
                    <td className="px-3 py-2.5 text-center text-slate-700">{formatDuration(m.pauseDurationSeconds)}</td>
                    <td className="px-3 py-2.5 text-center text-amber-700">{formatDuration(m.cancelledSeconds)}</td>
                    <td className="px-3 py-2.5 text-center text-slate-700">
                      {m.completionRate !== null ? `${m.completionRate}%` : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </article>

        {/* Track breakdown */}
        <article className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-x-auto">
          <div className="border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-semibold uppercase text-slate-500">This Week by Track</h2>
          </div>
          <table className="w-full min-w-[580px] text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-left text-slate-500">
                <th className="px-4 py-2 font-medium">Track</th>
                <th className="px-3 py-2 text-center font-medium">Saved</th>
                <th className="px-3 py-2 text-center font-medium">Overrun</th>
                <th className="px-3 py-2 text-center font-medium">Pauses</th>
                <th className="px-3 py-2 text-center font-medium">Cancelled</th>
                <th className="px-3 py-2 text-center font-medium">Done %</th>
              </tr>
            </thead>
            <tbody>
              {trackBreakdown.map(({ track, metrics: m }) => (
                <tr key={track.key} className="border-b border-slate-50 last:border-0">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: track.color }} />
                      <span className="font-medium text-slate-700">{track.label}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-center text-emerald-700">{formatDuration(m.timeSavedSeconds)}</td>
                  <td className="px-3 py-2.5 text-center text-rose-700">{formatDuration(m.overrunSeconds)}</td>
                  <td className="px-3 py-2.5 text-center text-slate-700">{m.pauseCount}</td>
                  <td className="px-3 py-2.5 text-center text-amber-700">{formatDuration(m.cancelledSeconds)}</td>
                  <td className="px-3 py-2.5 text-center">
                    {m.completionRate !== null ? (
                      <div className="flex items-center gap-1.5">
                        <div className="h-1.5 w-12 overflow-hidden rounded-full bg-slate-200">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${m.completionRate}%`, backgroundColor: track.color }}
                          />
                        </div>
                        <span className="text-slate-700">{m.completionRate}%</span>
                      </div>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>

        {completionLog.length === 0 ? (
          <p className="text-center text-sm text-slate-400">
            Complete or cancel tasks to start seeing analytics.
          </p>
        ) : null}
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

    const completionRateByTrack = Object.values(TRACKS).map((track) => {
      const trackLog = completionLog.filter((e) => {
        const d = new Date(e.completedAt)
        return d >= weekStart && d <= weekEnd && e.track === track.key
      })
      const completed = trackLog.filter((e) => e.completionType === 'Done' || e.completionType === 'Done + Outcome').length
      const total = trackLog.length
      return { track, completed, total, rate: total > 0 ? Math.round((completed / total) * 100) : null }
    })

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

        {/* Completion rate by track */}
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold uppercase text-slate-500">Completion Rate by Track</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {completionRateByTrack.map(({ track, completed, total, rate }) => (
              <div key={track.key} className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-center">
                <p className="text-xs font-medium text-slate-500">{track.label}</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{rate !== null ? `${rate}%` : '—'}</p>
                <p className="text-xs text-slate-400">{completed} done / {total} total</p>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${rate ?? 0}%`, backgroundColor: track.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </article>

        {completionLog.length === 0 ? (
          <p className="text-center text-sm text-slate-400">
            Complete tasks to start building your KPI scorecard.
          </p>
        ) : null}

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
      </section>
    )
  }

  function renderWeekAhead() {
    const today = new Date()
    const isWeekend = today.getDay() === 0 || today.getDay() === 6
    const planWeekStartDate = isWeekend || today.getDay() === 5
      ? getNextMondayStr()
      : getWeekStartDateStr()

    // Unlocked on Fridays only
    const isFriday = today.getDay() === 5

    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
    const todayDayName = DAY_NAMES[today.getDay()]
    const todayIndex = dayNames.indexOf(todayDayName)

    const trackColors = {
      advisors:   '#1E6B3C',
      networking: '#B8600B',
      jobSearch:  '#2E75B6',
      ventures:   '#9B6BAE',
    }

    // ── Empty state ──────────────────────────────────────────────────────────
    if (!weekPlan && !weekPlanLoading) {
      return (
        <section className="p-4">
          <div className="mx-auto max-w-xl rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">Week Ahead</h2>
            <p className="mt-2 text-sm text-slate-600">
              Generate a full Monday–Friday plan based on your task library, this week&apos;s
              performance, and any deferred items.
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Planning for: week of {planWeekStartDate}
            </p>
            <button
              type="button"
              onClick={handleGenerateWeekPlan}
              disabled={!isFriday}
              className="mt-6 w-full rounded-md bg-slate-900 px-4 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              Generate Week Plan
            </button>
            {!isFriday && (
              <p className="mt-3 text-xs text-amber-700">
                Available on Fridays — come back then to plan next week.
              </p>
            )}
            {weekPlanMessage && (
              <p className="mt-3 text-xs text-rose-600">{weekPlanMessage}</p>
            )}
          </div>
        </section>
      )
    }

    // ── Loading state ────────────────────────────────────────────────────────
    if (weekPlanLoading || replanLoading) {
      return (
        <section className="p-4">
          <p className="mb-4 text-center text-sm font-medium text-slate-600">
            {replanLoading ? 'Replanning your week…' : 'Generating your week plan…'}
          </p>
          <div className="grid grid-cols-5 gap-3">
            {dayNames.map((d) => (
              <div key={d} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                <div className="mb-3 h-4 w-16 animate-pulse rounded bg-slate-200" />
                {[1, 2, 3].map((i) => (
                  <div key={i} className="mb-2 h-14 animate-pulse rounded bg-slate-100" />
                ))}
              </div>
            ))}
          </div>
        </section>
      )
    }

    const isPublished = weekPlan?.status === 'published' || weekPlan?.status === 'replanned'
    const isReplanning = weekPlan?.status === 'replanning'
    const isReviewing = weekPlan?.status === 'reviewing'
    const isDraft = !isPublished && !isReplanning && !isReviewing
    // Replan is available whenever calendar sync is on and a plan exists —
    // even if the plan status got reset to draft after a reload.
    const canReplan = !!session?.provider_token && !!weekPlan && !replanLoading && !isReplanning && !isReviewing

    // ── Draft / Published / Replanning state ─────────────────────────────────
    return (
      <section className="p-4">
        {/* Header bar */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Week Ahead</h2>
            <p className="text-xs text-slate-500">Week of {weekPlan?.weekStartDate}</p>
          </div>
          <div className="flex items-center gap-2">
            {isDraft && (
              <button
                type="button"
                onClick={handleGenerateWeekPlan}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Regenerate
              </button>
            )}
            {canReplan && (
              <button
                type="button"
                onClick={handleReplan}
                className="rounded-md border border-blue-300 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50"
              >
                Replan
              </button>
            )}
            {(isReplanning || isReviewing) && (
              <button
                type="button"
                onClick={handleApplyReplan}
                disabled={weekPlanLoading}
                className="rounded-md bg-blue-700 px-4 py-1.5 text-xs font-medium text-white disabled:opacity-50"
              >
                Apply Replan
              </button>
            )}
            {isDraft && (
              <button
                type="button"
                onClick={handlePublishWeekPlan}
                disabled={
                  weekPlanLoading ||
                  !dayNames.some((d) => (weekPlan?.days?.[d]?.tasks ?? []).length > 0)
                }
                className="rounded-md bg-slate-900 px-4 py-1.5 text-xs font-medium text-white disabled:opacity-40"
              >
                Publish to Calendar
              </button>
            )}
          </div>
        </div>

        {weekPlanMessage && (
          <p className="mb-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {weekPlanMessage}
          </p>
        )}

        {/* Conversational review panel — shown while user is making decisions */}
        {isReviewing && (
          <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50 p-4">
            <p className="mb-3 text-sm font-semibold text-blue-900">
              Here's what changed in your calendar this week:
            </p>

            {/* Confirmed moves — no action needed */}
            {(weekPlan.confirmedMoves ?? []).length > 0 && (
              <div className="mb-3">
                {(weekPlan.confirmedMoves ?? []).map((m, i) => (
                  <div key={i} className="mb-1 flex items-start gap-2 text-xs text-blue-800">
                    <span className="mt-0.5 text-blue-400">↪</span>
                    <span>
                      <span className="font-medium">{m.task.name}</span>
                      {' '}was moved from {m.fromDay} to {m.toDay} — noted.
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Resized tasks — no action needed */}
            {(weekPlan.resizedItems ?? []).length > 0 && (
              <div className="mb-3">
                {(weekPlan.resizedItems ?? []).map((r, i) => (
                  <div key={i} className="mb-1 flex items-start gap-2 text-xs text-blue-800">
                    <span className="mt-0.5 text-amber-500">⏱</span>
                    <span>
                      <span className="font-medium">{r.name}</span>
                      {' '}was adjusted to {r.to}m (was {r.from}m) — I'll use the new duration.
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Pending decisions — ask the user */}
            {(weekPlan.pendingDecisions ?? []).length > 0 && (
              <div className="mt-3 space-y-3 border-t border-blue-200 pt-3">
                <p className="text-xs font-semibold text-blue-900">
                  These tasks were removed — what should I do with them?
                </p>
                {(weekPlan.pendingDecisions ?? []).map((pd, i) => {
                  const choice = replanChoices[pd.task.templateId]
                  return (
                    <div key={i} className="rounded-lg border border-blue-200 bg-white p-3">
                      <p className="mb-2 text-xs font-medium text-slate-800">
                        <span className="mr-1 text-rose-400">✕</span>
                        <span className="font-semibold">{pd.task.name}</span>
                        <span className="ml-1 text-slate-400">
                          ({pd.task.estimateMinutes}m · {pd.task.timeBlock}) — removed from {pd.originalDay}
                        </span>
                      </p>
                      <p className="mb-2 text-[10px] text-slate-500">Should I reschedule it? If yes, when?</p>
                      <div className="flex flex-wrap gap-1.5">
                        {(weekPlan.remainingDays ?? []).map((d) => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => setReplanChoices((prev) => ({ ...prev, [pd.task.templateId]: d }))}
                            className={`rounded-md px-2.5 py-1 text-[10px] font-medium transition-colors ${
                              choice === d
                                ? 'bg-blue-700 text-white'
                                : 'border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            {d.slice(0, 3)}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => setReplanChoices((prev) => ({ ...prev, [pd.task.templateId]: 'drop' }))}
                          className={`rounded-md px-2.5 py-1 text-[10px] font-medium transition-colors ${
                            choice === 'drop'
                              ? 'bg-rose-600 text-white'
                              : 'border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100'
                          }`}
                        >
                          Drop it
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* No changes at all */}
            {(weekPlan.confirmedMoves ?? []).length === 0 &&
             (weekPlan.resizedItems ?? []).length === 0 &&
             (weekPlan.pendingDecisions ?? []).length === 0 && (
              <p className="text-xs text-blue-700 italic">No changes detected — your plan matches the calendar.</p>
            )}
          </div>
        )}

        {/* 5-column day grid */}
        <div className="grid grid-cols-5 gap-3">
          {dayNames.map((dayName, dayIdx) => {
            const dayData = (isReviewing ? weekPlan?.survivingDays : weekPlan?.days)?.[dayName] ?? { date: '', tasks: [] }
            const isPast = todayIndex >= 0 && dayIdx < todayIndex
            const isToday = dayIdx === todayIndex

            // Detect over-scheduled blocks
            const blockTotals = (dayData.tasks ?? []).reduce((acc, t) => {
              const blk = t.timeBlock ?? 'BD'
              acc[blk] = (acc[blk] ?? 0) + (t.estimateMinutes ?? 25)
              return acc
            }, {})
            const overScheduledBlocks = Object.entries(blockTotals)
              .filter(([blk, mins]) => mins > (BLOCK_CAPACITY_MINUTES[blk] ?? 999))
              .map(([blk, mins]) => `${blk} (${mins}m / ${BLOCK_CAPACITY_MINUTES[blk]}m cap)`)

            return (
              <div
                key={dayName}
                className={`rounded-xl border bg-white p-3 shadow-sm ${
                  isPast && isReplanning ? 'opacity-40' : ''
                } ${isToday ? 'border-blue-300' : 'border-slate-200'}`}
              >
                <p className={`mb-2 text-xs font-semibold ${isToday ? 'text-blue-700' : 'text-slate-700'}`}>
                  {dayName.slice(0, 3)}
                  {dayData.date && (
                    <span className="ml-1 font-normal text-slate-400">
                      {new Date(dayData.date + 'T12:00:00').getDate()}
                    </span>
                  )}
                  {isToday && <span className="ml-1 text-blue-500">·</span>}
                </p>
                {overScheduledBlocks.length > 0 && (
                  <div
                    className="mb-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[9px] text-amber-700"
                    title={`Over-scheduled: ${overScheduledBlocks.join(', ')}`}
                  >
                    ⚠ Over-scheduled — remove tasks before publishing:{' '}
                    {overScheduledBlocks.join(', ')}
                  </div>
                )}

                {(dayData.tasks ?? []).length === 0 ? (
                  <p className="text-[10px] text-slate-400 italic">No tasks</p>
                ) : (
                  <div className="space-y-1.5">
                    {(dayData.tasks ?? []).map((task, taskIdx) => (
                      <div
                        key={`${dayName}-${taskIdx}`}
                        className="relative rounded-md border border-slate-100 bg-slate-50 p-2 text-xs"
                      >
                        {!isPublished && !isReplanning && !(isPast && isReplanning) && (
                          <button
                            type="button"
                            onClick={() => handleRemoveTaskFromDraft(dayName, taskIdx)}
                            className="absolute right-1 top-1 text-slate-300 hover:text-rose-500"
                            aria-label="Remove task"
                          >
                            ×
                          </button>
                        )}
                        <div className="flex items-start gap-1.5 pr-3">
                          <span
                            className="mt-0.5 h-1.5 w-1.5 flex-shrink-0 rounded-full"
                            style={{ backgroundColor: trackColors[task.track] ?? '#94a3b8' }}
                          />
                          <span className="font-medium leading-tight text-slate-800">{task.name}</span>
                        </div>
                        <div className="mt-1 flex items-center gap-1">
                          <span className="rounded bg-slate-200 px-1 py-0.5 text-[9px] text-slate-600">
                            {task.timeBlock}
                          </span>
                          <span className="text-[9px] text-slate-400">{task.estimateMinutes}m</span>
                          {task.isDeferred && (
                            <span className="rounded bg-amber-100 px-1 py-0.5 text-[9px] font-medium text-amber-700">
                              Deferred
                            </span>
                          )}
                          {task.gcalEventId && (
                            <span className="text-[9px] text-emerald-600">📅</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Rationale collapsible */}
        {weekPlan?.aiRationale && (() => {
          let r = null
          try { r = JSON.parse(weekPlan.aiRationale) } catch { /* plain string fallback */ }
          return (
            <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <button
                type="button"
                onClick={() => setShowAiRationale((v) => !v)}
                className="flex w-full items-center justify-between text-xs font-medium text-slate-700"
              >
                <span>Why this plan?</span>
                <span className="text-slate-400">{showAiRationale ? '▲' : '▼'}</span>
              </button>
              {showAiRationale && (
                <div className="mt-3 space-y-3 text-xs text-slate-600">
                  {r ? (
                    <>
                      {/* Initial draft plan rationale */}
                      {r.summary && (
                        <>
                          <p>{r.summary}</p>
                          {r.deferred?.length > 0 && (
                            <div>
                              <p className="mb-1 font-semibold text-slate-700">Carried over from reschedule queue</p>
                              <ul className="space-y-0.5 pl-3">
                                {r.deferred.map((name, i) => (
                                  <li key={i} className="flex items-start gap-1.5">
                                    <span className="mt-0.5 text-amber-400">⟳</span>
                                    <span>{name}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {r.note && <p className="text-slate-400 italic">{r.note}</p>}
                        </>
                      )}
                      {/* Replan rationale */}
                      {r.noChanges && (
                        <p className="text-slate-500 italic">No changes detected in your calendar — plan is unchanged.</p>
                      )}
                      {r.rescheduled?.length > 0 && (
                        <div>
                          <p className="mb-1 font-semibold text-slate-700">Rescheduled</p>
                          <ul className="space-y-0.5 pl-3">
                            {r.rescheduled.map((item, i) => (
                              <li key={i} className="flex items-start gap-1.5">
                                <span className="mt-0.5 text-blue-400">↪</span>
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {r.dropped?.length > 0 && (
                        <div>
                          <p className="mb-1 font-semibold text-slate-700">Could not reschedule</p>
                          <ul className="space-y-0.5 pl-3">
                            {r.dropped.map((item, i) => (
                              <li key={i} className="flex items-start gap-1.5">
                                <span className="mt-0.5 text-rose-400">✕</span>
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {r.resized?.length > 0 && (
                        <div>
                          <p className="mb-1 font-semibold text-slate-700">Duration adjusted</p>
                          <ul className="space-y-0.5 pl-3">
                            {r.resized.map((item, i) => (
                              <li key={i} className="flex items-start gap-1.5">
                                <span className="mt-0.5 text-amber-400">⏱</span>
                                <span>
                                  {item.name}
                                  <span className="ml-1 text-slate-400">{item.from}m → {item.to}m</span>
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="leading-relaxed">{weekPlan.aiRationale}</p>
                  )}
                </div>
              )}
            </div>
          )
        })()}
      </section>
    )
  }

  function renderRescheduleScreen() {
    const pendingQueue = rescheduleQueue.filter((q) => q.status === 'pending')
    const reorderableTasks = todayTasks.filter((t) => {
      const s = sessions[t.id]
      return s && s.timerState === TIMER_STATES.notStarted
    })

    function handleDragEnd(event) {
      const { active, over } = event
      if (!over || active.id === over.id) return
      const oldIndex = reorderableTasks.findIndex((t) => t.id === active.id)
      const newIndex = reorderableTasks.findIndex((t) => t.id === over.id)
      const reordered = arrayMove(reorderableTasks, oldIndex, newIndex)
      const reorderIds = reordered.map((t) => t.id)
      setTodayTasks((prev) => {
        const nonReorderable = prev.filter((t) => !reorderIds.includes(t.id))
        return [...reordered, ...nonReorderable]
      })
    }

    const reasonLabel = { overrun: 'Overrun', cancelled: 'Cancelled', partial: 'Partially done' }

    return (
      <section className="space-y-4 p-4">
        {/* Needs Rescheduling */}
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <AlertTriangle size={16} className="text-rose-500" />
            <h2 className="text-sm font-semibold uppercase text-slate-500">Needs Rescheduling</h2>
          </div>
          {pendingQueue.length === 0 ? (
            <p className="text-sm text-slate-500">No tasks need rescheduling right now.</p>
          ) : (
            <ul className="space-y-3">
              {pendingQueue.map((item) => {
                const meta = getTrackMeta(item.track)
                return (
                  <li key={item.id} className="rounded-lg border border-rose-200 bg-rose-50 p-3">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: meta?.color }} />
                      <p className="font-medium text-sm text-slate-900">{item.taskName}</p>
                      <span className="ml-auto rounded-full bg-rose-200 px-2 py-0.5 text-[10px] font-semibold text-rose-800">
                        {reasonLabel[item.reason] ?? item.reason}
                      </span>
                    </div>
                    <p className="mb-2 text-xs text-slate-600">
                      {item.timeBlock} block
                      {item.remainingMinutes ? ` · ${item.remainingMinutes} min remaining` : ''}
                    </p>
                    <div className="mb-2 rounded-md border border-rose-200 bg-white px-2 py-1.5 text-xs text-slate-700">
                      <span className="font-medium">Suggested:</span> Move to {item.suggestedTimeBlock} block on{' '}
                      <span className="font-medium">{formatDate(item.suggestedDate)}</span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleConfirmReschedule(item.id)}
                        className="rounded-md bg-slate-900 px-3 py-1 text-xs font-medium text-white"
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDismissReschedule(item.id)}
                        className="rounded-md border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600"
                      >
                        Dismiss
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </article>

        {/* AI Suggestion */}
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-purple-500" />
              <h2 className="text-sm font-semibold uppercase text-slate-500">AI Chief of Staff</h2>
            </div>
            <button
              type="button"
              onClick={handleFetchAiSuggestion}
              disabled={aiSuggestion.loading}
              className="rounded-md bg-purple-600 px-3 py-1 text-xs font-medium text-white disabled:bg-purple-300"
            >
              {aiSuggestion.loading ? 'Thinking...' : 'Get Suggestion'}
            </button>
          </div>
          {aiSuggestion.error ? (
            <p className="rounded-md bg-rose-50 p-3 text-sm text-rose-700">{aiSuggestion.error}</p>
          ) : aiSuggestion.text ? (
            <div className="rounded-lg border border-purple-200 bg-purple-50 p-3 text-sm text-purple-900">
              {aiSuggestion.text}
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              {pendingQueue.length > 0
                ? 'Click "Get Suggestion" and your AI Chief of Staff will recommend the best reorder.'
                : 'No pending items to analyze. Cancel or partially complete a task to get AI guidance.'}
            </p>
          )}
        </article>

        {/* Drag to Reorder */}
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <Clock size={16} className="text-slate-500" />
            <h2 className="text-sm font-semibold uppercase text-slate-500">Reorder Today's Remaining Tasks</h2>
          </div>
          {reorderableTasks.length === 0 ? (
            <p className="text-sm text-slate-500">No unstarted tasks left to reorder.</p>
          ) : (
            <>
              <p className="mb-3 text-xs text-slate-500">Drag tasks into the order you want to work through them.</p>
              <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={reorderableTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                  <ul className="space-y-2">
                    {reorderableTasks.map((task) => (
                      <SortableTaskRow
                        key={task.id}
                        task={task}
                        session={sessions[task.id]}
                        trackMeta={getTrackMeta(task.track)}
                      />
                    ))}
                  </ul>
                </SortableContext>
              </DndContext>
            </>
          )}
        </article>

        {/* Confirmed / Deferred */}
        {deferredTasks.length > 0 ? (
          <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase text-slate-500">Deferred to Future Days</h2>
              <button
                type="button"
                onClick={handleClearDeferred}
                className="text-xs text-slate-400 underline"
              >
                Clear all
              </button>
            </div>
            <ul className="space-y-2">
              {deferredTasks.map((item) => {
                const meta = getTrackMeta(item.track)
                return (
                  <li key={item.id} className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                    <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: meta?.color }} />
                    <span className="flex-1 font-medium">{item.taskName}</span>
                    <span className="text-xs text-slate-500">{formatDate(item.suggestedDate)}</span>
                  </li>
                )
              })}
            </ul>
          </article>
        ) : null}
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

      {/* ── Ventures Session Accountability Modal ──────────────────────── */}
      {showVenturesModal && venturesModalData ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="bg-[#6B3FA0] px-6 py-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-purple-200">
                Kuperman Ventures
              </p>
              <h2 className="mt-1 text-xl font-bold text-white">Session Accountability</h2>
            </div>
            <div className="space-y-5 p-6">
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-purple-700">
                  You said you would:
                </p>
                <blockquote className="border-l-4 border-purple-400 pl-4 text-sm text-slate-700 leading-relaxed">
                  {venturesModalData.session.definitionOfDone}
                </blockquote>
              </div>
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                  What actually happened:
                </p>
                <blockquote className="border-l-4 border-slate-300 pl-4 text-sm text-slate-700 leading-relaxed">
                  {venturesModalData.session.actualCompleted || '(no note recorded)'}
                </blockquote>
              </div>
              {venturesModalData.session.definitionOfDone.trim().toLowerCase() !==
                venturesModalData.session.actualCompleted.trim().toLowerCase() ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                  <p className="text-sm font-semibold text-amber-800">
                    These don't match — note the gap for your Friday Review.
                  </p>
                </div>
              ) : null}
            </div>
            <div className="px-6 pb-6">
              <button
                type="button"
                onClick={() => setShowVenturesModal(false)}
                className="w-full rounded-lg bg-[#6B3FA0] py-3 text-sm font-bold text-white hover:bg-purple-800"
              >
                Acknowledged
              </button>
            </div>
          </div>
        </div>
      ) : null}

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
          <div>
            <h1 className="text-xl font-semibold">Chief of Staff</h1>
            <p className="text-sm text-slate-600">{activeScreenLabel}</p>
          </div>
          <div className="flex items-center gap-2 text-xs sm:text-sm">
            {session?.provider_token ? (
              <span className="rounded-md bg-emerald-50 px-2 py-1 text-emerald-700 font-medium">
                📅 Calendar sync on
              </span>
            ) : supabaseConfigured && session ? (
              <span className="rounded-md bg-amber-50 px-2 py-1 text-amber-700">
                Calendar sync off
              </span>
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

          <div className="mb-4 grid grid-cols-2 gap-3 rounded-lg bg-slate-100 p-3 text-sm sm:grid-cols-4">
            <div>
              <p className="text-xs text-slate-500">Time Block</p>
              <p className="font-medium">{activeTask.timeBlock}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Completion Type</p>
              <p className="font-medium">{activeTask.completionType}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Estimate</p>
              <p className="font-medium">{formatDuration(activeSession.estimateSeconds)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">State</p>
              <p className="font-medium">{activeSession.timerState}</p>
            </div>
          </div>

          <div
            className={`mb-4 rounded-xl p-4 text-center ${
              isOverrun ? 'bg-red-100 text-red-700' : 'bg-slate-900 text-white'
            }`}
          >
            <p className="text-xs uppercase tracking-wide">{timerLabel}</p>
            <p className="text-4xl font-semibold tabular-nums">{remainingOrOverrun}</p>
          </div>

          {activeTask.subtasks?.length > 0 ? (
            <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="mb-2 text-sm font-medium text-slate-700">Steps</p>
              <ul className="space-y-2">
                {activeTask.subtasks.map((step, index) => {
                  const checked = activeSession.subtaskChecks?.[index] ?? false
                  const frozen = isCompleted || isCancelled
                  return (
                    <li key={index} className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        id={`subtask-${activeTask.id}-${index}`}
                        checked={checked}
                        onChange={() => handleToggleSubtask(index)}
                        disabled={frozen}
                        className="mt-0.5 h-4 w-4 flex-shrink-0 accent-slate-900 disabled:cursor-not-allowed"
                      />
                      <label
                        htmlFor={`subtask-${activeTask.id}-${index}`}
                        className={`text-sm leading-snug ${
                          checked ? 'text-slate-400 line-through' : 'text-slate-700'
                        } ${frozen ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                      >
                        {step}
                      </label>
                    </li>
                  )
                })}
              </ul>
              <p className="mt-2 text-[11px] text-slate-400">
                {(activeSession.subtaskChecks ?? []).filter(Boolean).length} of {activeTask.subtasks.length} steps done
              </p>
            </div>
          ) : null}

          {activeTask.requiresDefinitionOfDone ? (
            <div className="mb-4 rounded-lg border border-purple-200 bg-purple-50 p-3">
              <label className="mb-1 block text-sm font-medium">
                Definition of done (required for Encore OS, min 10 words)
              </label>
              <textarea
                value={definitionInput}
                onChange={(event) => setDefinitionInput(event.target.value)}
                rows={3}
                className="w-full rounded-md border border-purple-200 bg-white p-2 text-sm outline-none ring-purple-300 focus:ring-2"
                placeholder="Example: Ship mobile navigation polish with tested timer state transitions and complete overrun prompt behavior."
                disabled={
                  activeSession.timerState !== TIMER_STATES.notStarted &&
                  activeSession.timerState !== TIMER_STATES.paused
                }
              />
              <p className="mt-1 text-xs text-purple-700">Current word count: {definitionWords}</p>
            </div>
          ) : null}

          <div className="mb-4 grid gap-2 sm:grid-cols-4">
            <button
              type="button"
              className="flex items-center justify-center gap-1 rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-emerald-300"
              onClick={handleStart}
              disabled={isCompleted || isCancelled}
            >
              <Play size={16} /> Start / Resume
            </button>
            <button
              type="button"
              className="flex items-center justify-center gap-1 rounded-md bg-amber-500 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-amber-200"
              onClick={handlePause}
              disabled={
                isCompleted ||
                isCancelled ||
                (activeSession.timerState !== TIMER_STATES.running &&
                  activeSession.timerState !== TIMER_STATES.overrun)
              }
            >
              <Pause size={16} /> Pause
            </button>
            <button
              type="button"
              className="flex items-center justify-center gap-1 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-blue-300"
              onClick={() => handleComplete(false)}
              disabled={isCompleted || isCancelled || activeSession.timerState === TIMER_STATES.notStarted}
            >
              <SquareCheck size={16} /> Complete
            </button>
            <button
              type="button"
              className="flex items-center justify-center gap-1 rounded-md bg-rose-600 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-rose-300"
              onClick={handleCancel}
              disabled={isCompleted || isCancelled || activeSession.timerState === TIMER_STATES.notStarted}
            >
              <StopCircle size={16} /> Cancel
            </button>
          </div>
          <div className="mb-4">
            <button
              type="button"
              className="flex w-full items-center justify-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 disabled:cursor-not-allowed disabled:opacity-40"
              onClick={() => handleComplete(true)}
              disabled={isCompleted || isCancelled || activeSession.timerState === TIMER_STATES.notStarted}
            >
              Mark Partial — done for now, reschedule remainder
            </button>
          </div>

          <div className="mb-4 grid gap-2 rounded-lg bg-slate-100 p-3 text-xs sm:grid-cols-2 lg:grid-cols-3">
            <p>Pause count: {activeSession.pauseCount}</p>
            <p>Pause duration: {formatDuration(pauseDurationSeconds)}</p>
            <p>Cancelled time: {formatDuration(activeSession.cancelledSeconds)}</p>
            <p>Overrun time: {formatDuration(overrunSeconds)}</p>
            <p>Time saved: {formatDuration(timeSavedSeconds)}</p>
            <p>Elapsed: {formatDuration(activeSession.elapsedSeconds)}</p>
          </div>

          {isOverrun ? (
            <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">
              You've used your allotted time for {activeTask.name}. Complete it now, or reschedule
              the remainder.
            </div>
          ) : null}

          <div className="rounded-lg border border-slate-200 p-3">
            <label className="mb-1 block text-sm font-medium">What was actually completed?</label>
            <textarea
              value={completionInput}
              onChange={(event) => setCompletionInput(event.target.value)}
              rows={3}
              className="w-full rounded-md border border-slate-300 p-2 text-sm outline-none ring-blue-300 focus:ring-2"
              placeholder="Short completion summary..."
              disabled={isCompleted || isCancelled}
            />

            {activeTask.completionType === 'Done + Outcome' ? (
              <div className="mt-3">
                <p className="mb-2 text-sm font-medium">
                  {activeTask.outcomePrompt ?? 'Did this task generate the intended outcome?'}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className={`rounded-md px-3 py-1 text-sm ${
                      outcomeSelection === true
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                    onClick={() => setOutcomeSelection(true)}
                    disabled={isCompleted || isCancelled}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    className={`rounded-md px-3 py-1 text-sm ${
                      outcomeSelection === false
                        ? 'bg-rose-600 text-white'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                    onClick={() => setOutcomeSelection(false)}
                    disabled={isCompleted || isCancelled}
                  >
                    No
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          {statusMessage ? (
            <p className="mt-3 rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-700">
              {statusMessage}
            </p>
          ) : null}

          {isCompleted && activeTask.requiresDefinitionOfDone && !showVenturesModal ? (
            <div className="mt-4 rounded-lg border border-purple-200 bg-purple-50 px-3 py-2 text-xs text-purple-700">
              Session recap recorded — open a new Ventures session to review in the modal.
            </div>
          ) : null}
        </article>
        ) : (
        <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          {clearedDates.includes(getTodayDateString()) ? (
            <>
              <h2 className="text-lg font-semibold text-slate-500">No tasks scheduled</h2>
              <p className="mt-2 text-sm text-slate-500">
                This day was manually cleared. Click Deploy in the Task Library if your plans changed.
              </p>
            </>
          ) : (
            <>
              <h2 className="text-lg font-semibold">No Today tasks deployed yet</h2>
              <p className="mt-2 text-sm text-slate-600">
                Go to Task Library and click &quot;Deploy Active Tasks to Today&quot; to create today&apos;s task instances.
              </p>
            </>
          )}
        </article>
        )}

        <aside className="space-y-4">
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase text-slate-500">Today Queue</h3>
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
            </div>
            <p className="mb-2 text-xs text-slate-500">
              Snapshot deployed: {new Date(lastDeploymentAt).toLocaleString()}
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
          </section>
        </aside>
      </section>
      ) : null}
      {activeScreen === 'taskLibrary' ? renderTaskLibrary() : null}
      {activeScreen === 'reschedule' ? renderRescheduleScreen() : null}
      {activeScreen === 'weekAhead' ? renderWeekAhead() : null}
      {activeScreen === 'kpi' ? renderKpiDashboard() : null}
      {activeScreen === 'analytics' ? renderAnalyticsScreen() : null}

      <nav className="fixed bottom-0 left-0 right-0 border-t border-slate-200 bg-white">
        <ul className="mx-auto grid max-w-5xl grid-cols-6 gap-1 p-2 text-center text-xs sm:text-sm">
          {NAV_ITEMS.map((item) => {
            const pendingCount = item.id === 'reschedule'
              ? rescheduleQueue.filter((q) => q.status === 'pending').length
              : 0
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => setActiveScreen(item.id)}
                  className={`relative block w-full rounded-md px-1 py-2 ${
                    item.id === activeScreen
                      ? 'bg-slate-900 font-semibold text-white'
                      : 'text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  {item.label}
                  {pendingCount > 0 ? (
                    <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white">
                      {pendingCount}
                    </span>
                  ) : null}
                </button>
              </li>
            )
          })}
        </ul>
      </nav>
    </main>
  )
}

export default App
