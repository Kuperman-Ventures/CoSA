import { format, startOfWeek, endOfWeek } from 'date-fns'
import { createClient } from '@/lib/supabase/server'
import { WorkSearchProgress } from '@/components/dashboard/work-search-progress'
import { BusinessHoursLedger } from '@/components/dashboard/business-hours-ledger'
import { ExportDialog } from '@/components/dashboard/export-dialog'
import type { WorkSearch, BusinessHours } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const now = new Date()
  const weekStart = startOfWeek(now, { weekStartsOn: 0 })
  const weekEnd = endOfWeek(now, { weekStartsOn: 0 })
  const startStr = format(weekStart, 'yyyy-MM-dd')
  const endStr = format(weekEnd, 'yyyy-MM-dd')

  const supabase = createClient()

  const [wsResult, bhResult] = await Promise.all([
    supabase
      .from('work_searches')
      .select('*')
      .gte('date', startStr)
      .lte('date', endStr)
      .order('date', { ascending: true }),
    supabase
      .from('business_hours')
      .select('*')
      .gte('date', startStr)
      .lte('date', endStr)
      .order('date', { ascending: true }),
  ])

  const workSearches: WorkSearch[] = wsResult.data ?? []
  const businessHours: BusinessHours[] = bhResult.data ?? []

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Weekly Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {format(weekStart, 'MMMM d')} – {format(weekEnd, 'MMMM d, yyyy')} &nbsp;·&nbsp; Current Week
          </p>
        </div>
        <ExportDialog />
      </div>

      {/* Error states */}
      {wsResult.error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          Could not load work search data: {wsResult.error.message}
        </div>
      )}
      {bhResult.error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          Could not load business hours data: {bhResult.error.message}
        </div>
      )}

      {/* Dashboard cards */}
      <WorkSearchProgress workSearches={workSearches} />
      <BusinessHoursLedger businessHours={businessHours} />
    </div>
  )
}
