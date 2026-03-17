import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, X, Plus, Loader2, Tag } from 'lucide-react'
import {
  upsertWeeklyPlan,
  updatePlanAfterPublish,
  replaceTodayTasks,
  loadCalendarEventTags,
  upsertCalendarEventTag,
} from '../lib/supabaseSync'
import {
  createCalendarEventAtTime,
  patchCalendarEventTime,
  deleteCalendarEvent,
  fetchCoSACalendarEvents,
  fetchPersonalCalendarEvents,
} from '../lib/googleCalendar'

// ─── Constants ────────────────────────────────────────────────────────────────

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

const TRACK_LABELS = {
  advisors:   'Kuperman Advisors',
  networking: 'Shared (Networking)',
  jobSearch:  'Job Search',
  ventures:   'Kuperman Ventures',
  cosaAdmin:  'CoSA Administration',
}

const TRACK_COLORS = {
  advisors:   '#1E6B3C',
  networking: '#B8600B',
  jobSearch:  '#2E75B6',
  ventures:   '#9B6BAE',
  cosaAdmin:  '#0891b2',
}

const TRACK_SUB_TRACKS = {
  advisors:   ['Business Development', 'Materials', 'Content', 'Meetings'],
  networking: ['Coffee Chat', 'LinkedIn', 'Event', 'Other'],
  jobSearch:  ['Networking', 'Searching', 'Applications', 'L&D', 'Boards', 'Admin', 'Other'],
  ventures:   ['Alpha', 'Growth', 'Product', 'Research', 'Subscription', 'Build'],
  cosaAdmin:  ['Friday Review'],
}

