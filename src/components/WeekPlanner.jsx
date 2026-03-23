import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, X, Plus, Loader2, Tag, Settings } from 'lucide-react'
import {
  upsertWeeklyPlan,
  updatePlanAfterPublish,
  replaceTodayTasks,
  loadCalendarEventTags,
  upsertCalendarEventTag,
} from '../lib/supabaseSync'
import {
  createCalendarEventAtTime,
  updateCalendarEventAtTime,
  deleteCalendarEvent,
  fetchAllCalendarEvents,
  fetchPersonalCalendarEvents,
} from '../lib/googleCalendar'
import {
  buildCalendarHealthModel,
  COSA_ALLOCATION_DEFAULTS,
  eventDurationMins,
  formatLocalDate,
  allocationSubTrackKey,
} from '../lib/calendarWeekHealthModel'
import { quickLogGroupsForTrack } from '../lib/quickLogKpis'

// ─── Constants ────────────────────────────────────────────────────────────────

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const TRACK_LABELS = {
  advisors:    'Kuperman Advisors',
  jobSearch:   'Job Search',
  ventures:    'Kuperman Ventures',
  networking:  'Shared Networking',
  development: 'Development',
  cosaAdmin:   'Administration',
}

const TRACK_COLORS = {
  advisors:    '#1E6B3C',
  jobSearch:   '#2E75B6',
  ventures:    '#9B6BAE',
  networking:  '#B8600B',
  development: '#7c3aed',
  cosaAdmin:   '#0891b2',
}

const TRACK_SUB_TRACKS = {
  advisors:    ['Networking & Business Development', 'Materials', 'Product', 'Client Work', 'Back Office'],
  jobSearch:   ['Network Development & Outreach', 'Searching', 'Materials'],
  ventures:    ['Alpha', 'Product', 'Beta Prep'],
  networking:  [],
  development: [],
  cosaAdmin:   [],
}

// Default allocation targets (sub-track values are percentages of the weekly total).
// Persisted to localStorage as 'cosa.allocations'; bump ALLOC_VERSION when structure changes
// to force a reset of stale cached data.
const ALLOC_VERSION = 'v2'
const DEFAULT_ALLOCATIONS = COSA_ALLOCATION_DEFAULTS

// Calendar display parameters
const GRID_START_HOUR = 8       // 8am
const GRID_END_HOUR   = 20      // 8pm
const PX_PER_HOUR    = 64       // pixels per hour
const SNAP_MINUTES   = 15       // snap to 15-min intervals

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Local calendar day for a GCal dateTime string (for Supabase tags vs week filter). */
function dateTimeToLocalYmd(isoStr) {
  if (!isoStr) return null
  return formatLocalDate(new Date(isoStr))
}

function getWeekMondayStr(offsetWeeks = 0) {
  const d = new Date()
  const day = d.getDay()
  const daysToMonday = day === 0 ? 6 : day - 1
  d.setDate(d.getDate() - daysToMonday + offsetWeeks * 7)
  d.setHours(0, 0, 0, 0)
  return formatLocalDate(d)
}

function getWeekDates(mondayStr) {
  const anchor = new Date(`${mondayStr}T12:00:00`)
  return DAY_NAMES.map((name, i) => {
    const d = new Date(anchor)
    d.setDate(anchor.getDate() + i)
    return { name, date: formatLocalDate(d) }
  })
}

