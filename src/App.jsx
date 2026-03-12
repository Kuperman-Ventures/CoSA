import { useEffect, useMemo, useState } from 'react'
import { Pause, Play, SquareCheck, StopCircle } from 'lucide-react'
import { isSupabaseConfigured, supabase } from './lib/supabaseClient'

const TRACKS = {
  advisors: {
    key: 'advisors',
    label: 'Kuperman Advisors',
    color: '#1E6B3C',
    priority: 1,
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
const COMPLETION_TYPES = ['Done', 'Done + Outcome']
const LIBRARY_STATUSES = ['Active', 'Paused', 'Archived']
const TIME_BLOCK_ORDER = ['BD', 'Networking', 'Job Search', 'Encore OS']

const INITIAL_TASK_LIBRARY = [
  {
    id: 'lib-1',
    name: 'Pipeline Review',
    track: TRACKS.advisors.key,
    timeBlock: 'BD',
    defaultTimeEstimate: 15,
    frequency: 'Weekly',
    completionType: 'Done',
    kpiMapping: 'Outreach pipeline maintenance',
    subtasks: 'Review open opportunities\nFlag stale leads\nSet follow-up priorities',
    status: 'Active',
  },
  {
    id: 'lib-2',
    name: 'Warm Reconnect Outreach',
    track: TRACKS.jobSearch.key,
    timeBlock: 'Networking',
    defaultTimeEstimate: 10,
    frequency: 'Daily',
    completionType: 'Done + Outcome',
    kpiMapping: 'Warm reconnects sent',
    subtasks: 'Pick one warm contact\nSend reconnect note\nLog outreach in tracker',
    status: 'Active',
    outcomePrompt: 'Did this outreach generate a booked follow-up?',
  },
  {
    id: 'lib-3',
    name: 'Target Company Deep Research',
    track: TRACKS.jobSearch.key,
    timeBlock: 'Job Search',
    defaultTimeEstimate: 25,
    frequency: 'Weekly',
    completionType: 'Done',
    kpiMapping: 'Companies researched',
    subtasks: 'Research one target company\nIdentify key contact\nLog notes in tracker',
    status: 'Active',
  },
  {
    id: 'lib-4',
    name: 'Cursor Build Session',
    track: TRACKS.ventures.key,
    timeBlock: 'Encore OS',
    defaultTimeEstimate: 45,
    frequency: 'Daily',
    completionType: 'Done + Outcome',
    kpiMapping: 'Things shipped',
    subtasks: 'Write definition of done\nShip one scoped improvement\nRecord completion notes',
    status: 'Active',
    outcomePrompt: 'Did this session ship a meaningful improvement?',
    requiresDefinitionOfDone: true,
  },
]

const NAV_ITEMS = [
  { id: 'today', label: 'Today' },
  { id: 'taskLibrary', label: 'Task Library' },
  { id: 'reschedule', label: 'Reschedule' },
  { id: 'kpi', label: 'KPI Dashboard' },
  { id: 'analytics', label: 'Analytics' },
]
const STORAGE_KEY = 'cosa.phase1_phase2.local_state.v1'

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

function getDefaultTodaySnapshot(libraryTasks) {
  const deploymentId = Date.now()
  return libraryTasks
    .filter((task) => task.status === 'Active')
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
    taskId: task.id,
    timerState: TIMER_STATES.notStarted,
    estimateSeconds,
    remainingSeconds: estimateSeconds,
    elapsedSeconds: 0,
    pauseCount: 0,
    pauseDurationSeconds: 0,
    currentPauseStartedAtMs: null,
    cancelledSeconds: 0,
    definitionOfDone: '',
    actualCompleted: '',
    outcomeAchieved: null,
    completionLoggedAtISO: null,
  }
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
    })
  }, [activeTaskId, lastDeploymentAt, sessions, taskLibrary, todayTasks])

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

  function deployLibraryToToday() {
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

    if (deployableCandidates.length === 0) {
      setLibraryMessage('No Active library tasks are available to deploy.')
      return
    }

    const deploymentId = Date.now()
    const snapshot = deployableCandidates.map((task, index) =>
      mapLibraryTaskToTodayTask(task, deploymentId, index),
    )

    setTodayTasks(snapshot)
    setSessions(buildSessionsFromTodayTasks(snapshot))
    setActiveTaskId(snapshot[0]?.id ?? null)
    setDefinitionInput('')
    setCompletionInput('')
    setOutcomeSelection(null)
    setStatusMessage('')
    setLastDeploymentAt(new Date().toISOString())
    setLibraryMessage(
      `Deployed ${snapshot.length} Active task template(s) to Today. Paused (${pausedCount}) and Archived (${archivedCount}) tasks were excluded.`,
    )
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
    setSessions((prev) => {
      const current = prev[activeTask.id]
      if (!current) return prev

      const pauseDelta = current.currentPauseStartedAtMs
        ? Math.floor((Date.now() - current.currentPauseStartedAtMs) / 1000)
        : 0

      return {
        ...prev,
        [activeTask.id]: {
          ...current,
          timerState:
            current.remainingSeconds === 0 || current.timerState === TIMER_STATES.overrun
              ? TIMER_STATES.overrun
              : TIMER_STATES.running,
          pauseDurationSeconds: current.pauseDurationSeconds + Math.max(0, pauseDelta),
          currentPauseStartedAtMs: null,
          definitionOfDone: isVenturesEncore ? definitionInput.trim() : current.definitionOfDone,
        },
      }
    })
  }

  function handlePause() {
    if (!activeTask || !activeSession) return
    if (
      activeSession.timerState !== TIMER_STATES.running &&
      activeSession.timerState !== TIMER_STATES.overrun
    ) {
      return
    }

    setSessions((prev) => {
      const current = prev[activeTask.id]
      if (!current) return prev
      return {
        ...prev,
        [activeTask.id]: {
          ...current,
          timerState: TIMER_STATES.paused,
          pauseCount: current.pauseCount + 1,
          currentPauseStartedAtMs: Date.now(),
        },
      }
    })
  }

  function handleCancel() {
    if (!activeTask || !activeSession) return
    const pauseDelta =
      activeSession.timerState === TIMER_STATES.paused && activeSession.currentPauseStartedAtMs
        ? Math.floor((Date.now() - activeSession.currentPauseStartedAtMs) / 1000)
        : 0

    setSessions((prev) => {
      const current = prev[activeTask.id]
      if (!current) return prev
      return {
        ...prev,
        [activeTask.id]: {
          ...current,
          timerState: TIMER_STATES.cancelled,
          cancelledSeconds: current.remainingSeconds,
          pauseDurationSeconds: current.pauseDurationSeconds + Math.max(0, pauseDelta),
          currentPauseStartedAtMs: null,
          completionLoggedAtISO: new Date().toISOString(),
        },
      }
    })
    setStatusMessage('Task cancelled. Remaining time has been logged for rescheduling.')
  }

  function handleComplete() {
    if (!activeTask || !activeSession) return

    if (activeTask.completionType === 'Done + Outcome' && outcomeSelection === null) {
      setStatusMessage('Select an outcome result before completing this task.')
      return
    }

    if (!completionInput.trim()) {
      setStatusMessage('Add a quick note for what was actually completed.')
      return
    }

    const pauseDelta =
      activeSession.timerState === TIMER_STATES.paused && activeSession.currentPauseStartedAtMs
        ? Math.floor((Date.now() - activeSession.currentPauseStartedAtMs) / 1000)
        : 0

    setSessions((prev) => {
      const current = prev[activeTask.id]
      if (!current) return prev
      return {
        ...prev,
        [activeTask.id]: {
          ...current,
          timerState: TIMER_STATES.completed,
          actualCompleted: completionInput.trim(),
          outcomeAchieved: outcomeSelection,
          pauseDurationSeconds: current.pauseDurationSeconds + Math.max(0, pauseDelta),
          currentPauseStartedAtMs: null,
          completionLoggedAtISO: new Date().toISOString(),
        },
      }
    })

    setStatusMessage('Task completed and KPI data captured.')
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
            <p className="text-[11px] font-semibold uppercase text-slate-500">Next Deploy Snapshot</p>
            <ul className="mt-1 space-y-1 text-xs text-slate-700">
              {activeDeployCandidates.map((task) => (
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
              {activeDeployCandidates.length === 0 ? (
                <li className="text-slate-500">No Active tasks selected for deployment.</li>
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
      <section className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-semibold">Chief of Staff</h1>
            <p className="text-sm text-slate-600">{activeScreenLabel}</p>
          </div>
          <div className="flex items-center gap-2 text-xs sm:text-sm">
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
              onClick={handleComplete}
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

          {isCompleted && activeTask.requiresDefinitionOfDone ? (
            <div className="mt-4 rounded-lg border border-purple-300 bg-purple-50 p-3 text-sm">
              <p className="font-semibold text-purple-900">Encore OS session recap</p>
              <p className="mt-1 text-purple-800">
                <span className="font-medium">Definition of done:</span>{' '}
                {activeSession.definitionOfDone || 'N/A'}
              </p>
              <p className="mt-1 text-purple-800">
                <span className="font-medium">Actually completed:</span>{' '}
                {activeSession.actualCompleted || 'N/A'}
              </p>
            </div>
          ) : null}
        </article>
        ) : (
        <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">No Today tasks deployed yet</h2>
          <p className="mt-2 text-sm text-slate-600">
            Go to Task Library and click "Deploy Active Tasks to Today" to create today's task instances.
          </p>
        </article>
        )}

        <aside className="space-y-4">
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold uppercase text-slate-500">Today Queue</h3>
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
      {activeScreen === 'reschedule'
        ? renderPlaceholderScreen(
            'Reschedule',
            'Phase 3 will add drag-and-drop rescheduling suggestions with explicit confirmation.',
          )
        : null}
      {activeScreen === 'kpi'
        ? renderPlaceholderScreen(
            'KPI Dashboard',
            'Phase 4 will auto-calculate weekly KPIs from task completion and outcome events.',
          )
        : null}
      {activeScreen === 'analytics'
        ? renderPlaceholderScreen(
            'Analytics',
            'Phase 5 will display weekly metrics by track (time saved, overrun, pauses, cancellations, completion rate).',
          )
        : null}

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
