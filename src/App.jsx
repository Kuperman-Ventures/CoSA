import { useEffect, useMemo, useState } from 'react'
import { CircleCheck, Pause, Play, SquareCheck, StopCircle } from 'lucide-react'

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

const TIME_BLOCK_ORDER = ['BD', 'Networking', 'Job Search', 'Encore OS']

const TODAY_TASKS = [
  {
    id: 'task-1',
    name: 'Pipeline Review',
    track: TRACKS.advisors.key,
    timeBlock: 'BD',
    estimateMinutes: 15,
    completionType: 'Done',
  },
  {
    id: 'task-2',
    name: 'Warm Reconnect Outreach',
    track: TRACKS.jobSearch.key,
    timeBlock: 'Networking',
    estimateMinutes: 10,
    completionType: 'Done + Outcome',
    outcomePrompt: 'Did this outreach generate a booked follow-up?',
  },
  {
    id: 'task-3',
    name: 'Target Company Deep Research',
    track: TRACKS.jobSearch.key,
    timeBlock: 'Job Search',
    estimateMinutes: 25,
    completionType: 'Done',
  },
  {
    id: 'task-4',
    name: 'Cursor Build Session',
    track: TRACKS.ventures.key,
    timeBlock: 'Encore OS',
    estimateMinutes: 45,
    completionType: 'Done + Outcome',
    outcomePrompt: 'Did this session ship a meaningful improvement?',
    requiresDefinitionOfDone: true,
  },
]

const NAV_ITEMS = ['Today', 'Task Library', 'Reschedule', 'KPI Dashboard', 'Analytics']

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
  const [tasks] = useState(TODAY_TASKS)
  const [activeTaskId, setActiveTaskId] = useState(tasks[0]?.id ?? null)
  const [sessions, setSessions] = useState(
    tasks.reduce((acc, task) => {
      acc[task.id] = getInitialSession(task)
      return acc
    }, {}),
  )
  const [definitionInput, setDefinitionInput] = useState('')
  const [completionInput, setCompletionInput] = useState('')
  const [outcomeSelection, setOutcomeSelection] = useState(null)
  const [statusMessage, setStatusMessage] = useState('')
  const [nowMs, setNowMs] = useState(() => Date.now())

  const activeTask = useMemo(
    () => tasks.find((task) => task.id === activeTaskId) ?? null,
    [activeTaskId, tasks],
  )
  const activeSession = activeTask ? sessions[activeTask.id] : null

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

  const tasksByBlock = useMemo(
    () =>
      TIME_BLOCK_ORDER.map((timeBlock) => ({
        timeBlock,
        tasks: tasks.filter((task) => task.timeBlock === timeBlock),
      })),
    [tasks],
  )

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

  if (!activeTask || !activeSession) {
    return <main className="p-6">No tasks available for today.</main>
  }

  const trackMeta = getTrackMeta(activeTask.track)
  const isCompleted = activeSession.timerState === TIMER_STATES.completed
  const isCancelled = activeSession.timerState === TIMER_STATES.cancelled
  const isOverrun = activeSession.timerState === TIMER_STATES.overrun
  const remainingOrOverrun = isOverrun
    ? formatDuration(activeSession.elapsedSeconds - activeSession.estimateSeconds)
    : formatDuration(activeSession.remainingSeconds)
  const timerLabel = isOverrun ? 'Overrun' : 'Remaining'

  const runningTimeSeconds = activeSession.elapsedSeconds
  const timeSavedSeconds = Math.max(0, activeSession.estimateSeconds - runningTimeSeconds)
  const overrunSeconds = Math.max(0, runningTimeSeconds - activeSession.estimateSeconds)
  const livePauseSeconds = activeSession.currentPauseStartedAtMs
    ? Math.floor((nowMs - activeSession.currentPauseStartedAtMs) / 1000)
    : 0
  const pauseDurationSeconds = activeSession.pauseDurationSeconds + Math.max(0, livePauseSeconds)
  const definitionWords = wordsCount(definitionInput)

  return (
    <main className="mx-auto min-h-screen max-w-5xl bg-slate-50 pb-24 text-slate-900">
      <section className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
        <h1 className="text-xl font-semibold">Chief of Staff</h1>
        <p className="text-sm text-slate-600">Phase 1 - Today Screen + Timer Logic</p>
      </section>

      <section className="grid gap-4 p-4 lg:grid-cols-[1fr_320px]">
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

        <aside className="space-y-4">
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold uppercase text-slate-500">Today Queue</h3>
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

          <section className="rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
            <div className="mb-1 flex items-center gap-2 font-semibold">
              <CircleCheck size={16} />
              Phase 1 Done Criteria
            </div>
            <ul className="space-y-1 text-slate-700">
              <li>- All six timer states are reachable.</li>
              <li>- Overrun alert appears and tracks extra time.</li>
              <li>- Done + Outcome requires a one-tap result.</li>
              <li>- Ventures build session requires 10-word definition.</li>
            </ul>
          </section>
        </aside>
      </section>

      <nav className="fixed bottom-0 left-0 right-0 border-t border-slate-200 bg-white">
        <ul className="mx-auto grid max-w-5xl grid-cols-5 gap-1 p-2 text-center text-xs sm:text-sm">
          {NAV_ITEMS.map((item) => (
            <li key={item}>
              <span
                className={`block rounded-md px-1 py-2 ${
                  item === 'Today' ? 'bg-slate-900 font-semibold text-white' : 'text-slate-500'
                }`}
              >
                {item}
              </span>
            </li>
          ))}
        </ul>
      </nav>
    </main>
  )
}

export default App