function formatWeekLabel(mondayStr) {
  const d = new Date(mondayStr + 'T12:00:00')
  const sun = new Date(d)
  sun.setDate(d.getDate() + 6)
  const opts = { month: 'short', day: 'numeric' }
  return `${d.toLocaleDateString('en-US', opts)} – ${sun.toLocaleDateString('en-US', opts)}, ${sun.getFullYear()}`
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

function healthColor(assigned, target) {
  if (target === 0) return 'green'
  const pct = assigned / target
  if (pct >= 0.9) return 'green'
  if (pct >= 0.6) return 'yellow'
  return 'red'
}

// ─── Allocation Editor Modal ──────────────────────────────────────────────────

function AllocationEditor({ allocations, onSave, onClose }) {
  const [draft, setDraft] = useState(() => JSON.parse(JSON.stringify(allocations)))

  function setWeekly(track, val) {
    const v = Math.max(0, parseInt(val) || 0)
    setDraft((p) => ({ ...p, [track]: { ...p[track], weekly: v } }))
  }

  function setPct(track, subTrack, val) {
    const v = Math.max(0, Math.min(100, parseInt(val) || 0))
    setDraft((p) => ({
      ...p,
      [track]: { ...p[track], subTracks: { ...p[track].subTracks, [subTrack]: v } },
    }))
  }

  function pctTotal(track) {
    return Object.values(draft[track]?.subTracks ?? {}).reduce((s, v) => s + v, 0)
  }

  const isValid = Object.keys(draft).every((track) => {
    const hasSubs = Object.keys(draft[track].subTracks).length > 0
    return !hasSubs || pctTotal(track) <= 100
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex w-full max-w-lg flex-col rounded-xl bg-white shadow-xl" style={{ maxHeight: '90vh' }}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Allocation Targets</h3>
            <p className="text-xs text-slate-500 mt-0.5">Set weekly targets and sub-track splits per track</p>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 hover:bg-slate-100">
            <X size={14} className="text-slate-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {Object.entries(draft).map(([track, cfg]) => {
            const total = pctTotal(track)
            const hasSubs = Object.keys(cfg.subTracks).length > 0
            const totalCls = total > 100 ? 'text-red-500' : total === 100 ? 'text-emerald-600' : 'text-amber-500'
            return (
              <div key={track} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold" style={{ color: TRACK_COLORS[track] }}>
                    {TRACK_LABELS[track]}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <label className="text-[11px] text-slate-400">Weekly target</label>
                    <input
                      type="number"
                      min={0}
                      max={2000}
                      value={cfg.weekly}
                      onChange={(e) => setWeekly(track, e.target.value)}
                      className="w-16 rounded border border-slate-200 px-1.5 py-0.5 text-xs text-right outline-none focus:ring-1 focus:ring-indigo-300"
                    />
                    <span className="text-[11px] text-slate-400">min</span>
                  </div>
                </div>

                {hasSubs && (
                  <div className="space-y-1.5 mt-2 border-t border-slate-100 pt-2">
                    <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-1.5">Sub-track split (% of weekly)</p>
                    {Object.entries(cfg.subTracks).map(([st, pct]) => (
                      <div key={st} className="flex items-center gap-2">
                        <span className="flex-1 text-[11px] text-slate-600 truncate">{st}</span>
                        <span className="text-[11px] text-slate-400">
                          {Math.round((pct / 100) * cfg.weekly)}m
                        </span>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={pct}
                          onChange={(e) => setPct(track, st, e.target.value)}
                          className="w-14 rounded border border-slate-200 px-1.5 py-0.5 text-xs text-right outline-none focus:ring-1 focus:ring-indigo-300"
                        />
                        <span className="text-[11px] text-slate-400 w-3">%</span>
                      </div>
                    ))}
                    <div className={`text-right text-[11px] font-semibold pt-1 ${totalCls}`}>
                      {total > 100
                        ? `⚠ Total ${total}% — exceeds 100%`
                        : total === 100
                        ? `✓ Total 100%`
                        : `Total ${total}% · ${100 - total}% unallocated`}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => isValid && onSave(draft)}
            disabled={!isValid}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-40"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Health Bars ──────────────────────────────────────────────────────────────

function HealthBars({ healthModel, loggedTotals = {}, trackTargets, onEditAllocations, onOpenHealthDetail }) {
  const { totals: calTotals, contributors } = healthModel

  return (
    <aside className="w-52 shrink-0 space-y-3 overflow-y-auto pb-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">This Week</p>
        <button
          type="button"
          onClick={onEditAllocations}
          className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          title="Edit allocation targets"
        >
          <Settings size={11} />
        </button>
      </div>
      {Object.entries(trackTargets).map(([track, cfg]) => {
        // Primary: actual logged (timer sessions) — this is the real measure
        const logged = loggedTotals[track]?.total ?? 0
        // Secondary ghost: planned calendar time (shown lighter behind primary)
        const planned = calTotals[track]?.total ?? 0
        const color = healthColor(logged, cfg.weekly)
        const loggedW = cfg.weekly > 0 ? Math.min(100, (logged / cfg.weekly) * 100) : 0
        const plannedW = cfg.weekly > 0 ? Math.min(100, (planned / cfg.weekly) * 100) : 0
        const barCls = color === 'green' ? 'bg-emerald-500' : color === 'yellow' ? 'bg-amber-400' : 'bg-red-400'
        const textCls = color === 'green' ? 'text-emerald-700' : color === 'yellow' ? 'text-amber-700' : 'text-red-700'
        return (
          <div key={track}>
            <button
              type="button"
              onClick={() =>
                onOpenHealthDetail({
                  title: `${TRACK_LABELS[track]} — all calendar time this week`,
                  targetMins: cfg.weekly,
                  items: contributors[track]?.all ?? [],
                })}
              className="group w-full rounded-md text-left outline-none ring-slate-300 focus-visible:ring-2 hover:bg-slate-50"
              title="Show calendar events contributing to this track"
            >
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-medium truncate group-hover:underline" style={{ color: TRACK_COLORS[track] }}>{TRACK_LABELS[track]}</span>
                <span className={`font-semibold shrink-0 ml-1 ${textCls}`}>{logged}m / {cfg.weekly}m</span>
              </div>
              {/* Stacked bars: ghost = planned, solid = logged */}
              <div className="relative mt-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                {plannedW > loggedW && (
                  <div className="absolute inset-y-0 left-0 rounded-full opacity-25 bg-slate-400" style={{ width: `${plannedW}%` }} />
                )}
                <div className={`absolute inset-y-0 left-0 rounded-full transition-all ${barCls}`} style={{ width: `${loggedW}%` }} />
              </div>
              {planned > 0 && logged < planned && (
                <p className="mt-0.5 text-[10px] text-slate-400">{planned}m planned</p>
              )}
            </button>
            {Object.entries(cfg.subTracks).map(([st, tgt]) => {
              const stLogged = loggedTotals[track]?.sub[st] ?? 0
              const stPlanned = calTotals[track]?.sub[st] ?? 0
              const stColor = healthColor(stLogged, tgt)
              const stLoggedW = tgt > 0 ? Math.min(100, (stLogged / tgt) * 100) : 0
              const stPlannedW = tgt > 0 ? Math.min(100, (stPlanned / tgt) * 100) : 0
              const stBarCls = stColor === 'green' ? 'bg-emerald-400' : stColor === 'yellow' ? 'bg-amber-300' : 'bg-red-300'
              return (
                <div key={st} className="ml-2 mt-1">
                  <button
                    type="button"
                    onClick={() =>
                      onOpenHealthDetail({
                        title: `${TRACK_LABELS[track]} — ${st}`,
                        targetMins: tgt,
                        items: contributors[track]?.bySub[st] ?? [],
                      })}
                    className="group w-full rounded-md text-left outline-none ring-slate-300 focus-visible:ring-2 hover:bg-slate-50"
                    title="Show events counted in this sub-track bucket"
                  >
                    <div className="flex items-center justify-between text-[10px] text-slate-500">
                      <span className="truncate group-hover:underline">{st}</span>
                      <span className="shrink-0 ml-1">{stLogged}m / {tgt}m</span>
                    </div>
                    <div className="relative mt-0.5 h-1 rounded-full bg-slate-100 overflow-hidden">
                      {stPlannedW > stLoggedW && (
                        <div className="absolute inset-y-0 left-0 rounded-full opacity-25 bg-slate-400" style={{ width: `${stPlannedW}%` }} />
                      )}
                      <div className={`absolute inset-y-0 left-0 rounded-full ${stBarCls}`} style={{ width: `${stLoggedW}%` }} />
                    </div>
                  </button>
                </div>
              )
            })}
          </div>
        )
      })}
    </aside>
  )
}

/** Drill-down list for This Week bars (same UX idea as Weekly Review KPI modal). */
function CalendarHealthDetailModal({ detail, onClose }) {
  if (!detail) return null
  const sorted = [...detail.items].sort((a, b) => (b.sortKey || '').localeCompare(a.sortKey || ''))
  const sumMins = sorted.reduce((s, it) => s + it.minutes, 0)

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h3 className="pr-2 text-sm font-semibold text-slate-900">{detail.title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {sorted.length === 0 ? (
            <p className="text-sm italic text-slate-400">
              No events in this bucket. If the track total is higher, some events may have no sub-track or a
              sub-track that doesn&apos;t match an allocation row — open the event on the grid and set track /
              sub-track to match.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {sorted.map((it) => {
                const src =
                  it.source === 'cosa-calendar' ? 'CoSA calendar' : 'Personal calendar · tagged'
                const remap =
                  it.allocationBucket &&
                  it.rawSubTrack &&
                  it.rawSubTrack !== it.allocationBucket
                    ? ` → counts toward “${it.allocationBucket}”`
                    : ''
                const subLine = it.rawSubTrack
                  ? `Sub-track on event: “${it.rawSubTrack}”${remap}`
                  : it.allocationBucket
                    ? `Allocation bucket: “${it.allocationBucket}”`
                    : null
                return (
                  <li key={it.id} className="py-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-slate-800">{it.title}</p>
                        <p className="mt-0.5 text-[11px] text-slate-400">{src}</p>
                        {subLine && <p className="mt-0.5 text-[11px] text-slate-500">{subLine}</p>}
                        {it.splitNote && (
                          <p className="mt-0.5 text-[11px] text-amber-800">{it.splitNote}</p>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-[11px] font-medium text-slate-700">{it.minutes}m</p>
                        <p className="text-[11px] text-slate-400">{it.dayLabel}</p>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
        {sorted.length > 0 && (
          <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-4 py-2.5 text-xs text-slate-600">
            <span>
              {sorted.length} event{sorted.length !== 1 ? 's' : ''}
            </span>
            <span className="font-semibold">
              {sumMins}m logged · target {detail.targetMins}m
            </span>
          </div>
        )}
      </div>
    </div>
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

function CalendarEventBlock({ ev, isPersonal, isUntaggedCosa, tag, onDelete, onTagClick, onEdit }) {
  const priv = ev.extendedProperties?.private ?? {}
  const track = isPersonal ? tag?.track : priv.cosaTrack
  const color = TRACK_COLORS[track] ?? (isPersonal ? '#94a3b8' : '#64748b')
  const startMins = isoToMinutes(ev.start?.dateTime ?? '')
  const dur = eventDurationMins(ev)
  const top  = minutesToPx(startMins)
  const height = Math.max(20, (dur / 60) * PX_PER_HOUR)

  const needsTag = isPersonal || isUntaggedCosa

  return (
    <div
      className={`absolute left-0.5 right-0.5 rounded px-1 py-0.5 text-[10px] overflow-hidden group
        ${isUntaggedCosa
          ? 'border border-dashed border-amber-400 bg-amber-50'
          : isPersonal
            ? 'border border-dashed border-slate-300 bg-slate-50'
            : 'border-l-2 bg-white shadow-sm cursor-pointer hover:brightness-95'
        }`}
      style={{ top, height, borderColor: needsTag ? undefined : color }}
      onClick={!needsTag ? (e) => { e.stopPropagation(); onEdit?.(ev) } : undefined}
    >
      <div className="flex items-start justify-between gap-0.5">
        <span className={`leading-tight font-medium ${needsTag ? (isUntaggedCosa ? 'text-amber-700' : 'text-slate-500') : 'text-slate-700'} truncate`}>
          {ev.summary ?? '(no title)'}
        </span>
        <div className="flex shrink-0 gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {needsTag && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onTagClick?.(ev) }}
              className={`rounded p-0.5 ${isUntaggedCosa ? 'hover:bg-amber-200' : 'hover:bg-slate-200'}`}
              title={isUntaggedCosa ? 'Tag this CoSA Calendar event' : 'Tag to track'}
            >
              <Tag size={9} />
            </button>
          )}
        </div>
      </div>
      {height >= 32 && (
        <div className={`leading-none ${isUntaggedCosa ? 'text-amber-500' : 'text-slate-400'}`}>
          {minsToTimeStr(startMins)} · {dur}m
        </div>
      )}
      {!needsTag && priv.cosaSubTrack && (
        <div className="truncate text-[9px] text-slate-400">{priv.cosaSubTrack}</div>
      )}
      {isPersonal && tag && (
        <div className="text-[9px]" style={{ color: TRACK_COLORS[tag.track] }}>
          {TRACK_LABELS[tag.track] ?? tag.track}
          {tag.subTrack ? ` · ${tag.subTrack}` : ''}
        </div>
      )}
      {isUntaggedCosa && (
        <div className="text-[9px] text-amber-500 italic">tap to tag</div>
      )}
    </div>
  )
}

// ─── Tag Modal ────────────────────────────────────────────────────────────────

function TagModal({ ev, calendarTags, onSave, onClose }) {
  const existing = ev ? calendarTags[ev.id] : null
  const [track, setTrack] = useState(existing?.track ?? 'advisors')
  const [subTrack, setSubTrack] = useState(existing?.subTrack ?? '')
  const [kpiCredits, setKpiCredits] = useState(() =>
    Array.isArray(existing?.kpiCredits) ? [...existing.kpiCredits] : [],
  )
  const [kpiQuantities, setKpiQuantities] = useState(() => ({
    ...(existing?.kpiQuantities && typeof existing.kpiQuantities === 'object' ? existing.kpiQuantities : {}),
  }))

  const kpiGroups = quickLogGroupsForTrack(track)

  function setTrackAndPruneKpis(nextTrack) {
    setTrack(nextTrack)
    setSubTrack('')
    const valid = new Set(
      quickLogGroupsForTrack(nextTrack).flatMap((g) => g.kpis.map((k) => k.mapping)),
    )
    setKpiCredits((prev) => prev.filter((m) => valid.has(m)))
    setKpiQuantities((prev) => {
      const next = {}
      for (const m of Object.keys(prev)) {
        if (valid.has(m)) next[m] = prev[m]
      }
      return next
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-xl bg-white shadow-xl">
        <div className="overflow-y-auto p-5">
          <h3 className="mb-1 text-sm font-semibold">Tag Calendar Event</h3>
          <p className="mb-4 text-xs text-slate-500 truncate">{ev?.summary}</p>
          <label className="mb-1 block text-xs font-medium text-slate-700">Track</label>
          <select
            value={track}
            onChange={(e) => setTrackAndPruneKpis(e.target.value)}
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

          <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50/80 p-3">
            <p className="mb-2 text-xs font-semibold text-slate-700">KPI credits (optional)</p>
            <p className="mb-2 text-[11px] text-slate-500">
              Check any outcomes this calendar block contributed toward for weekly review.
            </p>
            {kpiGroups.length === 0 ? (
              <p className="text-xs italic text-slate-400">No KPI list for this track — time still counts toward allocations.</p>
            ) : (
              <div className="max-h-48 space-y-3 overflow-y-auto pr-1">
                {kpiGroups.map((grp) => (
                  <div key={grp.group}>
                    <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: grp.color }} />
                      {grp.group}
                    </p>
                    <div className="space-y-1">
                      {grp.kpis.map(({ mapping, label }) => {
                        const checked = kpiCredits.includes(mapping)
                        const qty = kpiQuantities[mapping] ?? 1
                        return (
                          <div key={mapping} className="flex items-center gap-2">
                            <label className="flex flex-1 cursor-pointer items-center gap-2">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => {
                                  setKpiCredits((prev) =>
                                    checked ? prev.filter((m) => m !== mapping) : [...prev, mapping],
                                  )
                                  setKpiQuantities((prev) => {
                                    if (checked) {
                                      const { [mapping]: _, ...rest } = prev
                                      return rest
                                    }
                                    return { ...prev, [mapping]: prev[mapping] ?? 1 }
                                  })
                                }}
                                className="h-3.5 w-3.5 rounded accent-slate-900"
                              />
                              <span className="text-xs text-slate-700">{label}</span>
                            </label>
                            {checked && (
                              <div className="flex items-center gap-0.5">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setKpiQuantities((p) => ({
                                      ...p,
                                      [mapping]: Math.max(1, (p[mapping] ?? 1) - 1),
                                    }))
                                  }
                                  className="flex h-5 w-5 items-center justify-center rounded border border-slate-200 text-[10px] text-slate-500 hover:bg-slate-100"
                                >−</button>
                                <span className="w-6 text-center text-xs font-medium text-slate-800">{qty}</span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setKpiQuantities((p) => ({
                                      ...p,
                                      [mapping]: (p[mapping] ?? 1) + 1,
                                    }))
                                  }
                                  className="flex h-5 w-5 items-center justify-center rounded border border-slate-200 text-[10px] text-slate-500 hover:bg-slate-100"
                                >+</button>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-2 border-t border-slate-100 p-4">
          <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-slate-200 py-2 text-sm hover:bg-slate-50">Cancel</button>
          <button
            type="button"
            onClick={() =>
              onSave(track, subTrack || null, {
                kpiCredits,
                kpiQuantities: Object.fromEntries(
                  kpiCredits.map((m) => [m, kpiQuantities[m] ?? 1]),
                ),
              })
            }
            className="flex-1 rounded-lg bg-slate-900 py-2 text-sm font-semibold text-white hover:bg-slate-700"
          >
            Save Tag
          </button>
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

// ─── Edit Event Modal (CoSA events) ──────────────────────────────────────────

function EditEventModal({ ev, onSave, onDelete, onClose }) {
  const priv = ev.extendedProperties?.private ?? {}
  const startMinsInit = isoToMinutes(ev.start?.dateTime ?? '')
  const dur = eventDurationMins(ev)

  const [name, setName]           = useState(ev.summary ?? '')
  const [track, setTrack]         = useState(priv.cosaTrack ?? 'advisors')
  const [subTrack, setSubTrack]   = useState(priv.cosaSubTrack ?? '')
  const [startMins, setStartMins] = useState(startMinsInit)
  const [durationMins, setDurationMins] = useState(dur || 30)
  const [saving, setSaving]       = useState(false)

  const dateStr = ev.start?.dateTime?.slice(0, 10) ?? ''

  function toTimeInput(mins) {
    const h = String(Math.floor(mins / 60)).padStart(2, '0')
    const m = String(mins % 60).padStart(2, '0')
    return `${h}:${m}`
  }
  function fromTimeInput(str) {
    const [h, m] = str.split(':').map(Number)
    return h * 60 + (m || 0)
  }

  async function handleSave() {
    if (!name.trim()) return
    setSaving(true)
    const startISO = buildISO(dateStr, startMins)
    const endISO   = buildISO(dateStr, startMins + durationMins)
    await onSave(ev.id, { name: name.trim(), track, subTrack: subTrack || null, startISO, endISO })
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-80 rounded-xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Edit Calendar Event</h3>
          <button type="button" onClick={onClose} className="rounded p-1 hover:bg-slate-100">
            <X size={14} className="text-slate-400" />
          </button>
        </div>

        <label className="mb-1 block text-xs font-medium text-slate-700">Event name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          className="mb-3 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-300"
        />

        <label className="mb-1 block text-xs font-medium text-slate-700">Track</label>
        <select
          value={track}
          onChange={(e) => { setTrack(e.target.value); setSubTrack('') }}
          className="mb-3 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-300"
        >
          {Object.entries(TRACK_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>

        <label className="mb-1 block text-xs font-medium text-slate-700">Sub-track</label>
        <select
          value={subTrack}
          onChange={(e) => setSubTrack(e.target.value)}
          className="mb-3 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-300"
        >
          <option value="">— none —</option>
          {(TRACK_SUB_TRACKS[track] ?? []).map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        <div className="mb-4 grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Start time</label>
            <input
              type="time"
              value={toTimeInput(startMins)}
              onChange={(e) => setStartMins(fromTimeInput(e.target.value))}
              className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Duration (min)</label>
            <input
              type="number"
              min={5}
              max={480}
              value={durationMins}
              onChange={(e) => setDurationMins(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onDelete(ev.id)}
            className="rounded-lg border border-rose-200 px-3 py-2 text-sm text-rose-600 hover:bg-rose-50"
          >
            Delete
          </button>
          <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-slate-200 py-2 text-sm hover:bg-slate-50">
            Cancel
          </button>
          <button
            type="button"
            disabled={!name.trim() || saving}
            onClick={handleSave}
            className="flex-1 rounded-lg bg-slate-900 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-40"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Time Grid ────────────────────────────────────────────────────────────────

function TimeGrid({ weekDates, weekEvents, untaggedCosaEvents = [], personalEvents, calendarTags, draggingTask, onDropLibraryTask, onDeleteEvent, onTagEvent, onEditEvent, onLogBehind }) {
  const TOTAL_HOURS = GRID_END_HOUR - GRID_START_HOUR
  const gridHeight  = TOTAL_HOURS * PX_PER_HOUR
  const hours = Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => GRID_START_HOUR + i)
  const today = new Date().toISOString().split('T')[0]

  const eventsByDate = {}
  for (const ev of weekEvents) {
    const d = ev.start?.dateTime?.slice(0, 10)
    if (d) { if (!eventsByDate[d]) eventsByDate[d] = []; eventsByDate[d].push(ev) }
  }
  const untaggedCosaByDate = {}
  for (const ev of untaggedCosaEvents) {
    const d = ev.start?.dateTime?.slice(0, 10)
    if (d) { if (!untaggedCosaByDate[d]) untaggedCosaByDate[d] = []; untaggedCosaByDate[d].push(ev) }
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
          <div key={date} className="min-w-[100px] flex-1 border-l border-slate-200">
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

              {/* User-created CoSA Calendar events (no cosaTag yet) — taggable */}
              {(untaggedCosaByDate[date] ?? []).map((ev) => (
                <CalendarEventBlock
                  key={ev.id}
                  ev={ev}
                  isUntaggedCosa
                  tag={null}
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
                  onEdit={onEditEvent}
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
  onTodayEventCreated,
  onCalendarTagsUpdated,
  completionLog = [],
}) {
  // Default to next week on Sunday so the planner opens ready for planning
  const [weekOffset, setWeekOffset] = useState(() => new Date().getDay() === 0 ? 1 : 0)
  const [weekEvents, setWeekEvents]               = useState([])
  const [untaggedCosaEvents, setUntaggedCosaEvents] = useState([])
  const [personalEvents, setPersonalEvents]         = useState([])
  const [calendarTags, setCalendarTags]   = useState({})
  const [loading, setLoading]             = useState(false)
  const [draggingTask, setDraggingTask]   = useState(null)
  const [tagModal, setTagModal]           = useState(null)
  const [editModal, setEditModal]         = useState(null)
  const [logModal, setLogModal]           = useState(null)
  const [collapsedTracks, setCollapsedTracks] = useState({})
  const [error, setError]                 = useState('')
  const [showAllocEditor, setShowAllocEditor] = useState(false)
  /** @type {null | { title: string, targetMins: number, items: object[] }} */
  const [healthDetail, setHealthDetail] = useState(null)

  // Allocation targets — stored as percentages per sub-track in localStorage.
  // Falls back to DEFAULT_ALLOCATIONS when not set or when structure is outdated.
  const [allocations, setAllocations] = useState(() => {
    try {
      const raw = localStorage.getItem('cosa.allocations')
      if (!raw) return DEFAULT_ALLOCATIONS
      const parsed = JSON.parse(raw)
      // If stored version doesn't have the new 'development' track, reset to defaults
      if (!parsed.development) return DEFAULT_ALLOCATIONS
      // Shared Networking no longer has its own allocation row — time splits to Advisors + Job Search
      if (parsed.networking) {
        delete parsed.networking
        try { localStorage.setItem('cosa.allocations', JSON.stringify(parsed)) } catch {}
      }
      return parsed
    } catch { return DEFAULT_ALLOCATIONS }
  })

  // Convert percentage-based allocations → absolute minute targets for HealthBars
  const trackTargets = useMemo(() => {
    const result = {}
    for (const [track, cfg] of Object.entries(allocations)) {
      const subTracks = {}
      for (const [st, pct] of Object.entries(cfg.subTracks)) {
        subTracks[st] = Math.round((pct / 100) * cfg.weekly)
      }
      result[track] = { weekly: cfg.weekly, subTracks }
    }
    return result
  }, [allocations])

  function saveAllocations(next) {
    setAllocations(next)
    try { localStorage.setItem('cosa.allocations', JSON.stringify(next)) } catch {}
    // Persist to Supabase so allocations survive cross-device sign-ins
    if (supabaseConfigured && session?.user?.id) {
      import('../lib/supabaseSync').then(({ upsertUserPreferences }) => {
        upsertUserPreferences({ allocations: next }, session.user.id)
      }).catch(() => {})
    }
  }

  const mondayStr  = getWeekMondayStr(weekOffset)
  const weekDates  = getWeekDates(mondayStr)
  const weekRangeStart = weekDates[0].date
  const weekRangeEnd = weekDates[weekDates.length - 1].date

  // healthModel = planning layer (ghost bar behind the solid logged bar).
  // Includes ALL calendar events with a track: CoSA events (task library + log behind)
  // AND tagged events (personal Google Calendar events the user assigned a track).
  // The numbers shown to the user are always loggedTotals (the solid bar).
  // The ghost bar only renders when planned > logged, so there is no visible double-count
  // when a tagged event appears in both layers.
  const healthModel = useMemo(
    () => buildCalendarHealthModel(weekEvents, calendarTags, trackTargets, weekRangeStart, weekRangeEnd),
    [weekEvents, calendarTags, trackTargets, weekRangeStart, weekRangeEnd],
  )

  // Actual logged time from the completion log — drives the HealthBars primary bars.
  // Mirrors healthModel.totals shape: { [track]: { total: number, sub: { [st]: number } } }
  const loggedTotals = useMemo(() => {
    // Use proper local-time Date objects spanning Mon 00:00:00 → Sun 23:59:59 so that
    // entries logged on Saturday/Sunday and after UTC-midnight on Friday are included.
    const weekStart = new Date(`${weekRangeStart}T00:00:00`)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 6)
    weekEnd.setHours(23, 59, 59, 999)

    const bucketKeys = (track) => Object.keys(trackTargets[track]?.subTracks ?? {})
    const totals = {}

    // Timer sessions and Quick Logs
    for (const e of completionLog) {
      if (!e?.completedAt || !e.track) continue
      const d = new Date(e.completedAt)
      if (d < weekStart || d > weekEnd) continue
      if (e.completionType === 'Cancelled') continue
      const mins = Math.round((e.elapsedSeconds ?? 0) / 60)
      if (!totals[e.track]) totals[e.track] = { total: 0, sub: {} }
      totals[e.track].total += mins
      const bucket = e.subTrack
        ? allocationSubTrackKey(e.track, e.subTrack, bucketKeys(e.track)) ?? e.subTrack
        : null
      if (bucket) {
        totals[e.track].sub[bucket] = (totals[e.track].sub[bucket] ?? 0) + mins
      }
    }

    // Calendar events (CoSA blocks, tagged events, log behind) are the PLAN layer only.
    // loggedTotals = timer sessions + quick logs from completionLog exclusively.

    return totals
  }, [completionLog, weekRangeStart, trackTargets])

  const providerToken = session?.provider_token ?? null

  // ── Fetch GCal events for the displayed week ──────────────────────────────
  const fetchWeek = useCallback(async () => {
    if (!providerToken) return
    setLoading(true)
    setError('')
    try {
      const wd = getWeekDates(mondayStr)
      const sunday = wd[wd.length - 1].date
      // Local Monday 00:00 → Sunday 23:59:59.999 as ISO for Google Calendar API
      const timeMin = new Date(`${mondayStr}T00:00:00`).toISOString()
      const timeMax = new Date(`${sunday}T23:59:59.999`).toISOString()

      const [allCosa, personal] = await Promise.all([
        fetchAllCalendarEvents(providerToken, timeMin, timeMax),
        fetchPersonalCalendarEvents(providerToken, timeMin, timeMax),
      ])
      // Split CoSA Calendar events: CoSA-created (have cosaTag) vs user-created (no tag)
      const cosaTagged   = allCosa.filter((ev) => ev.extendedProperties?.private?.cosaTag === 'cosa-event')
      const cosaUntagged = allCosa.filter((ev) => ev.extendedProperties?.private?.cosaTag !== 'cosa-event')
      setWeekEvents(cosaTagged)
      setUntaggedCosaEvents(cosaUntagged)
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
      // Immediately surface the new event in Today queue if it was dropped on today
      const todayStr = new Date().toLocaleDateString('en-CA') // YYYY-MM-DD in local TZ
      if (dateStr === todayStr && typeof onTodayEventCreated === 'function') {
        onTodayEventCreated(newEv)
      }
    } else {
      setError('Failed to create calendar event.')
    }
  }

  // ── Delete a CoSA event ───────────────────────────────────────────────────
  async function handleDeleteEvent(eventId) {
    if (!providerToken) return
    await deleteCalendarEvent(eventId, providerToken)
    setWeekEvents((prev) => prev.filter((e) => e.id !== eventId))
    setEditModal(null)
  }

  // ── Edit a CoSA event ─────────────────────────────────────────────────────
  async function handleSaveEdit(eventId, { name, track, subTrack, startISO, endISO }) {
    if (!providerToken) return
    const updated = await updateCalendarEventAtTime(
      eventId, name, track, startISO, endISO, providerToken,
      { subTrack: subTrack ?? '' },
    )
    if (updated) {
      setWeekEvents((prev) => prev.map((e) => e.id === eventId ? updated : e))
    }
    setEditModal(null)
  }

  // ── Tag a personal event ──────────────────────────────────────────────────
  function handleOpenTag(ev) { setTagModal(ev) }

  async function handleSaveTag(track, subTrack, kpiPayload = {}) {
    if (!tagModal || !session?.user?.id) return
    const ev = tagModal
    const { kpiCredits = [], kpiQuantities = {} } = kpiPayload
    const dur = eventDurationMins(ev)
    const date = dateTimeToLocalYmd(ev.start?.dateTime)
    const tag = {
      track,
      subTrack,
      title: ev.summary,
      durationMin: dur,
      date,
      kpiCredits,
      kpiQuantities,
    }
    const isCosaCalendarEvent = untaggedCosaEvents.some((e) => e.id === ev.id)

    if (isCosaCalendarEvent && providerToken) {
      // Patch the GCal event to add cosaTag + track metadata, converting it into
      // a proper CoSA event that the app can find on future fetches.
      const updated = await updateCalendarEventAtTime(
        ev.id,
        ev.summary ?? '(untitled)',
        track,
        ev.start?.dateTime,
        ev.end?.dateTime,
        providerToken,
        { subTrack: subTrack ?? '' },
      )
      if (updated) {
        setWeekEvents((prev) => [...prev, updated])
        setUntaggedCosaEvents((prev) => prev.filter((e) => e.id !== ev.id))
      }
      if (supabaseConfigured) {
        await upsertCalendarEventTag(session.user.id, ev.id, tag)
      }
    } else if (supabaseConfigured) {
      await upsertCalendarEventTag(session.user.id, ev.id, tag)
    }
    setCalendarTags((prev) => ({ ...prev, [ev.id]: tag }))
    onCalendarTagsUpdated?.()
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
    // Log Behind puts an event on the calendar plan only.
    // To count as logged it must go through the Today Queue timer or Quick Log.
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
              untaggedCosaEvents={untaggedCosaEvents}
              personalEvents={personalEvents}
              calendarTags={calendarTags}
              draggingTask={draggingTask}
              onDropLibraryTask={handleDropLibraryTask}
              onDeleteEvent={handleDeleteEvent}
              onEditEvent={setEditModal}
              onTagEvent={handleOpenTag}
              onLogBehind={handleLogBehind}
            />
          </div>
        </div>

        <HealthBars
          healthModel={healthModel}
          loggedTotals={loggedTotals}
          trackTargets={trackTargets}
          onEditAllocations={() => setShowAllocEditor(true)}
          onOpenHealthDetail={setHealthDetail}
        />
      </div>

      {/* ── Modals ──────────────────────────────────────────────────────── */}
      <CalendarHealthDetailModal detail={healthDetail} onClose={() => setHealthDetail(null)} />
      {showAllocEditor && (
        <AllocationEditor
          allocations={allocations}
          onSave={(next) => { saveAllocations(next); setShowAllocEditor(false) }}
          onClose={() => setShowAllocEditor(false)}
        />
      )}
      {tagModal && (
        <TagModal
          key={tagModal.id}
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
      {editModal && (
        <EditEventModal
          ev={editModal}
          onSave={handleSaveEdit}
          onDelete={handleDeleteEvent}
          onClose={() => setEditModal(null)}
        />
      )}
    </div>
  )
}
