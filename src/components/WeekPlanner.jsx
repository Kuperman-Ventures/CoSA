import { useCallback, useEffect, useMemo, useState } from 'react'
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { AlertTriangle, ChevronDown, ChevronRight, RefreshCw, X } from 'lucide-react'
import {
  upsertWeeklyPlan,
  updatePlanAfterPublish,
  replaceTodayTasks,
  loadCalendarEventTags,
  upsertCalendarEventTag,
} from '../lib/supabaseSync'
import { createWeekPlanEvents, fetchCoSACalendarEvents, fetchPersonalCalendarEvents, BLOCK_CAPACITY_MINUTES } from '../lib/googleCalendar'

// ─── Constants ───────────────────────────────────────────────────────────────

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

const TRACK_LABELS = {
  advisors:   'Kuperman Advisors',
  jobSearch:  'Job Search',
  ventures:   'Kuperman Ventures',
  cosaAdmin:  'CoSA Administration',
  networking: 'Shared (Networking)',
}

const TRACK_COLORS = {
  advisors:   '#1E6B3C',
  jobSearch:  '#2E75B6',
  ventures:   '#9B6BAE',
  cosaAdmin:  '#0891b2',
  networking: '#B8600B',
}

const TRACK_BG = {
  advisors:   'bg-emerald-50 border-emerald-200',
  jobSearch:  'bg-blue-50 border-blue-200',
  ventures:   'bg-purple-50 border-purple-200',
  cosaAdmin:  'bg-cyan-50 border-cyan-200',
  networking: 'bg-orange-50 border-orange-200',
}

const SUB_TRACK_TARGETS = {
  advisors: {
    weekly: 960,
    subTracks: { 'Business Development': 480, 'Materials': 192, 'Content': 96, 'Meetings': 192 },
  },
  jobSearch: {
    weekly: 960,
    subTracks: { 'Networking': 288, 'Searching': 144, 'Applications': 288, 'L&D': 96, 'Boards': 48, 'Admin': 48, 'Other': 48 },
  },
  ventures: {
    weekly: 480,
    subTracks: { 'Alpha': 144, 'Growth': 120, 'Product': 72, 'Research': 48, 'Subscription': 48, 'Build': 72 },
  },
  cosaAdmin: {
    weekly: 120,
    subTracks: { 'Friday Review': 120 },
  },
  networking: {
    weekly: 120,
    subTracks: {},
  },
}

