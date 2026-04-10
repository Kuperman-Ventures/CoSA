import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { startOfWeek, endOfWeek, format } from 'date-fns'
import type { BusinessHours } from './types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getWeekBounds(date = new Date()) {
  const start = startOfWeek(date, { weekStartsOn: 0 })
  const end = endOfWeek(date, { weekStartsOn: 0 })
  return {
    start: format(start, 'yyyy-MM-dd'),
    end: format(end, 'yyyy-MM-dd'),
    startDisplay: format(start, 'MMMM d'),
    endDisplay: format(end, 'MMMM d, yyyy'),
  }
}

export function formatHoursMinutes(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

export const CONTACT_METHODS = [
  'Online Portal',
  'Direct Email',
  'Phone Call',
  'LinkedIn',
  'Networking Event',
  'Interview',
] as const

export const RESULT_OPTIONS = [
  'Application Submitted',
  'Interview Scheduled',
  'Pending',
  'Rejected',
  'Offer Received',
] as const

export const ENTITIES = [
  'Kuperman Ventures LLC',
  'Kuperman Advisors LLC',
] as const

// ─── Business Hours Analysis ──────────────────────────────────────────────────

export type HoursAnalysis = {
  venturesMinutes: number
  advisorsMinutes: number
  totalMinutes: number
  totalHours: number
  maxDayHours: number
  daysExceedingDailyLimit: { date: string; hours: number }[]
  approachingWeeklyLimit: boolean
  exceedsWeeklyLimit: boolean
}

export function analyzeBusinessHours(entries: BusinessHours[]): HoursAnalysis {
  const dayTotals = new Map<string, number>()
  let venturesMinutes = 0
  let advisorsMinutes = 0

  for (const entry of entries) {
    const mins = entry.hours * 60 + entry.minutes
    if (entry.entity === 'Kuperman Ventures LLC') venturesMinutes += mins
    else advisorsMinutes += mins
    dayTotals.set(entry.date, (dayTotals.get(entry.date) ?? 0) + mins)
  }

  const totalMinutes = venturesMinutes + advisorsMinutes
  const totalHours = totalMinutes / 60

  const dayEntries = Array.from(dayTotals.entries())

  const daysExceedingDailyLimit = dayEntries
    .filter(([, mins]) => mins > 600)
    .map(([date, mins]) => ({ date, hours: parseFloat((mins / 60).toFixed(2)) }))

  const dayValues = Array.from(dayTotals.values())
  const maxDayMins = Math.max(...(dayValues.length ? dayValues : [0]))

  return {
    venturesMinutes,
    advisorsMinutes,
    totalMinutes,
    totalHours,
    maxDayHours: maxDayMins / 60,
    daysExceedingDailyLimit,
    approachingWeeklyLimit: totalHours >= 28 && totalHours < 31,
    exceedsWeeklyLimit: totalHours >= 31,
  }
}

// ─── Work Search Analysis ─────────────────────────────────────────────────────

export function countUniqueDays(workSearches: { date: string }[]): number {
  return new Set(workSearches.map((ws) => ws.date)).size
}
