import { useCallback, useEffect, useMemo, useState } from 'react'
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { AlertTriangle, ChevronDown, ChevronRight, RefreshCw, X } from 'lucide-react'
import {
  upsertWeeklyPlan,
  updatePlanAfterPublish,
  replaceTodayTasks,
} from '../lib/supabaseSync'
import { createWeekPlanEvents, fetchCoSACalendarEvents, BLOCK_CAPACITY_MINUTES } from '../lib/googleCalendar'

// ─── Constants ───────────────────────────────────────────────────────────────

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

const TRACK_LABELS = {
  advisors:  'Kuperman Advisors',
  jobSearch: 'Job Search',
  ventures:  'Kuperman Ventures',
}

const TRACK_COLORS = {
  advisors:  '#1E6B3C',
  jobSearch: '#2E75B6',
  ventures:  '#9B6BAE',
}

const TRACK_BG = {
  advisors:  'bg-emerald-50 border-emerald-200',
  jobSearch: 'bg-blue-50 border-blue-200',
  ventures:  'bg-purple-50 border-purple-200',
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
  if (raw === 'networking') return 'jobSearch'
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

function DraggableCard({ id, children, className = '' }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id })
  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
    : undefined
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`${className} ${isDragging ? 'opacity-30' : ''} cursor-grab active:cursor-grabbing`}
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

// ─── Task card (shared between bin and grid) ──────────────────────────────────

