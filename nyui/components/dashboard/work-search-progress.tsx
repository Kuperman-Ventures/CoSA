import { format, parseISO } from 'date-fns'
import type { WorkSearch } from '@/lib/types'
import { countUniqueDays } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { CheckCircle2, Clock } from 'lucide-react'

const GOAL = 3

interface Props {
  workSearches: WorkSearch[]
}

export function WorkSearchProgress({ workSearches }: Props) {
  const uniqueDays = countUniqueDays(workSearches)
  const progress = Math.min(uniqueDays, GOAL)
  const progressPct = (progress / GOAL) * 100
  const goalMet = progress >= GOAL

  // Group entries by date for display
  const byDate = workSearches.reduce<Record<string, WorkSearch[]>>((acc, ws) => {
    acc[ws.date] = acc[ws.date] ? [...acc[ws.date], ws] : [ws]
    return acc
  }, {})

  const sortedDates = Object.keys(byDate).sort()

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle>Work Search Progress</CardTitle>
            <CardDescription className="mt-1">
              NYS DOL requires 3 activities on 3 separate calendar days per week
            </CardDescription>
          </div>
          <Badge
            variant={goalMet ? 'success' : progress >= 2 ? 'warning' : 'secondary'}
            className="shrink-0 mt-0.5"
          >
            {goalMet ? (
              <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Goal Met</span>
            ) : (
              `${progress} / ${GOAL} days`
            )}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Progress bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 tabular-nums font-medium">{progress} of {GOAL} qualifying days</span>
            <span className="text-gray-400 text-xs">{workSearches.length} total activit{workSearches.length === 1 ? 'y' : 'ies'} this week</span>
          </div>
          <Progress value={progressPct} className={goalMet ? '[&>div]:bg-green-600' : ''} />
          {workSearches.length > 0 && uniqueDays < workSearches.length && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
              Note: {workSearches.length - uniqueDays} activit{workSearches.length - uniqueDays === 1 ? 'y' : 'ies'} logged on a day already counted — only unique days count toward the 3-day goal.
            </p>
          )}
        </div>

        {/* Activity log */}
        {sortedDates.length > 0 ? (
          <div className="space-y-1">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">This Week&apos;s Activities</p>
            <div className="divide-y divide-gray-100 rounded-md border border-gray-100 overflow-hidden">
              {sortedDates.map((date) => (
                <div key={date}>
                  {byDate[date].map((ws, i) => (
                    <div key={ws.id} className="grid grid-cols-[90px_1fr_auto] gap-3 px-3 py-2.5 text-sm items-start">
                      <div className={`font-medium tabular-nums ${i > 0 ? 'text-gray-300' : 'text-gray-900'}`}>
                        {i === 0 ? format(parseISO(date), 'EEE, MMM d') : '↳'}
                      </div>
                      <div>
                        <p className="text-gray-900 font-medium leading-snug">{ws.company_name}</p>
                        <p className="text-gray-500 text-xs">{ws.position_applied} · {ws.contact_method}</p>
                      </div>
                      <Badge
                        variant={
                          ws.result === 'Offer Received' ? 'success'
                          : ws.result === 'Interview Scheduled' ? 'warning'
                          : ws.result === 'Rejected' ? 'destructive'
                          : 'secondary'
                        }
                        className="text-xs whitespace-nowrap"
                      >
                        {ws.result}
                      </Badge>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Clock className="h-8 w-8 text-gray-200 mb-2" />
            <p className="text-sm text-gray-400">No work search activities logged this week</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