const SUB_TRACK_TARGETS = {
  advisors: {
    weekly: 960,
    subTracks: { 'Business Development': 480, 'Materials': 192, 'Content': 96, 'Meetings': 192 },
  },
  networking: {
    weekly: 180,
    subTracks: { 'Coffee Chat': 60, 'LinkedIn': 60, 'Event': 30, 'Other': 30 },
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
}

// Calendar display parameters
const GRID_START_HOUR = 8       // 8am
const GRID_END_HOUR   = 20      // 8pm
const PX_PER_HOUR    = 64       // pixels per hour
const SNAP_MINUTES   = 15       // snap to 15-min intervals

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getWeekMondayStr(offsetWeeks = 0) {
  const d = new Date()
  const day = d.getDay()
  const daysToMonday = day === 0 ? 6 : day - 1
  d.setDate(d.getDate() - daysToMonday + offsetWeeks * 7)
  d.setHours(0, 0, 0, 0)
  return d.toISOString().split('T')[0]
}

function getWeekDates(mondayStr) {
  return DAY_NAMES.map((name, i) => {
    const d = new Date(mondayStr + 'T12:00:00')
    d.setDate(d.getDate() + i)
    return { name, date: d.toISOString().split('T')[0] }
  })
}

function formatWeekLabel(mondayStr) {
  const d = new Date(mondayStr + 'T12:00:00')
  const fri = new Date(d)
  fri.setDate(fri.getDate() + 4)
  const opts = { month: 'short', day: 'numeric' }
  return `${d.toLocaleDateString('en-US', opts)} – ${fri.toLocaleDateString('en-US', opts)}, ${fri.getFullYear()}`
}

function isoToMinutes(isoStr) {
  const d = new Date(isoStr)
  return d.getHours() * 60 + d.getMinutes()
}

function minutesToPx(minutes) {
  return ((minutes - GRID_START_HOUR * 60) / 60) * PX_PER_HOUR
}

function pxToMinutes(px) {
  return GRID_START_HOUR * 60 + (px / PX_PER_HOUR) * 60
}

function snapMinutes(mins) {
  return Math.round(mins / SNAP_MINUTES) * SNAP_MINUTES
}

function minsToTimeStr(totalMins) {
  const h = Math.floor(totalMins / 60) % 24
  const m = totalMins % 60
  const ampm = h >= 12 ? 'pm' : 'am'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m).padStart(2, '0')}${ampm}`
}

function buildISO(dateStr, totalMins) {
  const h = Math.floor(totalMins / 60) % 24
  const m = totalMins % 60
  return `${dateStr}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`
}

function eventDurationMins(ev) {
  if (!ev.start?.dateTime || !ev.end?.dateTime) return 30
  return Math.max(15, Math.round((new Date(ev.end.dateTime) - new Date(ev.start.dateTime)) / 60000))
}

function healthColor(assigned, target) {
  if (target === 0) return 'green'
  const pct = assigned / target
  if (pct >= 0.9) return 'green'
  if (pct >= 0.6) return 'yellow'
  return 'red'
}

// ─── Health Bars ──────────────────────────────────────────────────────────────

function HealthBars({ weekEvents, calendarTags }) {
  const totals = {}

  for (const ev of weekEvents) {
    const priv = ev.extendedProperties?.private ?? {}
    const track    = priv.cosaTrack    || null
    const subTrack = priv.cosaSubTrack || null
    if (!track) continue
    const dur = eventDurationMins(ev)
    if (!totals[track]) totals[track] = { total: 0, sub: {} }
    totals[track].total += dur
    if (subTrack) {
      totals[track].sub[subTrack] = (totals[track].sub[subTrack] ?? 0) + dur
    }
  }

  // also count tagged personal events
  for (const tag of Object.values(calendarTags)) {
    const { track, subTrack, durationMin } = tag
    if (!track || !durationMin) continue
    if (!totals[track]) totals[track] = { total: 0, sub: {} }
    totals[track].total += durationMin
    if (subTrack) {
      totals[track].sub[subTrack] = (totals[track].sub[subTrack] ?? 0) + durationMin
    }
  }

  return (
    <aside className="w-52 shrink-0 space-y-3 overflow-y-auto pb-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">This Week</p>
      {Object.entries(SUB_TRACK_TARGETS).map(([track, cfg]) => {
        const assigned = totals[track]?.total ?? 0
        const color = healthColor(assigned, cfg.weekly)
        const barW = cfg.weekly > 0 ? Math.min(100, (assigned / cfg.weekly) * 100) : 0
        const barCls = color === 'green' ? 'bg-emerald-500' : color === 'yellow' ? 'bg-amber-400' : 'bg-red-400'
        const textCls = color === 'green' ? 'text-emerald-700' : color === 'yellow' ? 'text-amber-700' : 'text-red-700'
        return (
          <div key={track}>
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-medium" style={{ color: TRACK_COLORS[track] }}>{TRACK_LABELS[track]}</span>
              <span className={`font-semibold ${textCls}`}>{assigned}m / {cfg.weekly}m</span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
              <div className={`h-full rounded-full transition-all ${barCls}`} style={{ width: `${barW}%` }} />
            </div>
            {Object.entries(cfg.subTracks).map(([st, tgt]) => {
              const stAssigned = totals[track]?.sub[st] ?? 0
              const stColor = healthColor(stAssigned, tgt)
              const stBarW = tgt > 0 ? Math.min(100, (stAssigned / tgt) * 100) : 0
              const stBarCls = stColor === 'green' ? 'bg-emerald-400' : stColor === 'yellow' ? 'bg-amber-300' : 'bg-red-300'
              return (
                <div key={st} className="ml-2 mt-1">
                  <div className="flex items-center justify-between text-[10px] text-slate-500">
                    <span className="truncate">{st}</span>
                    <span>{stAssigned}m</span>
                  </div>
                  <div className="mt-0.5 h-1 rounded-full bg-slate-100 overflow-hidden">
                    <div className={`h-full rounded-full ${stBarCls}`} style={{ width: `${stBarW}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        )
      })}
    </aside>
  )
}

// ─── Library Sidebar ──────────────────────────────────────────────────────────

