import { format, parseISO } from 'date-fns'
import type { BusinessHours } from '@/lib/types'
import { analyzeBusinessHours, formatHoursMinutes } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { AlertTriangle, Clock } from 'lucide-react'

const WEEKLY_LIMIT = 31
const WARN_THRESHOLD = 28
const DAILY_LIMIT = 10

interface Props {
  businessHours: BusinessHours[]
}

export function BusinessHoursLedger({ businessHours }: Props) {
  const analysis = analyzeBusinessHours(businessHours)
  const {
    venturesMinutes,
    advisorsMinutes,
    totalMinutes,
    totalHours,
    daysExceedingDailyLimit,
    approachingWeeklyLimit,
    exceedsWeeklyLimit,
  } = analysis

  const weeklyPct = Math.min((totalHours / WEEKLY_LIMIT) * 100, 100)

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle>Business Hours Ledger</CardTitle>
            <CardDescription className="mt-1">
              Combined hours across both entities — limit is {WEEKLY_LIMIT}h/week · {DAILY_LIMIT}h/day
            </CardDescription>
          </div>
          {exceedsWeeklyLimit ? (
            <Badge variant="destructive" className="shrink-0 mt-0.5">⚠ Limit Exceeded</Badge>
          ) : approachingWeeklyLimit ? (
            <Badge variant="warning" className="shrink-0 mt-0.5">Approaching Limit</Badge>
          ) : (
            <Badge variant="secondary" className="shrink-0 mt-0.5">{formatHoursMinutes(totalMinutes)} logged</Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Warning alerts */}
        {exceedsWeeklyLimit && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Weekly Limit Exceeded — UI Payout at Risk</AlertTitle>
            <AlertDescription>
              You have logged <strong>{formatHoursMinutes(totalMinutes)}</strong> this week. Exceeding {WEEKLY_LIMIT} combined hours triggers a <strong>0% UI payout</strong> for this week.
            </AlertDescription>
          </Alert>
        )}
        {approachingWeeklyLimit && !exceedsWeeklyLimit && (
          <Alert variant="warning">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Approaching Weekly Limit</AlertTitle>
            <AlertDescription>
              You have logged <strong>{formatHoursMinutes(totalMinutes)}</strong> this week. The {WEEKLY_LIMIT}-hour limit is {formatHoursMinutes(totalMinutes - WEEKLY_LIMIT * 60 * -1)} away. Exceeding it triggers a <strong>0% UI payout</strong>.
            </AlertDescription>
          </Alert>
        )}
        {daysExceedingDailyLimit.map((day) => (
          <Alert key={day.date} variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Daily Limit Exceeded — {format(parseISO(day.date), 'EEEE, MMMM d')}</AlertTitle>
            <AlertDescription>
              <strong>{day.hours.toFixed(1)} hours</strong> logged on this day, exceeding the {DAILY_LIMIT}-hour daily threshold.
            </AlertDescription>
          </Alert>
        ))}

        {/* Weekly progress bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 font-medium">{formatHoursMinutes(totalMinutes)}</span>
            <span className="text-gray-400 text-xs">of {WEEKLY_LIMIT}h weekly limit</span>
          </div>
          <Progress
            value={weeklyPct}
            className={
              exceedsWeeklyLimit ? '[&>div]:bg-red-600'
              : approachingWeeklyLimit ? '[&>div]:bg-amber-500'
              : ''
            }
          />
        </div>

        {/* Entity breakdown */}
        <div className="rounded-md border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-2.5 font-medium text-gray-500 text-xs uppercase tracking-wider">Entity</th>
                <th className="text-right px-4 py-2.5 font-medium text-gray-500 text-xs uppercase tracking-wider">This Week</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <tr>
                <td className="px-4 py-3 text-gray-900">Kuperman Ventures LLC</td>
                <td className="px-4 py-3 text-right tabular-nums font-medium text-gray-900">
                  {formatHoursMinutes(venturesMinutes)}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-gray-900">Kuperman Advisors LLC</td>
                <td className="px-4 py-3 text-right tabular-nums font-medium text-gray-900">
                  {formatHoursMinutes(advisorsMinutes)}
                </td>
              </tr>
              <tr className="bg-gray-50 font-semibold">
                <td className="px-4 py-3 text-gray-900">Combined Total</td>
                <td className={`px-4 py-3 text-right tabular-nums ${exceedsWeeklyLimit ? 'text-red-700' : approachingWeeklyLimit ? 'text-amber-700' : 'text-gray-900'}`}>
                  {formatHoursMinutes(totalMinutes)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Activity log */}
        {businessHours.length > 0 ? (
          <div className="space-y-1">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">This Week&apos;s Entries</p>
            <div className="divide-y divide-gray-100 rounded-md border border-gray-100 overflow-hidden">
              {businessHours.map((entry) => (
                <div key={entry.id} className="grid grid-cols-[90px_1fr_auto] gap-3 px-3 py-2.5 text-sm items-start">
                  <div className="font-medium text-gray-900 tabular-nums whitespace-nowrap">
                    {format(parseISO(entry.date), 'EEE, MMM d')}
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs font-medium mb-0.5">{entry.entity}</p>
                    <p className="text-gray-800 leading-snug">{entry.activity_description}</p>
                  </div>
                  <span className="text-xs font-semibold tabular-nums text-gray-700 whitespace-nowrap">
                    {formatHoursMinutes(entry.hours * 60 + entry.minutes)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Clock className="h-8 w-8 text-gray-200 mb-2" />
            <p className="text-sm text-gray-400">No business hours logged this week</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