// Block start hours (24h decimal) for Calendar tab
const BLOCK_START_HOUR = {
  'BD': 9.5,
  'Networking': 11,
  'Job Search': 13,
  'Encore OS': 14,
  'Friday': 14,
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getTodayDateString() {
  return new Date().toISOString().slice(0, 10)
}

function getWeekStartDateStr(date = new Date()) {
  const d = new Date(date)
  const day = d.getDay()
  const daysToMonday = day === 0 ? 6 : day - 1
  d.setDate(d.getDate() - daysToMonday)
  d.setHours(0, 0, 0, 0)
  return d.toISOString().split('T')[0]
}

function getDayDate(weekStartDateStr, dayName) {
  const offsets = { Monday: 0, Tuesday: 1, Wednesday: 2, Thursday: 3, Friday: 4 }
  const d = new Date(weekStartDateStr + 'T12:00:00')
  d.setDate(d.getDate() + (offsets[dayName] ?? 0))
  return d.toISOString().split('T')[0]
}

function normaliseTrack(raw) {
  if (!raw) return null
  if (raw === 'CoSA Administration' || raw === 'cosaAdmin') return 'cosaAdmin'
  if (raw === 'Shared (Networking)') return 'networking'
  return raw
}

function planTaskFromLib(libTask) {
  return {
    id: `plan-${libTask.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    templateId: libTask.id,
    name: libTask.name,
    timeBlock: libTask.timeBlock,
    estimateMinutes: libTask.defaultTimeEstimate ?? 25,
    track: libTask.track,
    subTrack: libTask.subTrack ?? null,
    gcalEventId: null,
  }
}

function healthColor(assigned, target) {
  if (target === 0) return 'green'
  const pct = assigned / target
  if (pct >= 0.9) return 'green'
  if (pct >= 0.75) return 'yellow'
  return 'red'
}

function healthBarClass(color) {
  if (color === 'green') return 'bg-emerald-500'
  if (color === 'yellow') return 'bg-amber-400'
  return 'bg-red-500'
}

function healthTextClass(color) {
  if (color === 'green') return 'text-emerald-700'
  if (color === 'yellow') return 'text-amber-700'
  return 'text-red-700'
}

// ─── Draggable task card ──────────────────────────────────────────────────────

function DraggableCard({ id, children, className = '', disabled = false }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id, disabled })
  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
    : undefined
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(disabled ? {} : listeners)}
      {...(disabled ? {} : attributes)}
      className={`${className} ${isDragging ? 'opacity-30' : ''} ${disabled ? 'cursor-not-allowed' : 'cursor-grab active:cursor-grabbing'}`}
    >
      {children}
    </div>
  )
}

// ─── Droppable zone ───────────────────────────────────────────────────────────

function DroppableZone({ id, children, className = '' }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div
      ref={setNodeRef}
      className={`${className} transition-colors ${isOver ? 'ring-2 ring-blue-400 ring-inset' : ''}`}
    >
      {children}
    </div>
  )
}

// ─── Bin task card (shows sub-track tally, locks when full) ──────────────────

function BinTaskCard({ task, trackColor, allocated, target, isFull, shaking = false }) {
  const pct = target > 0 ? Math.min((allocated / target) * 100, 100) : 0
  const isOver = target > 0 && allocated > target
  return (
    <div
      className={`rounded-md border bg-white px-2 py-1.5 text-xs shadow-sm select-none
        ${shaking ? 'animate-shake' : ''}
        ${isFull ? 'opacity-50' : ''}`}
      style={{ borderLeftColor: isFull ? '#94a3b8' : trackColor, borderLeftWidth: 3 }}
    >
      <div className="flex items-center justify-between gap-1">
        <span className={`font-medium leading-tight truncate ${isFull ? 'text-slate-400' : 'text-slate-700'}`}>
          {task.name}
        </span>
        {isFull && (
          <span className="ml-1 shrink-0 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700 whitespace-nowrap">
            ✓ Full
          </span>
        )}
      </div>
      <div className="mt-0.5 text-slate-400">
        <span>{task.defaultTimeEstimate ?? 25}m</span>
        {task.subTrack && <span> · {task.subTrack}</span>}
      </div>
      {target > 0 && (
        <div className="mt-1">
          <div className="h-1 rounded-full bg-slate-100 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${isOver ? 'bg-amber-400' : isFull ? 'bg-emerald-500' : 'bg-blue-400'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className={`mt-0.5 text-[9px] ${isOver ? 'text-amber-600' : isFull ? 'text-emerald-600' : 'text-slate-400'}`}>
            {allocated}m / {target}m{isOver ? ' — over' : ''}
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Grid task card (inline minute edit, removable) ──────────────────────────

function TaskCard({ task, trackColor, onRemove, onEditMinutes, shaking = false }) {
  const [editing, setEditing] = useState(false)
  const [editVal, setEditVal] = useState(String(task.estimateMinutes ?? 25))

  function commitEdit() {
    const n = parseInt(editVal, 10)
    if (!isNaN(n) && n > 0 && n !== task.estimateMinutes) onEditMinutes?.(n)
    setEditing(false)
  }

  return (
    <div
      className={`rounded-md border bg-white px-2 py-1.5 text-xs shadow-sm select-none mb-1
        ${shaking ? 'animate-shake' : ''}`}
      style={{ borderLeftColor: trackColor, borderLeftWidth: 3 }}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="font-medium leading-tight text-slate-700 truncate">{task.name}</span>
        {onRemove && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onRemove() }}
            className="ml-1 shrink-0 text-slate-300 hover:text-rose-500"
            title="Remove instance"
          >
            <X size={11} />
          </button>
        )}
      </div>
      <div className="mt-0.5 flex items-center gap-1 text-slate-400">
        {editing ? (
          <input
            type="number"
            min={1}
            max={240}
            value={editVal}
            onChange={(e) => setEditVal(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditing(false) }}
            className="w-12 rounded border border-blue-300 px-1 py-0 text-xs text-slate-700 outline-none focus:ring-1 focus:ring-blue-400"
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setEditing(true); setEditVal(String(task.estimateMinutes ?? 25)) }}
            className="rounded px-0.5 hover:bg-blue-50 hover:text-blue-600 transition-colors"
            title="Click to edit duration"
          >
            {task.estimateMinutes ?? 25}m
          </button>
        )}
        {task.subTrack && <span>· {task.subTrack}</span>}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function WeekPlanner({
  weekPlan,
  setWeekPlan,
  taskLibrary,
  session,
  gcalToken,
  rescheduleQueue,
  supabaseConfigured,
  onTriggerReplan,
  onPublishComplete,
}) {
  const [activeTab, setActiveTab] = useState('assign')
  const [planDays, setPlanDays] = useState(() => weekPlan?.days ?? {})
  const [flags, setFlags] = useState([])
  const [activeDragTask, setActiveDragTask] = useState(null)
  const [rejectedId, setRejectedId] = useState(null)
  const [expandedSubTracks, setExpandedSubTracks] = useState({ advisors: true, jobSearch: true, ventures: true })
  const [collapsedTracks, setCollapsedTracks] = useState({})
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [message, setMessage] = useState('')
  const [clearConfirm, setClearConfirm] = useState(false)
  const [calendarDiff, setCalendarDiff] = useState(null)
  const [fetchedCalEvents, setFetchedCalEvents] = useState(null) // raw CoSA GCal events after sync
  const [fetchedPersonalEvents, setFetchedPersonalEvents] = useState(null) // raw primary calendar events
  const [syncingCalendar, setSyncingCalendar] = useState(false)
  const [highlightedTemplateIds, setHighlightedTemplateIds] = useState(new Set())
  // Personal calendar event tagging
  const [eventTags, setEventTags] = useState({}) // { [gcalEventId]: { track, subTrack, title, durationMin, date } }
  const [tagModalEvent, setTagModalEvent] = useState(null) // event open in tag modal
  const [tagModalTrack, setTagModalTrack] = useState('')
  const [tagModalSubTrack, setTagModalSubTrack] = useState('')
  const [tagModalSaving, setTagModalSaving] = useState(false)

  // Sync planDays when weekPlan changes externally
  useEffect(() => {
    setPlanDays(weekPlan?.days ?? {})
  }, [weekPlan])

  const weekStartDate = weekPlan?.weekStartDate ?? getWeekStartDateStr()
  // Prefer the persistent gcalToken (survives Supabase session refreshes) over
  // session.provider_token which goes null after the first Supabase JWT refresh.
  const providerToken = gcalToken ?? session?.provider_token ?? null
  const userId = session?.user?.id ?? null

  // Load saved event tags from Supabase on mount / user change
  useEffect(() => {
    if (!userId) return
    loadCalendarEventTags(userId).then((tags) => {
      if (tags && Object.keys(tags).length > 0) setEventTags(tags)
    })
  }, [userId])

  // Auto-sync from Google Calendar when the Calendar tab opens.
  // This ensures the Calendar view always reflects the live GCal state without
  // requiring a manual "Sync" click, and patches planDays so the Assign tab
  // stays in sync with whatever the user changed in Google Calendar.
  useEffect(() => {
    if (activeTab === 'calendar' && providerToken && !syncingCalendar && !fetchedCalEvents) {
      handleSyncCalendar()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, providerToken])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  // ── Allocation computation — draft plan ──────────────────────────────────

  const allocations = useMemo(() => {
    const trackTotals = { advisors: 0, jobSearch: 0, ventures: 0, cosaAdmin: 0 }
    const subTrackTotals = {}
    for (const dayData of Object.values(planDays)) {
      for (const task of dayData?.tasks ?? []) {
        const lib = taskLibrary.find((t) => t.id === task.templateId)
        const track = normaliseTrack(lib?.track ?? task.track)
        if (!track || trackTotals[track] === undefined) continue
        trackTotals[track] = (trackTotals[track] ?? 0) + (task.estimateMinutes ?? 0)
        const key = `${track}::${lib?.subTrack ?? task.subTrack ?? 'Other'}`
        subTrackTotals[key] = (subTrackTotals[key] ?? 0) + (task.estimateMinutes ?? 0)
      }
    }
    return { trackTotals, subTrackTotals }
  }, [planDays, taskLibrary])

  // ── Allocation computation — live Google Calendar data ───────────────────
  // When fetchedCalEvents is available (after Sync), derive allocations from
  // actual GCal event durations + cosaTemplateId → subTrack lookup.
  // This replaces draft-plan allocations so the tracker matches the calendar.

  const calAllocations = useMemo(() => {
    const hasCoSAData = fetchedCalEvents && fetchedCalEvents.length > 0
    const hasTaggedData = Object.keys(eventTags).length > 0
    if (!hasCoSAData && !hasTaggedData) return null

    const trackTotals = { advisors: 0, jobSearch: 0, ventures: 0, cosaAdmin: 0 }
    const subTrackTotals = {}

    // CoSA calendar events (from sync)
    for (const ev of fetchedCalEvents ?? []) {
      const templateId = ev.extendedProperties?.private?.cosaTemplateId
      if (!templateId) continue
      const lib = taskLibrary.find((t) => t.id === templateId)
      if (!lib) continue
      const track = normaliseTrack(lib.track)
      if (!track || trackTotals[track] === undefined) continue
      const durationMin =
        ev.start?.dateTime && ev.end?.dateTime
          ? Math.round((new Date(ev.end.dateTime) - new Date(ev.start.dateTime)) / 60000)
          : 0
      if (durationMin <= 0) continue
      trackTotals[track] = (trackTotals[track] ?? 0) + durationMin
      const subTrack = lib.subTrack ?? null
      if (subTrack) {
        const key = `${track}::${subTrack}`
        subTrackTotals[key] = (subTrackTotals[key] ?? 0) + durationMin
      }
    }

    // Tagged personal calendar events (from user assignments)
    for (const tag of Object.values(eventTags)) {
      const track = normaliseTrack(tag.track)
      if (!track || trackTotals[track] === undefined) continue
      const durationMin = tag.durationMin ?? 0
      if (durationMin <= 0) continue
      trackTotals[track] = (trackTotals[track] ?? 0) + durationMin
      if (tag.subTrack) {
        const key = `${track}::${tag.subTrack}`
        subTrackTotals[key] = (subTrackTotals[key] ?? 0) + durationMin
      }
    }

    return { trackTotals, subTrackTotals }
  }, [fetchedCalEvents, eventTags, taskLibrary])

  // ── Task bin — always shows all active tasks ──────────────────────────────

  const binTasks = useMemo(
    () => taskLibrary.filter((t) => t.status === 'Active'),
    [taskLibrary],
  )

  const binByTrack = useMemo(() => {
    const groups = {}
    for (const track of Object.keys(TRACK_LABELS)) groups[track] = []
    for (const task of binTasks) {
      const t = normaliseTrack(task.track)
      if (t && groups[t]) groups[t].push(task)
    }
    return groups
  }, [binTasks])

  // Sub-tracks that have hit or exceeded their weekly target
  const fullSubTracks = useMemo(() => {
    const full = new Set()
    for (const [track, data] of Object.entries(SUB_TRACK_TARGETS)) {
      for (const [sub, target] of Object.entries(data.subTracks)) {
        const assigned = allocations.subTrackTotals[`${track}::${sub}`] ?? 0
        if (assigned >= target) full.add(`${track}::${sub}`)
      }
    }
    return full
  }, [allocations])

  // ── DnD logic ─────────────────────────────────────────────────────────────

  function handleDragStart({ active }) {
    // Bin drags use the library task id (e.g. 'lib-v2-advisors-1')
    // Grid drags use the instance id (e.g. 'plan-lib-v2-advisors-1-...')
    const libTask = taskLibrary.find((t) => t.id === active.id)
    if (libTask) { setActiveDragTask({ ...libTask, _source: 'bin' }); return }
    for (const [dayName, dayData] of Object.entries(planDays)) {
      const placed = (dayData?.tasks ?? []).find((t) => t.id === active.id)
      if (placed) { setActiveDragTask({ ...placed, _source: 'grid', _fromDay: dayName }); return }
    }
  }

  function handleDragEnd({ active, over }) {
    setActiveDragTask(null)
    if (!over) return

    const overId = over.id // 'bin' | `${dayName}::${block}`

    // Dropping a grid instance back on the bin — remove that instance
    if (overId === 'bin') {
      if (activeDragTask?._source === 'grid') {
        const fromDay = activeDragTask._fromDay
        setPlanDays((prev) => ({
          ...prev,
          [fromDay]: {
            ...prev[fromDay],
            tasks: (prev[fromDay]?.tasks ?? []).filter((t) => t.id !== active.id),
          },
        }))
      }
      // Bin→bin drop: ignore
      return
    }

    // overId is now just a dayName (Monday / Tuesday / …)
    const dayName = overId
    if (!DAY_NAMES.includes(dayName)) return

    const sourceIsGrid = activeDragTask?._source === 'grid'
    const fromDay = activeDragTask?._fromDay

    if (sourceIsGrid) {
      // ── Move an existing instance to a different day ──
      const movedTask = { ...activeDragTask } // keep original timeBlock
      setPlanDays((prev) => {
        const dayDate = prev[dayName]?.date ?? getDayDate(weekStartDate, dayName)
        let next = { ...prev }
        // Remove from old day
        if (fromDay) {
          next = {
            ...next,
            [fromDay]: {
              ...next[fromDay],
              tasks: (next[fromDay]?.tasks ?? []).filter((t) => t.id !== active.id),
            },
          }
        }
        // Add to new day (avoid duplicate if same day/same id)
        const existing = (next[dayName]?.tasks ?? []).filter((t) => t.id !== active.id)
        return {
          ...next,
          [dayName]: { date: dayDate, tasks: [...existing, movedTask] },
        }
      })
    } else {
      // ── Create a new instance from the bin ──
      const libTask = taskLibrary.find((t) => t.id === active.id)
      if (!libTask) return
      const newInstance = planTaskFromLib(libTask) // timeBlock preserved from library
      setPlanDays((prev) => {
        const dayDate = prev[dayName]?.date ?? getDayDate(weekStartDate, dayName)
        return {
          ...prev,
          [dayName]: {
            date: dayDate,
            tasks: [...(prev[dayName]?.tasks ?? []), newInstance],
          },
        }
      })
    }
  }

  function removeTaskFromDay(dayName, taskId) {
    setPlanDays((prev) => ({
      ...prev,
      [dayName]: {
        ...prev[dayName],
        tasks: (prev[dayName]?.tasks ?? []).filter((t) => t.id !== taskId),
      },
    }))
  }

  function updateInstanceMinutes(dayName, taskId, newMinutes) {
    setPlanDays((prev) => ({
      ...prev,
      [dayName]: {
        ...prev[dayName],
        tasks: (prev[dayName]?.tasks ?? []).map((t) =>
          t.id === taskId ? { ...t, estimateMinutes: newMinutes } : t,
        ),
      },
    }))
  }

  // ── Auto-Assign ───────────────────────────────────────────────────────────

  function handleAutoAssign() {
    const today = new Date()
    const dow = today.getDay()
    const remainingDays = dow >= 1 && dow <= 4 ? DAY_NAMES.slice(dow - 1) : DAY_NAMES

    const newDays = {}
    for (const day of remainingDays) {
      newDays[day] = { date: getDayDate(weekStartDate, day), tasks: [] }
    }

    // Track sub-track minutes placed so far
    const subTrackUsed = {}

    for (const task of taskLibrary.filter((t) => t.status === 'Active')) {
      const track = normaliseTrack(task.track)
      const subTrack = task.subTrack ?? 'Other'
      const key = `${track}::${subTrack}`
      const target = SUB_TRACK_TARGETS[track]?.subTracks[subTrack] ?? 0

      const eligibleDays = remainingDays.filter((d) =>
        (task.daysOfWeek ?? DAY_NAMES).includes(d),
      )

      for (const day of eligibleDays) {
        const used = subTrackUsed[key] ?? 0
        // Stop placing this task if sub-track target already met
        if (target > 0 && used >= target) break
        newDays[day].tasks.push(planTaskFromLib(task))
        subTrackUsed[key] = used + (task.defaultTimeEstimate ?? 25)
      }
    }

    setPlanDays(newDays)
    setFlags([])
  }

  // ── Flags computation ─────────────────────────────────────────────────────

  function computeFlags(allocs) {
    return Object.entries(SUB_TRACK_TARGETS).flatMap(([track, data]) =>
      Object.entries(data.subTracks)
        .map(([sub, target]) => {
          const assigned = allocs.subTrackTotals[`${track}::${sub}`] ?? 0
          const delta = target - assigned
          const pct = target > 0 ? assigned / target : 1
          if (pct > 1.1) {
            // Over-allocated by more than 10%
            return { track, subTrack: sub, assigned, target, delta, over: true, id: `${track}::${sub}` }
          }
          if (delta / target > 0.25) {
            // Under-allocated by more than 25%
            return { track, subTrack: sub, assigned, target, delta, over: false, id: `${track}::${sub}` }
          }
          return null
        })
        .filter(Boolean),
    )
  }

  function dismissFlag(id) {
    setFlags((prev) => prev.filter((f) => f.id !== id))
  }

  // ── Save / Publish ────────────────────────────────────────────────────────

  async function handleSaveDraft() {
    const newFlags = computeFlags(allocations)
    setFlags(newFlags)
    setSaving(true)
    setMessage('')
    try {
      const updatedPlan = { ...weekPlan, days: planDays, status: 'draft' }
      const planId = await upsertWeeklyPlan(updatedPlan, weekStartDate, userId)
      setWeekPlan({ ...updatedPlan, id: planId ?? weekPlan?.id })
      setMessage('Draft saved.')
    } catch (err) {
      setMessage(`Save failed: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  async function handlePublish() {
    const newFlags = computeFlags(allocations)
    setFlags(newFlags)

    setPublishing(true)
    setMessage('')
    try {
      const planId = weekPlan?.id
      const updatedDays = providerToken
        ? await createWeekPlanEvents(planDays, providerToken, planId)
        : planDays

      const updatedPlan = { ...weekPlan, days: updatedDays, status: 'published' }

      if (planId && userId) {
        await updatePlanAfterPublish(planId, updatedPlan, userId)
      } else {
        await upsertWeeklyPlan(updatedPlan, weekStartDate, userId)
      }

      setWeekPlan(updatedPlan)
      setPlanDays(updatedDays)

      // Replace today tasks for each present/future weekday
      const today = getTodayDateString()
      for (const [dayName, dayData] of Object.entries(updatedDays)) {
        if (!dayData?.date || dayData.date < today) continue
        await replaceTodayTasks(
          dayData.tasks.map((t) => ({ ...t, date: dayData.date })),
          userId,
          dayData.date,
        )
      }

      // Notify App.jsx so the Today sidebar queue refreshes from the plan
      onPublishComplete?.(updatedPlan)

      setMessage(providerToken ? 'Published to Google Calendar.' : 'Published (no calendar token).')
    } catch (err) {
      setMessage(`Publish failed: ${err.message}`)
    } finally {
      setPublishing(false)
    }
  }

  function handleClearWeek() {
    setPlanDays({})
    setFlags([])
    setClearConfirm(false)
  }

  // ── Personal calendar event tagging ──────────────────────────────────────

  function openTagModal(ev) {
    const existing = eventTags[ev.id] ?? {}
    setTagModalEvent(ev)
    setTagModalTrack(existing.track ?? '')
    setTagModalSubTrack(existing.subTrack ?? '')
  }

  async function handleSaveTag() {
    if (!tagModalEvent || !tagModalTrack) return
    setTagModalSaving(true)
    const tag = {
      track:       tagModalTrack,
      subTrack:    tagModalSubTrack || null,
      title:       tagModalEvent.name,
      durationMin: tagModalEvent.durationMin,
      date:        tagModalEvent.date,
    }
    setEventTags((prev) => ({ ...prev, [tagModalEvent.id]: tag }))
    await upsertCalendarEventTag(userId, tagModalEvent.id, tag)
    setTagModalSaving(false)
    setTagModalEvent(null)
  }

  // Sub-track options available for the selected track in the tag modal
  const tagModalSubTrackOptions = tagModalTrack
    ? Object.keys(SUB_TRACK_TARGETS[normaliseTrack(tagModalTrack)]?.subTracks ?? {})
    : []

  // ── Calendar sync ─────────────────────────────────────────────────────────

  async function handleSyncCalendar() {
    if (!providerToken) { setMessage('Sign in with Google to sync.'); return }
    setSyncingCalendar(true)
    setMessage('')
    try {
      const monday = weekStartDate
      const friday = getDayDate(weekStartDate, 'Friday')
      // RFC 3339 with Z = UTC — required by Google Calendar API
      const timeMin = `${monday}T00:00:00Z`
      const timeMax = `${friday}T23:59:59Z`
      const [calEvents, personalEvents] = await Promise.all([
        fetchCoSACalendarEvents(providerToken, timeMin, timeMax),
        fetchPersonalCalendarEvents(providerToken, timeMin, timeMax),
      ])

      // Store raw events so Calendar tab renders actual GCal state
      setFetchedCalEvents(calEvents)
      setFetchedPersonalEvents(personalEvents)

      if (calEvents.length === 0) {
        setCalendarDiff({ deleted: [], moved: [], total: 0 })
        setSyncingCalendar(false)
        return
      }

      // ── Build lookup maps ──────────────────────────────────────────────────
      // From GCal events: gcalId → { date, durationMin } and templateId → [entries]
      const byGcalId = {}
      const byTemplateId = {}
      for (const ev of calEvents) {
        const evDate = ev.start?.dateTime?.slice(0, 10) ?? ev.start?.date
        if (!evDate) continue
        const durationMin =
          ev.start?.dateTime && ev.end?.dateTime
            ? Math.round((new Date(ev.end.dateTime) - new Date(ev.start.dateTime)) / 60000)
            : null
        byGcalId[ev.id] = { date: evDate, durationMin }
        const tId = ev.extendedProperties?.private?.cosaTemplateId
        if (tId) {
          if (!byTemplateId[tId]) byTemplateId[tId] = []
          byTemplateId[tId].push({ gcalEventId: ev.id, date: evDate, durationMin })
        }
      }

      // From planDays: existing task objects keyed by gcalEventId and templateId
      const tasksByGcalId = {}
      const tasksByTemplateId = {}
      for (const dayData of Object.values(planDays)) {
        for (const task of dayData?.tasks ?? []) {
          if (task.gcalEventId) tasksByGcalId[task.gcalEventId] = task
          if (task.templateId) tasksByTemplateId[task.templateId] = task
        }
      }

      // Build date → dayName lookup (including days not yet in planDays)
      const dateToDay = {}
      for (const dayName of DAY_NAMES) {
        const date = planDays[dayName]?.date ?? getDayDate(weekStartDate, dayName)
        dateToDay[date] = dayName
      }

      // ── Diff: compute change summary for the UI banner ────────────────────
      const deleted = []
      const moved = []
      const durationUpdates = []
      for (const [dayName, dayData] of Object.entries(planDays)) {
        for (const task of dayData?.tasks ?? []) {
          if (!task.gcalEventId) continue // unpublished — not in GCal yet
          let matchedDate = null
          let matchedDuration = null
          if (byGcalId[task.gcalEventId]) {
            matchedDate = byGcalId[task.gcalEventId].date
            matchedDuration = byGcalId[task.gcalEventId].durationMin
          } else if (task.templateId && byTemplateId[task.templateId]) {
            const entries = byTemplateId[task.templateId]
            const onExpected = entries.find((e) => e.date === dayData.date)
            if (onExpected) {
              matchedDate = onExpected.date
              matchedDuration = onExpected.durationMin
              byTemplateId[task.templateId] = entries.filter((e) => e !== onExpected)
            } else if (entries.length > 0) {
              matchedDate = entries[0].date
              matchedDuration = entries[0].durationMin
              byTemplateId[task.templateId] = entries.slice(1)
            }
          }
          if (matchedDate === null) {
            deleted.push({ task, dayName, planDate: dayData.date })
          } else if (matchedDate !== dayData.date) {
            moved.push({ task, dayName, planDate: dayData.date, calDate: matchedDate, newDayName: dateToDay[matchedDate] ?? null, matchedDuration })
          } else if (matchedDuration !== null && matchedDuration !== task.estimateMinutes) {
            durationUpdates.push({ dayName, taskId: task.id, newMinutes: matchedDuration })
          }
        }
      }
      setCalendarDiff({ deleted, moved, total: calEvents.length })

      // ── Rebuild planDays from live GCal state ─────────────────────────────
      // Rather than patching individual changes, we reconstruct planDays directly
      // from fetchedCalEvents. This correctly handles tasks moved between days,
      // tasks published from Today's queue (not originally in the plan), and any
      // other GCal-side change that the diff approach would miss.
      const newDays = {}
      for (const dayName of DAY_NAMES) {
        const date = planDays[dayName]?.date ?? getDayDate(weekStartDate, dayName)
        newDays[dayName] = { date, tasks: [] }
      }

      // Keep unpublished tasks (no gcalEventId) on their original day
      for (const [dayName, dayData] of Object.entries(planDays)) {
        for (const task of dayData?.tasks ?? []) {
          if (!task.gcalEventId) newDays[dayName]?.tasks.push(task)
        }
      }

      // Place every CoSA GCal event on the day it actually lives on
      for (const ev of calEvents) {
        const evDate = ev.start?.dateTime?.slice(0, 10) ?? ev.start?.date
        const targetDay = evDate ? dateToDay[evDate] : null
        if (!targetDay) continue

        const templateId = ev.extendedProperties?.private?.cosaTemplateId
        const gcalEventId = ev.id
        const durationMin =
          ev.start?.dateTime && ev.end?.dateTime
            ? Math.round((new Date(ev.end.dateTime) - new Date(ev.start.dateTime)) / 60000)
            : null

        // Find the existing task object to preserve id, name, track etc.
        const existing = tasksByGcalId[gcalEventId] ?? (templateId ? tasksByTemplateId[templateId] : null)
        if (existing) {
          newDays[targetDay].tasks.push({
            ...existing,
            gcalEventId,
            estimateMinutes: durationMin ?? existing.estimateMinutes,
          })
        } else if (templateId) {
          // Event exists in GCal but not in planDays — reconstruct from task library
          const libTask = taskLibrary.find((t) => t.id === templateId)
          if (libTask) {
            newDays[targetDay].tasks.push({
              id: `plan-gcal-${gcalEventId}`,
              templateId: libTask.id,
              name: libTask.name,
              timeBlock: libTask.timeBlock,
              estimateMinutes: durationMin ?? libTask.defaultTimeEstimate ?? 25,
              track: libTask.track,
              subTrack: libTask.subTrack ?? null,
              gcalEventId,
            })
          }
        }
      }

      setPlanDays(newDays)

      // Auto-save so changes survive navigation; also update App.jsx weekPlan so
      // the planDays reset useEffect doesn't restore stale data on re-mount.
      if (userId) {
        const syncedPlan = { ...weekPlan, days: newDays }
        upsertWeeklyPlan(syncedPlan, weekStartDate, userId)
          .then((planId) => setWeekPlan({ ...syncedPlan, id: planId ?? weekPlan?.id }))
          .catch((err) => console.error('[sync auto-save]', err.message))
      }
    } catch (err) {
      setMessage(`Sync failed: ${err.message}`)
    } finally {
      setSyncingCalendar(false)
    }
  }

  function handleReviewInAssignTab() {
    const ids = new Set([
      ...(calendarDiff?.deleted ?? []).map((d) => d.task.templateId),
      ...(calendarDiff?.moved ?? []).map((m) => m.task.templateId),
    ])
    setHighlightedTemplateIds(ids)
    setActiveTab('assign')
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <section className="mx-auto max-w-[1400px] px-4 py-6">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">Week Planner</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('assign')}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              activeTab === 'assign'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Assign
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('calendar')}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              activeTab === 'calendar'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Calendar
          </button>
        </div>
      </div>

      {message && (
        <div className="mb-3 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
          {message}
        </div>
      )}

      {/* ── ASSIGN TAB ──────────────────────────────────────────────────── */}
      {activeTab === 'assign' && (
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4">
            {/* Task Bin */}
            <aside className="w-60 shrink-0">
              <DroppableZone id="bin" className="min-h-[120px] rounded-xl border-2 border-dashed border-slate-200 p-2">
                <h2 className="mb-2 text-xs font-bold uppercase text-slate-500">Task Bin</h2>
                {Object.entries(binByTrack).map(([track, tasks]) => {
                  const collapsed = collapsedTracks[track]
                  const trackTarget = SUB_TRACK_TARGETS[track]?.weekly ?? 0
                  const trackAssigned = allocations.trackTotals[track] ?? 0
                  const trackFull = trackTarget > 0 && trackAssigned >= trackTarget
                  return (
                    <div key={track} className={`mb-3 rounded-lg border p-2 ${TRACK_BG[track] ?? 'bg-slate-50 border-slate-200'}`}>
                      <button
                        type="button"
                        onClick={() => setCollapsedTracks((p) => ({ ...p, [track]: !p[track] }))}
                        className="flex w-full items-center justify-between text-left"
                      >
                        <span className="text-[11px] font-bold uppercase" style={{ color: TRACK_COLORS[track] }}>
                          {TRACK_LABELS[track] ?? track}
                        </span>
                        {trackFull ? (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                            ✓ Track Full
                          </span>
                        ) : (
                          collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />
                        )}
                      </button>
                      {!collapsed && (
                        <div className="mt-1.5 space-y-1">
                          {tasks.map((task) => {
                            const t = normaliseTrack(task.track)
                            const sub = task.subTrack ?? 'Other'
                            const key = `${t}::${sub}`
                            const subTarget = SUB_TRACK_TARGETS[t]?.subTracks[sub] ?? 0
                            const subAllocated = allocations.subTrackTotals[key] ?? 0
                            const isFull = fullSubTracks.has(key)
                            return (
                              <DraggableCard
                                key={task.id}
                                id={task.id}
                                disabled={isFull}
                                className={highlightedTemplateIds.has(task.id) ? 'ring-2 ring-amber-400 ring-offset-1 rounded-md' : ''}
                              >
                                <BinTaskCard
                                  task={task}
                                  trackColor={TRACK_COLORS[t] ?? '#94a3b8'}
                                  allocated={subAllocated}
                                  target={subTarget}
                                  isFull={isFull}
                                  shaking={rejectedId === task.id}
                                />
                              </DraggableCard>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </DroppableZone>
            </aside>

            {/* Week Grid + Health Bars */}
            <div className="flex-1 min-w-0">
              {/* Flag cards */}
              {flags.length > 0 && (
                <div className="mb-3 space-y-2">
                  {flags.map((flag) => (
                    <div
                      key={flag.id}
                      className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm ${
                        flag.over
                          ? 'border-orange-200 bg-orange-50'
                          : 'border-amber-200 bg-amber-50'
                      }`}
                    >
                      <AlertTriangle size={14} className={`shrink-0 ${flag.over ? 'text-orange-500' : 'text-amber-500'}`} />
                      <span className={`flex-1 ${flag.over ? 'text-orange-800' : 'text-amber-800'}`}>
                        <strong>{TRACK_LABELS[flag.track] ?? flag.track} / {flag.subTrack}</strong>
                        {flag.over
                          ? ` — over-allocated: ${flag.assigned}m vs ${flag.target}m target`
                          : ` — ${flag.assigned}m of ${flag.target}m target (${Math.round((flag.assigned / flag.target) * 100)}%)`}
                      </span>
                      <button
                        type="button"
                        onClick={() => dismissFlag(flag.id)}
                        className={`${flag.over ? 'text-orange-400 hover:text-orange-700' : 'text-amber-400 hover:text-amber-700'}`}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

             {/* Week grid — flat list per day, no block dividers */}
             <div className="mb-4 grid grid-cols-5 gap-2">
               {DAY_NAMES.map((dayName) => {
                 const dayDate = planDays[dayName]?.date ?? getDayDate(weekStartDate, dayName)
                 const dayTasks = planDays[dayName]?.tasks ?? []

                 // Tagged personal calendar events for this day (classified in Calendar tab)
                 const taggedForDay = Object.entries(eventTags)
                   .filter(([, tag]) => tag.date === dayDate)
                   .map(([evId, tag]) => ({
                     id: `tagged-${evId}`,
                     gcalEventId: evId,
                     name: tag.title,
                     track: tag.track,
                     subTrack: tag.subTrack ?? null,
                     estimateMinutes: tag.durationMin ?? 30,
                   }))

                 const totalMinutes =
                   dayTasks.reduce((s, t) => s + (t.estimateMinutes ?? 0), 0) +
                   taggedForDay.reduce((s, t) => s + (t.estimateMinutes ?? 0), 0)

                 return (
                   <div key={dayName} className="flex flex-col gap-1.5">
                     <div className="text-center">
                       <p className="text-xs font-bold text-slate-700">{dayName.slice(0, 3)}</p>
                       <p className="text-[10px] text-slate-400">{dayDate}</p>
                       {totalMinutes > 0 && (
                         <p className="text-[9px] text-slate-500 mt-0.5">{totalMinutes}m</p>
                       )}
                     </div>
                     <DroppableZone
                       id={dayName}
                       className="min-h-[120px] flex-1 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-1.5"
                     >
                       {dayTasks.length === 0 && taggedForDay.length === 0 && (
                         <p className="text-center text-[10px] text-slate-300 pt-4">Drop tasks here</p>
                       )}
                       {dayTasks.map((task) => {
                         const track = normaliseTrack(task.track)
                         return (
                           <DraggableCard key={task.id} id={task.id}>
                             <TaskCard
                               task={task}
                               trackColor={TRACK_COLORS[track] ?? '#94a3b8'}
                               onRemove={() => removeTaskFromDay(dayName, task.id)}
                               onEditMinutes={(n) => updateInstanceMinutes(dayName, task.id, n)}
                               shaking={rejectedId === task.id}
                             />
                           </DraggableCard>
                         )
                       })}
                       {taggedForDay.map((task) => {
                         const track = normaliseTrack(task.track)
                         const color = TRACK_COLORS[track] ?? '#94a3b8'
                         return (
                           <div
                             key={task.id}
                             className="rounded-md border bg-white px-2 py-1.5 text-xs shadow-sm mb-1 opacity-80"
                             style={{ borderLeftColor: color, borderLeftWidth: 3, borderStyle: 'dashed' }}
                             title="Personal calendar event — classified via Calendar tab"
                           >
                             <span className="font-medium leading-tight text-slate-700 truncate block">{task.name}</span>
                             <span className="text-slate-400">{task.estimateMinutes}m{task.subTrack ? ` · ${task.subTrack}` : ''}</span>
                           </div>
                         )
                       })}
                     </DroppableZone>
                   </div>
                 )
               })}
             </div>

              {/* Health bars */}
              <HealthBars
                allocations={calAllocations ?? allocations}
                usingLiveData={calAllocations !== null}
                expandedSubTracks={expandedSubTracks}
                setExpandedSubTracks={setExpandedSubTracks}
              />

              {/* Actions */}
              <div className="mt-4 flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleAutoAssign}
                  className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Auto-Assign
                </button>
                {clearConfirm ? (
                  <span className="flex items-center gap-1.5 text-sm">
                    <span className="text-slate-600">Clear all? </span>
                    <button type="button" onClick={handleClearWeek} className="font-medium text-rose-600 hover:underline">Yes, clear</button>
                    <button type="button" onClick={() => setClearConfirm(false)} className="text-slate-500 hover:underline">Cancel</button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setClearConfirm(true)}
                    className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Clear Week
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  disabled={saving}
                  className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save Draft'}
                </button>
                <button
                  type="button"
                  onClick={handlePublish}
                  disabled={publishing}
                  className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {publishing ? 'Publishing…' : 'Publish to Calendar'}
                </button>
              </div>
            </div>
          </div>

          {/* Drag Overlay */}
          <DragOverlay>
            {activeDragTask ? (
              <div
                className="rounded-md border bg-white px-2 py-1.5 text-xs shadow-lg select-none opacity-95"
                style={{ borderLeftColor: TRACK_COLORS[normaliseTrack(activeDragTask.track)] ?? '#94a3b8', borderLeftWidth: 3, minWidth: 140 }}
              >
                <p className="font-medium text-slate-700 truncate">{activeDragTask.name}</p>
                <p className="text-slate-400">{activeDragTask.estimateMinutes ?? activeDragTask.defaultTimeEstimate ?? 25}m</p>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* ── CALENDAR TAB ──────────────────────────────────────────────────── */}
      {activeTab === 'calendar' && (
        <CalendarView
          planDays={planDays}
          taskLibrary={taskLibrary}
          weekStartDate={weekStartDate}
          calendarDiff={calendarDiff}
          fetchedCalEvents={fetchedCalEvents}
          fetchedPersonalEvents={fetchedPersonalEvents}
          eventTags={eventTags}
          onTagEvent={openTagModal}
          syncingCalendar={syncingCalendar}
          onSync={handleSyncCalendar}
          onReviewInAssign={handleReviewInAssignTab}
          providerToken={providerToken}
        />
      )}

      {/* ── Tag modal — assign Track/Sub-track to a personal calendar event ── */}
      {tagModalEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white shadow-xl p-5">
            <div className="mb-4 flex items-start justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold text-slate-800">{tagModalEvent.name}</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {tagModalEvent.date} · {tagModalEvent.durationMin}m
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTagModalEvent(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            </div>
            <p className="mb-3 text-xs text-slate-500">
              This event was placed on your calendar directly. Assign it to a track so it counts toward your weekly allocation.
            </p>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Track</label>
                <select
                  value={tagModalTrack}
                  onChange={(e) => { setTagModalTrack(e.target.value); setTagModalSubTrack('') }}
                  className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  <option value="">— select track —</option>
                  {Object.entries(TRACK_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
              {tagModalSubTrackOptions.length > 0 && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Sub-Track</label>
                  <select
                    value={tagModalSubTrack}
                    onChange={(e) => setTagModalSubTrack(e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  >
                    <option value="">— none —</option>
                    {tagModalSubTrackOptions.map((sub) => (
                      <option key={sub} value={sub}>{sub}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setTagModalEvent(null)}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveTag}
                disabled={!tagModalTrack || tagModalSaving}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {tagModalSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%       { transform: translateX(-5px); }
          40%       { transform: translateX(5px); }
          60%       { transform: translateX(-4px); }
          80%       { transform: translateX(4px); }
        }
        .animate-shake { animation: shake 0.5s ease; }
      `}</style>
    </section>
  )
}

// ─── Health Bars sub-component ────────────────────────────────────────────────

function HealthBars({ allocations, usingLiveData, expandedSubTracks, setExpandedSubTracks }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase text-slate-500">Weekly Allocation</h3>
        {usingLiveData && (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-600">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
            Live · Google Calendar
          </span>
        )}
      </div>
      <div className="space-y-3">
        {Object.entries(SUB_TRACK_TARGETS).map(([track, data]) => {
          const assigned = allocations.trackTotals[track] ?? 0
          const color = healthColor(assigned, data.weekly)
          const pct = Math.min((assigned / data.weekly) * 100, 100)
          const expanded = expandedSubTracks[track]

          return (
            <div key={track}>
              <button
                type="button"
                onClick={() => setExpandedSubTracks((p) => ({ ...p, [track]: !p[track] }))}
                className="flex w-full items-center gap-2 text-left"
              >
                <span className="w-32 shrink-0 text-xs font-semibold" style={{ color: TRACK_COLORS[track] }}>
                  {TRACK_LABELS[track]}
                </span>
                <div className="flex-1 h-2.5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${healthBarClass(color)}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className={`w-20 text-right text-xs font-medium ${healthTextClass(color)}`}>
                  {assigned}m / {data.weekly}m
                </span>
                {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              </button>

              {expanded && (
                <div className="ml-32 mt-1.5 space-y-1.5">
                  {Object.entries(data.subTracks).map(([sub, target]) => {
                    const key = `${track}::${sub}`
                    const subAssigned = allocations.subTrackTotals[key] ?? 0
                    const subColor = healthColor(subAssigned, target)
                    const subPct = Math.min((subAssigned / target) * 100, 100)
                    return (
                      <div key={sub} className="flex items-center gap-2">
                        <span className="w-36 shrink-0 text-[11px] text-slate-500">{sub}</span>
                        <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${healthBarClass(subColor)}`}
                            style={{ width: `${subPct}%` }}
                          />
                        </div>
                        <span className={`w-20 text-right text-[11px] ${healthTextClass(subColor)}`}>
                          {subAssigned}m / {target}m
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Reverse-map Google Calendar colorId → track color
const GCAL_COLOR_TO_TRACK_COLOR = {
  '10': TRACK_COLORS.advisors,   // Basil → Advisors green
  '9':  TRACK_COLORS.jobSearch,  // Blueberry → Job Search blue
  '6':  TRACK_COLORS.jobSearch,  // Tangerine → Networking (also job search)
  '3':  TRACK_COLORS.ventures,   // Grape → Ventures purple
}

// ─── Overlap layout helper ─────────────────────────────────────────────────────
// Takes an array of { startHour, durationMin, ...rest } events and returns
// the same array with { col, totalCols } added to each entry so they can be
// rendered side-by-side instead of on top of each other.

function layoutOverlappingEvents(events) {
  if (events.length === 0) return []

  // Sort by start time, then by duration descending
  const sorted = events.map((ev, idx) => ({ ...ev, _idx: idx }))
    .sort((a, b) => a.startHour - b.startHour || b.durationMin - a.durationMin)

  // Greedy column packing: place each event in the first column whose last
  // event ends before this one starts.
  const columns = [] // columns[c] = last end hour of events placed there
  const colAssign = new Array(events.length)

  for (const ev of sorted) {
    const evEnd = ev.startHour + ev.durationMin / 60
    let placed = false
    for (let c = 0; c < columns.length; c++) {
      if (ev.startHour >= columns[c]) {
        columns[c] = evEnd
        colAssign[ev._idx] = c
        placed = true
        break
      }
    }
    if (!placed) {
      colAssign[ev._idx] = columns.length
      columns.push(evEnd)
    }
  }

  // For each event, the effective total columns is the max column index of any
  // event that overlaps with it, + 1.
  return events.map((ev, idx) => {
    const evEnd = ev.startHour + ev.durationMin / 60
    let maxCol = colAssign[idx]
    for (let j = 0; j < events.length; j++) {
      const other = events[j]
      const otherEnd = other.startHour + other.durationMin / 60
      if (other.startHour < evEnd && otherEnd > ev.startHour) {
        maxCol = Math.max(maxCol, colAssign[j])
      }
    }
    return { ...ev, col: colAssign[idx], totalCols: maxCol + 1 }
  })
}

// ─── Calendar view sub-component ──────────────────────────────────────────────

function CalendarView({ planDays, taskLibrary, weekStartDate, calendarDiff, fetchedCalEvents, fetchedPersonalEvents, eventTags, onTagEvent, syncingCalendar, onSync, onReviewInAssign, providerToken }) {
  const GRID_START = 9   // 9:00am
  const GRID_END = 18    // 6:00pm
  const GRID_HOURS = GRID_END - GRID_START
  const PX_PER_HOUR = 64

  // Parse a GCal event into a renderable block
  function parseCalEvent(ev) {
    const dateTimeStr = ev.start?.dateTime ?? `${ev.start?.date}T09:00:00`
    const endDateTimeStr = ev.end?.dateTime ?? `${ev.end?.date}T10:00:00`
    const start = new Date(dateTimeStr)
    const end = new Date(endDateTimeStr)
    const startHour = start.getHours() + start.getMinutes() / 60
    const durationMin = Math.round((end - start) / 60000)
    const date = dateTimeStr.slice(0, 10)
    const color = GCAL_COLOR_TO_TRACK_COLOR[ev.colorId] ?? '#64748b'
    return { id: ev.id, name: ev.summary ?? '(no title)', startHour, durationMin, date, color }
  }

  // Build date → day column mapping
  const dateToDay = {}
  for (const [dayName, dayData] of Object.entries(planDays)) {
    if (dayData?.date) dateToDay[dayData.date] = dayName
  }
  // Also compute dates for days that may not be in planDays yet
  for (const dayName of DAY_NAMES) {
    const date = planDays[dayName]?.date ?? getDayDate(weekStartDate, dayName)
    if (!dateToDay[date]) dateToDay[date] = dayName
  }

  // When we have fetched events, group them by day column
  const calEventsByDay = {}
  if (fetchedCalEvents) {
    for (const ev of fetchedCalEvents) {
      const parsed = parseCalEvent(ev)
      if (parsed.startHour >= GRID_END || parsed.startHour + parsed.durationMin / 60 <= GRID_START) continue
      const dayName = dateToDay[parsed.date]
      if (!dayName) continue
      if (!calEventsByDay[dayName]) calEventsByDay[dayName] = []
      calEventsByDay[dayName].push(parsed)
    }
  }

  // Group personal events by day column
  const personalEventsByDay = {}
  if (fetchedPersonalEvents) {
    for (const ev of fetchedPersonalEvents) {
      if (!ev.start?.dateTime) continue
      const parsed = parseCalEvent(ev)
      if (parsed.startHour >= GRID_END || parsed.startHour + parsed.durationMin / 60 <= GRID_START) continue
      const dayName = dateToDay[parsed.date]
      if (!dayName) continue
      if (!personalEventsByDay[dayName]) personalEventsByDay[dayName] = []
      const tag = (eventTags ?? {})[ev.id]
      personalEventsByDay[dayName].push({ ...parsed, isPersonal: true, tag: tag ?? null })
    }
  }

  const usingLiveData = !!fetchedCalEvents

  return (
    <div>
      {/* Sync panel */}
      <div className="mb-4 flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <h2 className="text-sm font-semibold text-slate-700">Google Calendar Sync</h2>
          <p className="text-xs text-slate-500">
            {!providerToken
              ? 'Sign in with Google to enable calendar sync.'
              : usingLiveData
              ? `Showing live data — ${fetchedCalEvents.length} CoSA event${fetchedCalEvents.length !== 1 ? 's' : ''} + ${fetchedPersonalEvents?.length ?? 0} direct calendar event${(fetchedPersonalEvents?.length ?? 0) !== 1 ? 's' : ''} found. Click direct events to assign a track.`
              : 'Sync to see your CoSA tasks and directly-placed calendar events with real times.'}
          </p>
        </div>
        <button
          type="button"
          onClick={onSync}
          disabled={syncingCalendar || !providerToken}
          className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          <RefreshCw size={13} className={syncingCalendar ? 'animate-spin' : ''} />
          {syncingCalendar ? 'Syncing…' : 'Sync from Google Calendar'}
        </button>
      </div>

      {/* Diff results */}
      {calendarDiff && (calendarDiff.deleted.length > 0 || calendarDiff.moved.length > 0) ? (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-amber-800">
              Changes detected — plan updated to match Google Calendar
            </h3>
            <button
              type="button"
              onClick={onReviewInAssign}
              className="rounded-md bg-amber-600 px-3 py-1 text-xs font-medium text-white hover:bg-amber-700"
            >
              Review in Assign Tab →
            </button>
          </div>
          {calendarDiff.deleted.map((d, i) => (
            <div key={i} className="mb-1 flex items-start gap-2 text-xs text-red-700">
              <span className="mt-0.5 shrink-0 h-2 w-2 rounded-full bg-red-500" />
              <span><strong>{d.task.name}</strong> ({d.dayName}) — removed from Google Calendar, returned to bin</span>
            </div>
          ))}
          {calendarDiff.moved.map((m, i) => (
            <div key={i} className="mb-1 flex items-start gap-2 text-xs text-amber-700">
              <span className="mt-0.5 shrink-0 h-2 w-2 rounded-full bg-amber-500" />
              <span><strong>{m.task.name}</strong> — moved from {m.planDate} to {m.calDate}{m.newDayName ? ` (${m.newDayName})` : ' (outside week)'}</span>
            </div>
          ))}
        </div>
      ) : calendarDiff ? (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {calendarDiff.total === 0
            ? 'No CoSA events found in Google Calendar for this week. Have you published your plan?'
            : 'Plan matches Google Calendar — no day changes detected.'}
        </div>
      ) : null}

      {/* Time grid — live GCal events when synced, planDays fallback otherwise */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        {!usingLiveData && (
          <div className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs text-slate-500">
            Showing plan estimate — click <strong>Sync from Google Calendar</strong> to see actual event times
          </div>
        )}
        <div className="flex" style={{ minWidth: 700 }}>
          {/* Hour labels */}
          <div className="w-12 shrink-0 border-r border-slate-100 pt-8">
            {Array.from({ length: GRID_HOURS + 1 }, (_, i) => (
              <div
                key={i}
                className="border-t border-slate-100 pr-1 text-right text-[10px] text-slate-400 leading-none"
                style={{ height: PX_PER_HOUR, marginTop: i === 0 ? -8 : 0 }}
              >
                {i + GRID_START}:00
              </div>
            ))}
          </div>

          {/* Day columns */}
          {DAY_NAMES.map((dayName) => {
            const dayData = planDays[dayName]
            const dayDate = dayData?.date ?? getDayDate(weekStartDate, dayName)
            const gridHeight = GRID_HOURS * PX_PER_HOUR

            // Combine CoSA events and personal events for overlap layout
            const liveCoSAEvents = usingLiveData ? (calEventsByDay[dayName] ?? []) : []
            const livePersonalEvents = personalEventsByDay[dayName] ?? []
            const allLiveEvents = usingLiveData
              ? layoutOverlappingEvents([...liveCoSAEvents, ...livePersonalEvents])
              : []
            const planTasks = dayData?.tasks ?? []

            return (
              <div key={dayName} className="flex-1 border-r border-slate-100 last:border-r-0">
                <div className="border-b border-slate-200 p-2 text-center">
                  <p className="text-xs font-bold text-slate-700">{dayName.slice(0, 3)}</p>
                  <p className="text-[10px] text-slate-400">{dayDate}</p>
                </div>
                <div className="relative" style={{ height: gridHeight }}>
                  {/* Hour lines */}
                  {Array.from({ length: GRID_HOURS }, (_, i) => (
                    <div
                      key={i}
                      className="absolute left-0 right-0 border-t border-slate-100"
                      style={{ top: i * PX_PER_HOUR }}
                    />
                  ))}

                  {usingLiveData ? (
                    // ── Live events: CoSA tasks + personal calendar events ──
                    allLiveEvents.map((ev) => {
                      const topPx = Math.max(0, (ev.startHour - GRID_START) * PX_PER_HOUR)
                      const heightPx = Math.max(18, (ev.durationMin / 60) * PX_PER_HOUR)
                      const colW = 100 / ev.totalCols
                      const leftPct = ev.col * colW

                      if (ev.isPersonal) {
                        // Personal calendar event — grey by default, track-coloured when tagged
                        const tag = ev.tag
                        const tagTrack = tag ? normaliseTrack(tag.track) : null
                        const bgColor = tagTrack ? `${TRACK_COLORS[tagTrack]}33` : '#f1f5f9'
                        const borderColor = tagTrack ? TRACK_COLORS[tagTrack] : '#cbd5e1'
                        return (
                          <button
                            key={ev.id}
                            type="button"
                            onClick={() => onTagEvent?.(ev)}
                            className="absolute overflow-hidden text-left hover:opacity-80 transition-opacity"
                            style={{
                              top: topPx,
                              height: heightPx,
                              minHeight: 18,
                              left: `calc(${leftPct}% + 2px)`,
                              width: `calc(${colW}% - 4px)`,
                              backgroundColor: bgColor,
                              border: `1.5px dashed ${borderColor}`,
                              borderRadius: 4,
                              padding: '2px 4px',
                            }}
                            title={tag
                              ? `${ev.name} · ${tag.track}${tag.subTrack ? ' / ' + tag.subTrack : ''} — click to edit`
                              : `${ev.name} — click to assign track`}
                          >
                            <p className="text-[9px] font-medium text-slate-600 truncate leading-tight">{ev.name}</p>
                            {ev.durationMin >= 20 && (
                              <p className="text-[9px] text-slate-400">
                                {ev.durationMin}m{tag ? ` · ${tag.subTrack ?? tag.track}` : ' · tap to assign'}
                              </p>
                            )}
                          </button>
                        )
                      }

                      // CoSA calendar event
                      return (
                        <div
                          key={ev.id}
                          className="absolute rounded px-1 py-0.5 text-[10px] text-white overflow-hidden shadow-sm"
                          style={{
                            top: topPx,
                            height: heightPx,
                            minHeight: 18,
                            left: `calc(${leftPct}% + 2px)`,
                            width: `calc(${colW}% - 4px)`,
                            backgroundColor: ev.color,
                          }}
                          title={`${ev.name} — ${ev.durationMin}m`}
                        >
                          <p className="font-medium truncate leading-tight">{ev.name}</p>
                          {ev.durationMin >= 20 && <p className="opacity-80">{ev.durationMin}m</p>}
                        </div>
                      )
                    })
                  ) : (
                    // ── Plan estimate (pre-sync) using block start positions ──
                    layoutOverlappingEvents(
                      planTasks.map((task) => ({
                        ...task,
                        startHour: BLOCK_START_HOUR[task.timeBlock] ?? GRID_START,
                        durationMin: task.estimateMinutes ?? 25,
                      }))
                    ).map((task) => {
                      const topPx = Math.max(0, (task.startHour - GRID_START) * PX_PER_HOUR)
                      const heightPx = Math.max(18, (task.durationMin / 60) * PX_PER_HOUR)
                      const track = normaliseTrack(task.track)
                      const color = TRACK_COLORS[track] ?? '#94a3b8'
                      const lib = taskLibrary.find((t) => t.id === task.templateId)
                      const colW = 100 / task.totalCols
                      const leftPct = task.col * colW
                      return (
                        <div
                          key={task.id ?? task.templateId}
                          className="absolute rounded px-1 py-0.5 text-[10px] text-white overflow-hidden opacity-70"
                          style={{
                            top: topPx,
                            height: heightPx,
                            minHeight: 18,
                            left: `calc(${leftPct}% + 2px)`,
                            width: `calc(${colW}% - 4px)`,
                            backgroundColor: color,
                          }}
                          title={`${task.name} — ${task.estimateMinutes}m (estimated position)`}
                        >
                          <p className="font-medium truncate leading-tight">{task.name ?? lib?.name}</p>
                          {(task.durationMin ?? 0) >= 20 && <p className="opacity-80">{task.durationMin}m</p>}
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