function LibrarySidebar({ taskLibrary, onDragStart, collapsedTracks, setCollapsedTracks }) {
  const active = taskLibrary.filter((t) => t.status === 'Active')
  const byTrack = {}
  for (const t of active) {
    if (!byTrack[t.track]) byTrack[t.track] = {}
    const st = t.subTrack ?? 'General'
    if (!byTrack[t.track][st]) byTrack[t.track][st] = []
    byTrack[t.track][st].push(t)
  }

  return (
    <aside className="w-48 shrink-0 overflow-y-auto border-r border-slate-200 pr-2 pb-4">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Task Library</p>
      {Object.entries(byTrack).map(([track, subMap]) => {
        const isCollapsed = collapsedTracks[track]
        const color = TRACK_COLORS[track] ?? '#64748b'
        return (
          <div key={track} className="mb-2">
            <button
              type="button"
              onClick={() => setCollapsedTracks((p) => ({ ...p, [track]: !isCollapsed }))}
              className="flex w-full items-center gap-1 rounded px-1 py-0.5 text-left text-[11px] font-semibold hover:bg-slate-100"
              style={{ color }}
            >
              <span>{isCollapsed ? '▸' : '▾'}</span>
              {TRACK_LABELS[track] ?? track}
            </button>
            {!isCollapsed && Object.entries(subMap).map(([st, tasks]) => (
              <div key={st} className="ml-2 mt-1">
                <p className="mb-0.5 text-[10px] font-medium text-slate-400">{st}</p>
                {tasks.map((task) => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'library', taskId: task.id }))
                      e.dataTransfer.effectAllowed = 'copy'
                      onDragStart(task)
                    }}
                    className="mb-1 cursor-grab rounded border bg-white px-2 py-1 text-[11px] shadow-sm active:cursor-grabbing hover:shadow-md transition-shadow"
                    style={{ borderLeftColor: color, borderLeftWidth: 3 }}
                  >
                    <div className="truncate font-medium text-slate-700">{task.name}</div>
                    <div className="text-slate-400">{task.defaultTimeEstimate ?? 25}m</div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )
      })}
    </aside>
  )
}

// ─── Calendar Event Block ─────────────────────────────────────────────────────

function CalendarEventBlock({ ev, isPersonal, tag, onDelete, onTagClick }) {
  const priv = ev.extendedProperties?.private ?? {}
  const track = isPersonal ? tag?.track : priv.cosaTrack
  const color = TRACK_COLORS[track] ?? (isPersonal ? '#94a3b8' : '#64748b')
  const startMins = isoToMinutes(ev.start?.dateTime ?? '')
  const dur = eventDurationMins(ev)
  const top  = minutesToPx(startMins)
  const height = Math.max(20, (dur / 60) * PX_PER_HOUR)

  return (
    <div
      className={`absolute left-0.5 right-0.5 rounded px-1 py-0.5 text-[10px] overflow-hidden group
        ${isPersonal ? 'border border-dashed border-slate-300 bg-slate-50' : 'border-l-2 bg-white shadow-sm'}`}
      style={{ top, height, borderColor: isPersonal ? undefined : color }}
    >
      <div className="flex items-start justify-between gap-0.5">
        <span className={`leading-tight font-medium ${isPersonal ? 'text-slate-500' : 'text-slate-700'} truncate`}>
          {ev.summary ?? '(no title)'}
        </span>
        <div className="flex shrink-0 gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {isPersonal && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onTagClick?.(ev) }}
              className="rounded p-0.5 hover:bg-slate-200"
              title="Tag to track"
            >
              <Tag size={9} />
            </button>
          )}
          {!isPersonal && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onDelete?.(ev.id) }}
              className="rounded p-0.5 hover:bg-red-100 text-slate-400 hover:text-red-500"
              title="Delete event"
            >
              <X size={9} />
            </button>
          )}
        </div>
      </div>
      {height >= 32 && (
        <div className="text-slate-400 leading-none">{minsToTimeStr(startMins)} · {dur}m</div>
      )}
      {isPersonal && tag && (
        <div className="text-[9px]" style={{ color: TRACK_COLORS[tag.track] }}>
          {TRACK_LABELS[tag.track] ?? tag.track}
          {tag.subTrack ? ` · ${tag.subTrack}` : ''}
        </div>
      )}
    </div>
  )
}

