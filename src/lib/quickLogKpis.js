/**
 * Quick Log + calendar tag KPI options. `mapping` must match KPI_DEFINITIONS[].kpiMapping
 * for weekly review counting; `label` is UI copy.
 */
const RAW_QUICK_LOG_KPI_GROUPS = [
  {
    group: 'Kuperman Advisors',
    track: 'advisors',
    color: '#1E6B3C',
    dot: 'bg-emerald-700',
    kpis: [
      { mapping: 'Outreach messages sent', label: 'Outreach messages sent' },
      { mapping: 'Discovery calls booked', label: 'Discovery calls booked' },
      { mapping: 'Discovery calls held', label: 'Discovery calls held' },
      { mapping: 'Connective attendance', label: 'Networking meetings attended' },
    ],
  },
  {
    group: 'Shared Networking',
    track: 'networking',
    color: '#C2762A',
    dot: 'bg-orange-500',
    kpis: [
      { mapping: 'Warm reconnects sent', label: 'Warm reconnect communications' },
      { mapping: 'LinkedIn comments posted', label: 'LinkedIn comments posted' },
      { mapping: 'Content posts', label: 'Content posts' },
    ],
  },
  {
    group: 'Job Search',
    track: 'jobSearch',
    color: '#2E75B6',
    dot: 'bg-blue-600',
    kpis: [
      { mapping: 'Companies researched', label: 'Companies researched' },
      { mapping: 'Company outreaches', label: 'Company outreaches' },
      { mapping: 'Roles identified', label: 'Roles identified' },
      { mapping: 'Applications submitted', label: 'Applications submitted' },
      { mapping: 'Recruiter touchpoints', label: 'Recruiter touchpoints' },
    ],
  },
  {
    group: 'Kuperman Ventures',
    track: 'ventures',
    color: '#9B6BAE',
    dot: 'bg-purple-500',
    kpis: [
      { mapping: 'Tester touchpoints', label: 'Alpha tester touchpoints' },
    ],
  },
]

function normalizeGroup(g) {
  return {
    ...g,
    kpis: g.kpis.map((k) => (typeof k === 'string' ? { mapping: k, label: k } : k)),
  }
}

export const QUICK_LOG_KPI_GROUPS = RAW_QUICK_LOG_KPI_GROUPS.map(normalizeGroup)

/** KPI kpiMapping string → CoSA track key (for timer_sessions / quick log). */
export const KPI_LABEL_TO_TRACK = {}
for (const g of QUICK_LOG_KPI_GROUPS) {
  for (const k of g.kpis) {
    KPI_LABEL_TO_TRACK[k.mapping] = g.track
  }
}

/** Quick Log groups that apply when tagging / logging with this track key. */
export function quickLogGroupsForTrack(trackKey) {
  return QUICK_LOG_KPI_GROUPS.filter((g) => g.track === trackKey)
}