function TaskCard({ task, trackColor, onRemove, compact = false, shaking = false }) {
  return (
    <div
      className={`rounded-md border bg-white px-2 py-1.5 text-xs shadow-sm select-none
        ${shaking ? 'animate-shake' : ''}
        ${compact ? '' : 'mb-1'}`}
      style={{ borderLeftColor: trackColor, borderLeftWidth: 3 }}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="font-medium leading-tight text-slate-700 truncate">{task.name}</span>
        {onRemove && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onRemove() }}
            className="ml-1 shrink-0 text-slate-300 hover:text-rose-500"
            title="Remove back to bin"
          >
            <X size={11} />
          </button>
        )}
      </div>
      <div className="mt-0.5 flex items-center gap-1 text-slate-400">
        <span>{task.estimateMinutes}m</span>
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
  rescheduleQueue,
  supabaseConfigured,
  onTriggerReplan,
}) {
  const [activeTab, setActiveTab] = useState('assign')
  const [planDays, setPlanDays] = useState(() => weekPlan?.days ?? {})
  const [flags, setFlags] = useState([])
  const [activeDragTask, setActiveDragTask] = useState(null)
  const [rejectedId, setRejectedId] = useState(null)
  const [expandedSubTracks, setExpandedSubTracks] = useState({})
  const [collapsedTracks, setCollapsedTracks] = useState({})
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [message, setMessage] = useState('')
  const [clearConfirm, setClearConfirm] = useState(false)
  const [calendarDiff, setCalendarDiff] = useState(null)
  const [syncingCalendar, setSyncingCalendar] = useState(false)
  const [highlightedTemplateIds, setHighlightedTemplateIds] = useState(new Set())

  // Sync planDays when weekPlan changes externally
  useEffect(() => {
    setPlanDays(weekPlan?.days ?? {})
  }, [weekPlan])

  const weekStartDate = weekPlan?.weekStartDate ?? getWeekStartDateStr()
  const providerToken = session?.provider_token ?? null
  const userId = session?.user?.id ?? null

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  // ── Allocation computation ────────────────────────────────────────────────

  const allocations = useMemo(() => {
    const trackTotals = { advisors: 0, jobSearch: 0, ventures: 0 }
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

  // ── Task bin ──────────────────────────────────────────────────────────────

  const assignedTemplateIds = useMemo(() => {
    const s = new Set()
    for (const d of Object.values(planDays)) (d?.tasks ?? []).forEach((t) => s.add(t.templateId))
    return s
  }, [planDays])

  const binTasks = useMemo(
    () => taskLibrary.filter((t) => t.status === 'Active' && !assignedTemplateIds.has(t.id)),
    [taskLibrary, assignedTemplateIds],
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

  // ── DnD logic ─────────────────────────────────────────────────────────────

  function handleDragStart({ active }) {
    // Active id can be a library id (from bin) or a placed task id (from grid)
    const libTask = taskLibrary.find((t) => t.id === active.id)
    if (libTask) { setActiveDragTask({ ...libTask, _source: 'bin' }); return }
    // Search in placed tasks
    for (const [dayName, dayData] of Object.entries(planDays)) {
      const placed = (dayData?.tasks ?? []).find((t) => t.id === active.id)
      if (placed) { setActiveDragTask({ ...placed, _source: 'grid', _fromDay: dayName }); return }
    }
  }

  function handleDragEnd({ active, over }) {
    setActiveDragTask(null)
    if (!over) return

    const overId = over.id // 'bin' | `${dayName}::${timeBlock}`

    // Dropping back on the bin — remove from grid
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
      return
    }

    const [dayName, block] = overId.split('::')
    if (!dayName || !block) return

    // Resolve the library task being dragged
    const libTask = taskLibrary.find(
      (t) => t.id === active.id || t.id === activeDragTask?.templateId,
    )
    const sourceIsGrid = activeDragTask?._source === 'grid'
    const fromDay = activeDragTask?._fromDay

    const targetTask = sourceIsGrid ? activeDragTask : libTask
    if (!targetTask) return

    // Check capacity
    const existingInBlock = (planDays[dayName]?.tasks ?? []).filter(
      (t) => t.timeBlock === block && t.id !== active.id,
    )
    const usedMinutes = existingInBlock.reduce((s, t) => s + (t.estimateMinutes ?? 0), 0)
    const cap = BLOCK_CAPACITY_MINUTES[block] ?? 999
    const taskMinutes = targetTask.estimateMinutes ?? targetTask.defaultTimeEstimate ?? 25
    if (usedMinutes + taskMinutes > cap) {
      setRejectedId(active.id)
      setTimeout(() => setRejectedId(null), 600)
      return
    }

    setPlanDays((prev) => {
      const dayDate = prev[dayName]?.date ?? getDayDate(weekStartDate, dayName)
      const newTask = sourceIsGrid ? targetTask : planTaskFromLib(libTask ?? targetTask)

      // Remove from source day if coming from grid
      let nextState = { ...prev }
      if (sourceIsGrid && fromDay) {
        nextState = {
          ...nextState,
          [fromDay]: {
            ...nextState[fromDay],
            tasks: (nextState[fromDay]?.tasks ?? []).filter((t) => t.id !== active.id),
          },
        }
      }

      const existingTasks = (nextState[dayName]?.tasks ?? []).filter((t) => t.id !== active.id)
      return {
        ...nextState,
        [dayName]: {
          date: dayDate,
          tasks: [...existingTasks, newTask],
        },
      }
    })
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

  // ── Auto-Assign ───────────────────────────────────────────────────────────

  function handleAutoAssign() {
    const today = new Date()
    const dow = today.getDay()
    const remainingDays = dow >= 1 && dow <= 4 ? DAY_NAMES.slice(dow - 1) : DAY_NAMES

    const newDays = {}
    for (const day of remainingDays) {
      newDays[day] = { date: getDayDate(weekStartDate, day), tasks: [] }
    }

    for (const task of taskLibrary.filter((t) => t.status === 'Active')) {
      const eligibleDays = remainingDays.filter((d) =>
        (task.daysOfWeek ?? DAY_NAMES).includes(d),
      )
      for (const day of eligibleDays) {
        const block = task.timeBlock
        const cap = BLOCK_CAPACITY_MINUTES[block] ?? 999
        const used = newDays[day].tasks
          .filter((t) => t.timeBlock === block)
          .reduce((s, t) => s + (t.estimateMinutes ?? 0), 0)
        if (used + (task.defaultTimeEstimate ?? 25) <= cap) {
          newDays[day].tasks.push(planTaskFromLib(task))
          break
        }
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
          return delta / target > 0.25
            ? { track, subTrack: sub, assigned, target, delta, id: `${track}::${sub}` }
            : null
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

      // Replace today tasks for each future weekday
      const today = getTodayDateString()
      for (const [dayName, dayData] of Object.entries(updatedDays)) {
        if (!dayData?.date || dayData.date < today) continue
        await replaceTodayTasks(
          dayData.tasks.map((t) => ({ ...t, date: dayData.date })),
          userId,
          dayData.date,
        )
      }

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

  // ── Calendar sync ─────────────────────────────────────────────────────────

  async function handleSyncCalendar() {
    if (!providerToken) { setMessage('Sign in with Google to sync.'); return }
    setSyncingCalendar(true)
    setMessage('')
    try {
      const monday = weekStartDate
      const friday = getDayDate(weekStartDate, 'Friday')
      const timeMin = `${monday}T00:00:00Z`
      const timeMax = `${friday}T23:59:59Z`
      const calEvents = await fetchCoSACalendarEvents(providerToken, timeMin, timeMax)

      // Build a map of templateId → { calEventId, date, timeBlock }
      const calMap = {}
      for (const ev of calEvents) {
        const tId = ev.extendedProperties?.private?.cosaTemplateId
        if (tId) {
          calMap[tId] = {
            calEventId: ev.id,
            date: ev.start?.dateTime?.slice(0, 10) ?? ev.start?.date,
          }
        }
      }

      // Build date → dayName lookup from planDays
      const dateToDay = {}
      for (const [dayName, dayData] of Object.entries(planDays)) {
        if (dayData?.date) dateToDay[dayData.date] = dayName
      }

      // Diff: find deleted and moved tasks
      const deleted = []
      const moved = []
      for (const [dayName, dayData] of Object.entries(planDays)) {
        for (const task of dayData?.tasks ?? []) {
          const calInfo = calMap[task.templateId]
          if (!calInfo) {
            deleted.push({ task, dayName, planDate: dayData.date })
          } else if (calInfo.date && calInfo.date !== dayData.date) {
            const newDayName = dateToDay[calInfo.date] ?? null
            moved.push({ task, dayName, planDate: dayData.date, calDate: calInfo.date, newDayName })
          }
        }
      }

      setCalendarDiff({ deleted, moved })

      // Apply changes to planDays so the grid reflects Google Calendar
      if (deleted.length > 0 || moved.length > 0) {
        setPlanDays((prev) => {
          const next = {}
          for (const [dayName, dayData] of Object.entries(prev)) {
            next[dayName] = { ...dayData, tasks: [...(dayData?.tasks ?? [])] }
          }

          // Remove deleted tasks from their day
          for (const { task, dayName } of deleted) {
            next[dayName].tasks = next[dayName].tasks.filter((t) => t.templateId !== task.templateId)
          }

          // Move tasks to their new day (if the new date is within this week)
          for (const { task, dayName, newDayName, calDate } of moved) {
            // Remove from old day
            next[dayName].tasks = next[dayName].tasks.filter((t) => t.templateId !== task.templateId)
            // Add to new day if it's in the plan
            if (newDayName && next[newDayName]) {
              next[newDayName].tasks = [...next[newDayName].tasks, { ...task }]
            }
            // If moved outside the week, task is dropped (returns to bin)
          }

          return next
        })
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
            <aside className="w-56 shrink-0">
              <DroppableZone id="bin" className="min-h-[120px] rounded-xl border-2 border-dashed border-slate-200 p-2">
                <h2 className="mb-2 text-xs font-bold uppercase text-slate-500">Task Bin</h2>
                {Object.entries(binByTrack).map(([track, tasks]) => {
                  const allAssigned = tasks.length === 0
                  const collapsed = collapsedTracks[track]
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
                        {allAssigned ? (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                            Complete
                          </span>
                        ) : (
                          collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />
                        )}
                      </button>
                      {!collapsed && !allAssigned && (
                        <div className="mt-1.5 space-y-1">
                          {tasks.map((task) => (
                            <DraggableCard
                              key={task.id}
                              id={task.id}
                              className={highlightedTemplateIds.has(task.id) ? 'ring-2 ring-amber-400 ring-offset-1 rounded-md' : ''}
                            >
                              <TaskCard
                                task={{ ...task, estimateMinutes: task.defaultTimeEstimate ?? 25 }}
                                trackColor={TRACK_COLORS[normaliseTrack(task.track)] ?? '#94a3b8'}
                                shaking={rejectedId === task.id}
                              />
                            </DraggableCard>
                          ))}
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
                      className="flex items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm"
                    >
                      <AlertTriangle size={14} className="shrink-0 text-amber-500" />
                      <span className="flex-1 text-amber-800">
                        <strong>{TRACK_LABELS[flag.track] ?? flag.track} / {flag.subTrack}</strong>
                        {' '}— {flag.assigned}m of {flag.target}m target ({Math.round((flag.assigned / flag.target) * 100)}%)
                      </span>
                      <button
                        type="button"
                        onClick={() => dismissFlag(flag.id)}
                        className="text-amber-400 hover:text-amber-700"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Week grid */}
              <div className="mb-4 grid grid-cols-5 gap-2">
                {DAY_NAMES.map((dayName) => {
                  const dayDate = planDays[dayName]?.date ?? getDayDate(weekStartDate, dayName)
                  const dayTasks = planDays[dayName]?.tasks ?? []
                  const blockNames = ['BD', 'Networking', 'Job Search', 'Encore OS', 'Friday'].filter((b) => {
                    if (b === 'Friday') return dayName === 'Friday'
                    if (b !== 'Friday') return true
                    return false
                  })
                  const allBlocks = dayName === 'Friday'
                    ? ['BD', 'Networking', 'Job Search', 'Friday']
                    : ['BD', 'Networking', 'Job Search', 'Encore OS']

                  return (
                    <div key={dayName} className="flex flex-col gap-1.5">
                      <div className="text-center">
                        <p className="text-xs font-bold text-slate-700">{dayName.slice(0, 3)}</p>
                        <p className="text-[10px] text-slate-400">{dayDate}</p>
                      </div>
                      {allBlocks.map((block) => {
                        const blockTasks = dayTasks.filter((t) => t.timeBlock === block)
                        return (
                          <DroppableZone
                            key={block}
                            id={`${dayName}::${block}`}
                            className="min-h-[60px] rounded-lg border border-dashed border-slate-200 bg-slate-50 p-1.5"
                          >
                            <p className="mb-1 text-[9px] font-semibold uppercase text-slate-400">{block}</p>
                            {blockTasks.map((task) => {
                              const track = normaliseTrack(task.track)
                              return (
                                <DraggableCard key={task.id} id={task.id}>
                                  <TaskCard
                                    task={task}
                                    trackColor={TRACK_COLORS[track] ?? '#94a3b8'}
                                    onRemove={() => removeTaskFromDay(dayName, task.id)}
                                    shaking={rejectedId === task.id}
                                  />
                                </DraggableCard>
                              )
                            })}
                          </DroppableZone>
                        )
                      })}
                    </div>
                  )
                })}
              </div>

              {/* Health bars */}
              <HealthBars allocations={allocations} expandedSubTracks={expandedSubTracks} setExpandedSubTracks={setExpandedSubTracks} />

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
              <TaskCard
                task={{
                  ...activeDragTask,
                  estimateMinutes: activeDragTask.estimateMinutes ?? activeDragTask.defaultTimeEstimate ?? 25,
                }}
                trackColor={TRACK_COLORS[normaliseTrack(activeDragTask.track)] ?? '#94a3b8'}
              />
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
          syncingCalendar={syncingCalendar}
          onSync={handleSyncCalendar}
          onReviewInAssign={handleReviewInAssignTab}
          providerToken={providerToken}
        />
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

function HealthBars({ allocations, expandedSubTracks, setExpandedSubTracks }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-xs font-bold uppercase text-slate-500">Weekly Allocation</h3>
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

// ─── Calendar view sub-component ──────────────────────────────────────────────

function CalendarView({ planDays, taskLibrary, weekStartDate, calendarDiff, syncingCalendar, onSync, onReviewInAssign, providerToken }) {
  const GRID_START = 9   // 9:00am
  const GRID_END = 18    // 6:00pm
  const GRID_HOURS = GRID_END - GRID_START

  function taskTopPct(task) {
    const startH = BLOCK_START_HOUR[task.timeBlock] ?? GRID_START
    return ((startH - GRID_START) / GRID_HOURS) * 100
  }

  function taskHeightPct(task) {
    const durationH = (task.estimateMinutes ?? 25) / 60
    return (durationH / GRID_HOURS) * 100
  }

  // Build stacked offsets per block within a day to avoid full overlap
  function buildOffsets(tasks) {
    const blockOffsets = {}
    const offsets = {}
    for (const task of tasks) {
      const b = task.timeBlock
      blockOffsets[b] = (blockOffsets[b] ?? 0)
      offsets[task.id ?? task.templateId] = blockOffsets[b]
      blockOffsets[b] += task.estimateMinutes ?? 25
    }
    return offsets
  }

  return (
    <div>
      {/* Sync panel */}
      <div className="mb-4 flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <h2 className="text-sm font-semibold text-slate-700">Google Calendar Sync</h2>
          <p className="text-xs text-slate-500">
            {providerToken ? 'Compare your plan against actual calendar events.' : 'Sign in with Google to enable calendar sync.'}
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
            <h3 className="text-sm font-semibold text-amber-800">Calendar Differences Found</h3>
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
              <span><strong>{d.task.name}</strong> ({d.dayName}) — not found in Google Calendar</span>
            </div>
          ))}
          {calendarDiff.moved.map((m, i) => (
            <div key={i} className="mb-1 flex items-start gap-2 text-xs text-amber-700">
              <span className="mt-0.5 shrink-0 h-2 w-2 rounded-full bg-amber-500" />
              <span><strong>{m.task.name}</strong> — plan: {m.planDate}, calendar: {m.calDate}</span>
            </div>
          ))}
        </div>
      ) : calendarDiff ? (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Calendar matches plan — no differences found.
        </div>
      ) : null}

      {/* Time grid */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex" style={{ minWidth: 700 }}>
          {/* Hour labels */}
          <div className="w-12 shrink-0 border-r border-slate-100 pt-8">
            {Array.from({ length: GRID_HOURS + 1 }, (_, i) => (
              <div key={i} className="h-16 border-t border-slate-100 pr-1 text-right text-[10px] text-slate-400 leading-none -mt-2">
                {i + GRID_START}:00
              </div>
            ))}
          </div>

          {/* Day columns */}
          {DAY_NAMES.map((dayName) => {
            const dayData = planDays[dayName]
            const tasks = dayData?.tasks ?? []
            const offsets = buildOffsets(tasks)
            const gridHeight = GRID_HOURS * 64 // 64px per hour

            return (
              <div key={dayName} className="flex-1 border-r border-slate-100 last:border-r-0">
                <div className="border-b border-slate-200 p-2 text-center">
                  <p className="text-xs font-bold text-slate-700">{dayName.slice(0, 3)}</p>
                  {dayData?.date && <p className="text-[10px] text-slate-400">{dayData.date}</p>}
                </div>
                <div className="relative" style={{ height: gridHeight }}>
                  {/* Hour lines */}
                  {Array.from({ length: GRID_HOURS }, (_, i) => (
                    <div
                      key={i}
                      className="absolute left-0 right-0 border-t border-slate-100"
                      style={{ top: `${(i / GRID_HOURS) * 100}%` }}
                    />
                  ))}
                  {/* Task blocks */}
                  {tasks.map((task) => {
                    const track = normaliseTrack(task.track)
                    const color = TRACK_COLORS[track] ?? '#94a3b8'
                    const top = taskTopPct(task)
                    const height = taskHeightPct(task)
                    const id = task.id ?? task.templateId
                    const lib = taskLibrary.find((t) => t.id === task.templateId)

                    return (
                      <div
                        key={id}
                        className="absolute left-0.5 right-0.5 rounded px-1 py-0.5 text-[10px] text-white overflow-hidden"
                        style={{
                          top: `${top}%`,
                          height: `${height}%`,
                          backgroundColor: color,
                          minHeight: 18,
                        }}
                        title={`${task.name} — ${task.estimateMinutes}m`}
                      >
                        <p className="font-medium truncate leading-tight">{task.name ?? lib?.name}</p>
                        <p className="opacity-80">{task.estimateMinutes}m</p>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