// ─── Tag Modal ────────────────────────────────────────────────────────────────

function TagModal({ ev, calendarTags, onSave, onClose }) {
  const existing = ev ? calendarTags[ev.id] : null
  const [track, setTrack] = useState(existing?.track ?? 'advisors')
  const [subTrack, setSubTrack] = useState(existing?.subTrack ?? '')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-80 rounded-xl bg-white p-5 shadow-xl">
        <h3 className="mb-1 text-sm font-semibold">Tag Calendar Event</h3>
        <p className="mb-4 text-xs text-slate-500 truncate">{ev?.summary}</p>
        <label className="mb-1 block text-xs font-medium text-slate-700">Track</label>
        <select
          value={track}
          onChange={(e) => { setTrack(e.target.value); setSubTrack('') }}
          className="mb-3 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-300"
        >
          {Object.entries(TRACK_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <label className="mb-1 block text-xs font-medium text-slate-700">Sub-track (optional)</label>
        <select
          value={subTrack}
          onChange={(e) => setSubTrack(e.target.value)}
          className="mb-4 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-300"
        >
          <option value="">— none —</option>
          {(TRACK_SUB_TRACKS[track] ?? []).map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-slate-200 py-2 text-sm hover:bg-slate-50">Cancel</button>
          <button type="button" onClick={() => onSave(track, subTrack || null)} className="flex-1 rounded-lg bg-slate-900 py-2 text-sm font-semibold text-white hover:bg-slate-700">Save Tag</button>
        </div>
      </div>
    </div>
  )
}

// ─── Log Behind Modal ─────────────────────────────────────────────────────────

function LogBehindModal({ date, defaultStartMins, onSave, onClose }) {
  const [name, setName] = useState('')
  const [track, setTrack] = useState('advisors')
  const [subTrack, setSubTrack] = useState('')
  const [startMins, setStartMins] = useState(defaultStartMins ?? 9 * 60)
  const [durationMins, setDurationMins] = useState(30)

  function toTimeInput(mins) {
    const h = String(Math.floor(mins / 60) % 24).padStart(2, '0')
    const m = String(mins % 60).padStart(2, '0')
    return `${h}:${m}`
  }

  function fromTimeInput(str) {
    const [h, m] = str.split(':').map(Number)
    return h * 60 + (m || 0)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-80 rounded-xl bg-white p-5 shadow-xl">
        <h3 className="mb-1 text-sm font-semibold">Log Activity</h3>
        <p className="mb-3 text-xs text-slate-500">{date}</p>
        <label className="mb-1 block text-xs font-medium text-slate-700">Activity name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="What did you work on?"
          className="mb-3 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-300"
          autoFocus
        />
        <label className="mb-1 block text-xs font-medium text-slate-700">Track</label>
        <select value={track} onChange={(e) => { setTrack(e.target.value); setSubTrack('') }}
          className="mb-3 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-300">
          {Object.entries(TRACK_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <label className="mb-1 block text-xs font-medium text-slate-700">Sub-track</label>
        <select value={subTrack} onChange={(e) => setSubTrack(e.target.value)}
          className="mb-3 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-300">
          <option value="">— none —</option>
          {(TRACK_SUB_TRACKS[track] ?? []).map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <div className="mb-3 grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Start time</label>
            <input type="time" value={toTimeInput(startMins)} onChange={(e) => setStartMins(fromTimeInput(e.target.value))}
              className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Duration (min)</label>
            <input type="number" min={5} max={480} value={durationMins} onChange={(e) => setDurationMins(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-slate-200 py-2 text-sm hover:bg-slate-50">Cancel</button>
          <button type="button" disabled={!name.trim()} onClick={() => onSave({ name: name.trim(), track, subTrack: subTrack || null, startMins, endMins: startMins + durationMins })}
            className="flex-1 rounded-lg bg-slate-900 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-40">
            Log It
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Time Grid ────────────────────────────────────────────────────────────────

function TimeGrid({ weekDates, weekEvents, personalEvents, calendarTags, draggingTask, onDropLibraryTask, onDeleteEvent, onTagEvent, onLogBehind }) {
  const TOTAL_HOURS = GRID_END_HOUR - GRID_START_HOUR
  const gridHeight  = TOTAL_HOURS * PX_PER_HOUR
  const hours = Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => GRID_START_HOUR + i)
  const today = new Date().toISOString().split('T')[0]

  const eventsByDate = {}
  for (const ev of weekEvents) {
    const d = ev.start?.dateTime?.slice(0, 10)
    if (d) { if (!eventsByDate[d]) eventsByDate[d] = []; eventsByDate[d].push(ev) }
  }
  const personalByDate = {}
  for (const ev of personalEvents) {
    const d = ev.start?.dateTime?.slice(0, 10)
    if (d) { if (!personalByDate[d]) personalByDate[d] = []; personalByDate[d].push(ev) }
  }

  function handleDragOver(e) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }

  function handleDrop(e, dateStr) {
    e.preventDefault()
    const colEl = e.currentTarget
    const rect  = colEl.getBoundingClientRect()
    const relY  = e.clientY - rect.top
    const rawMins = pxToMinutes(relY)
    const snapped = snapMinutes(rawMins)
    const clamped = Math.max(GRID_START_HOUR * 60, Math.min((GRID_END_HOUR - 0.5) * 60, snapped))
    const raw = e.dataTransfer.getData('text/plain')
    if (!raw) return
    const data = JSON.parse(raw)
    if (data.type === 'library') {
      onDropLibraryTask(data.taskId, dateStr, clamped)
    }
  }

  function handleColumnClick(e, dateStr) {
    const colEl = e.currentTarget
    const rect  = colEl.getBoundingClientRect()
    const relY  = e.clientY - rect.top
    const rawMins = pxToMinutes(relY)
    const snapped = snapMinutes(rawMins)
    const clamped = Math.max(GRID_START_HOUR * 60, Math.min((GRID_END_HOUR - 0.5) * 60, snapped))
    onLogBehind(dateStr, clamped)
  }

  return (
    <div className="flex flex-1 overflow-x-auto">
      {/* Time ruler */}
      <div className="relative shrink-0 w-10 pr-1" style={{ height: gridHeight }}>
        {hours.map((h) => (
          <div key={h} className="absolute right-1 text-[9px] text-slate-400 leading-none"
            style={{ top: (h - GRID_START_HOUR) * PX_PER_HOUR - 4 }}>
            {h === 12 ? '12p' : h > 12 ? `${h - 12}p` : `${h}a`}
          </div>
        ))}
        {/* hour lines extend into columns via background */}
      </div>

      {/* Day columns */}
      {weekDates.map(({ name, date }) => {
        const isToday = date === today
        return (
          <div key={date} className="flex-1 min-w-0 border-l border-slate-200">
            {/* Day header */}
            <div className={`sticky top-0 z-10 border-b border-slate-200 px-1 py-1 text-center text-xs font-semibold
              ${isToday ? 'bg-slate-900 text-white' : 'bg-white text-slate-600'}`}>
              <div>{name.slice(0, 3)}</div>
              <div className="text-[10px] font-normal opacity-70">{date.slice(5)}</div>
            </div>

            {/* Drop zone */}
            <div
              className={`relative cursor-crosshair ${draggingTask ? 'bg-blue-50/50' : ''}`}
              style={{ height: gridHeight }}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, date)}
              onClick={(e) => handleColumnClick(e, date)}
            >
              {/* Hour grid lines */}
              {hours.map((h) => (
                <div key={h} className="absolute left-0 right-0 border-t border-slate-100"
                  style={{ top: (h - GRID_START_HOUR) * PX_PER_HOUR }} />
              ))}
              {/* Half-hour lines */}
              {hours.slice(0, -1).map((h) => (
                <div key={`${h}-half`} className="absolute left-0 right-0 border-t border-slate-50"
                  style={{ top: (h - GRID_START_HOUR) * PX_PER_HOUR + PX_PER_HOUR / 2 }} />
              ))}

              {/* Personal events */}
              {(personalByDate[date] ?? []).map((ev) => (
                <CalendarEventBlock
                  key={ev.id}
                  ev={ev}
                  isPersonal
                  tag={calendarTags[ev.id] ?? null}
                  onTagClick={onTagEvent}
                />
              ))}

              {/* CoSA events */}
              {(eventsByDate[date] ?? []).map((ev) => (
                <CalendarEventBlock
                  key={ev.id}
                  ev={ev}
                  isPersonal={false}
                  tag={null}
                  onDelete={onDeleteEvent}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function WeekPlanner({
  taskLibrary,
  session,
  supabaseConfigured,
}) {
  const [weekOffset, setWeekOffset] = useState(0)
  const [weekEvents, setWeekEvents]       = useState([])
  const [personalEvents, setPersonalEvents] = useState([])
  const [calendarTags, setCalendarTags]   = useState({})
  const [loading, setLoading]             = useState(false)
  const [draggingTask, setDraggingTask]   = useState(null)
  const [tagModal, setTagModal]           = useState(null)
  const [logModal, setLogModal]           = useState(null)
  const [collapsedTracks, setCollapsedTracks] = useState({})
  const [error, setError]                 = useState('')

  const mondayStr  = getWeekMondayStr(weekOffset)
  const weekDates  = getWeekDates(mondayStr)
  const providerToken = session?.provider_token ?? null

  // ── Fetch GCal events for the displayed week ──────────────────────────────
  const fetchWeek = useCallback(async () => {
    if (!providerToken) return
    setLoading(true)
    setError('')
    try {
      const friday  = weekDates[4].date
      const timeMin = `${mondayStr}T00:00:00Z`
      const timeMax = `${friday}T23:59:59Z`

      const [cosa, personal] = await Promise.all([
        fetchCoSACalendarEvents(providerToken, timeMin, timeMax),
        fetchPersonalCalendarEvents(providerToken, timeMin, timeMax),
      ])
      setWeekEvents(cosa)
      setPersonalEvents(personal)
    } catch (err) {
      setError('Failed to load calendar events.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [providerToken, mondayStr])

  useEffect(() => { fetchWeek() }, [fetchWeek])

  // ── Load calendar tags from Supabase ──────────────────────────────────────
  useEffect(() => {
    if (!supabaseConfigured || !session?.user?.id) return
    loadCalendarEventTags(session.user.id).then(setCalendarTags)
  }, [session?.user?.id, supabaseConfigured])

  // ── Drop library task onto time grid ─────────────────────────────────────
  async function handleDropLibraryTask(taskId, dateStr, startMins) {
    if (!providerToken) { setError('Sign in with Google to create calendar events.'); return }
    const task = taskLibrary.find((t) => t.id === taskId)
    if (!task) return
    const dur = task.defaultTimeEstimate ?? 30
    const endMins = startMins + dur
    const startISO = buildISO(dateStr, startMins)
    const endISO   = buildISO(dateStr, endMins)
    const newEv = await createCalendarEventAtTime({
      name: task.name,
      track: task.track,
      subTrack: task.subTrack ?? null,
      templateId: task.id,
      startISO,
      endISO,
      providerToken,
    })
    if (newEv) {
      setWeekEvents((prev) => [...prev, newEv])
    } else {
      setError('Failed to create calendar event.')
    }
  }

  // ── Delete a CoSA event ───────────────────────────────────────────────────
  async function handleDeleteEvent(eventId) {
    if (!providerToken) return
    await deleteCalendarEvent(eventId, providerToken)
    setWeekEvents((prev) => prev.filter((e) => e.id !== eventId))
  }

  // ── Tag a personal event ──────────────────────────────────────────────────
  function handleOpenTag(ev) { setTagModal(ev) }

  async function handleSaveTag(track, subTrack) {
    if (!tagModal || !session?.user?.id) return
    const ev = tagModal
    const dur = eventDurationMins(ev)
    const date = ev.start?.dateTime?.slice(0, 10) ?? null
    const tag = { track, subTrack, title: ev.summary, durationMin: dur, date }
    if (supabaseConfigured) {
      await upsertCalendarEventTag(session.user.id, ev.id, tag)
    }
    setCalendarTags((prev) => ({ ...prev, [ev.id]: tag }))
    setTagModal(null)
  }

  // ── Log behind (click on past time slot) ─────────────────────────────────
  function handleLogBehind(dateStr, startMins) {
    setLogModal({ date: dateStr, startMins })
  }

  async function handleSaveLog({ name, track, subTrack, startMins, endMins }) {
    if (!logModal) return
    const startISO = buildISO(logModal.date, startMins)
    const endISO   = buildISO(logModal.date, endMins)
    if (providerToken) {
      const newEv = await createCalendarEventAtTime({
        name,
        track,
        subTrack,
        templateId: null,
        startISO,
        endISO,
        providerToken,
      })
      if (newEv) setWeekEvents((prev) => [...prev, newEv])
    }
    setLogModal(null)
  }

  const noCalendar = !providerToken

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 5rem)' }}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setWeekOffset((w) => w - 1)}
            className="rounded-md p-1 hover:bg-slate-100 text-slate-500">
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-semibold text-slate-700">{formatWeekLabel(mondayStr)}</span>
          <button type="button" onClick={() => setWeekOffset((w) => w + 1)}
            className="rounded-md p-1 hover:bg-slate-100 text-slate-500">
            <ChevronRight size={16} />
          </button>
          {weekOffset !== 0 && (
            <button type="button" onClick={() => setWeekOffset(0)}
              className="ml-1 rounded-md px-2 py-0.5 text-xs text-slate-500 hover:bg-slate-100">
              Today
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {loading && <Loader2 size={14} className="animate-spin text-slate-400" />}
          {error && <span className="text-xs text-red-500">{error}</span>}
          {noCalendar && (
            <span className="text-xs text-amber-600">Sign in with Google to sync calendar</span>
          )}
          <button type="button" onClick={fetchWeek}
            className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-500 hover:bg-slate-100">
            Refresh
          </button>
          <button type="button" onClick={() => setLogModal({ date: weekDates[0].date, startMins: 9 * 60 })}
            className="flex items-center gap-1 rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-white hover:bg-slate-700">
            <Plus size={12} /> Log Activity
          </button>
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 gap-3 overflow-hidden px-3 pt-3">
        <LibrarySidebar
          taskLibrary={taskLibrary}
          onDragStart={setDraggingTask}
          collapsedTracks={collapsedTracks}
          setCollapsedTracks={setCollapsedTracks}
        />

        <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="flex flex-1 overflow-y-auto overflow-x-auto">
            <TimeGrid
              weekDates={weekDates}
              weekEvents={weekEvents}
              personalEvents={personalEvents}
              calendarTags={calendarTags}
              draggingTask={draggingTask}
              onDropLibraryTask={handleDropLibraryTask}
              onDeleteEvent={handleDeleteEvent}
              onTagEvent={handleOpenTag}
              onLogBehind={handleLogBehind}
            />
          </div>
        </div>

        <HealthBars weekEvents={weekEvents} calendarTags={calendarTags} />
      </div>

      {/* ── Modals ──────────────────────────────────────────────────────── */}
      {tagModal && (
        <TagModal
          ev={tagModal}
          calendarTags={calendarTags}
          onSave={handleSaveTag}
          onClose={() => setTagModal(null)}
        />
      )}
      {logModal && (
        <LogBehindModal
          date={logModal.date}
          defaultStartMins={logModal.startMins}
          onSave={handleSaveLog}
          onClose={() => setLogModal(null)}
        />
      )}
    </div>
  )
}
