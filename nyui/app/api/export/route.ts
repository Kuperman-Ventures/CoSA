import { NextResponse } from 'next/server'
import Papa from 'papaparse'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const start = searchParams.get('start')
    const end = searchParams.get('end')

    if (!start || !end) {
      return NextResponse.json({ error: 'start and end date params are required' }, { status: 400 })
    }

    const supabase = createClient()

    const [wsResult, bhResult] = await Promise.all([
      supabase
        .from('work_searches')
        .select('id, date, company_name, company_location, contact_method, contact_person, position_applied, result, created_at')
        .gte('date', start)
        .lte('date', end)
        .order('date', { ascending: true }),
      supabase
        .from('business_hours')
        .select('id, date, entity, activity_description, hours, minutes, created_at')
        .gte('date', start)
        .lte('date', end)
        .order('date', { ascending: true }),
    ])

    if (wsResult.error) throw new Error(`Work searches: ${wsResult.error.message}`)
    if (bhResult.error) throw new Error(`Business hours: ${bhResult.error.message}`)

    const workSearches = wsResult.data ?? []
    const businessHoursData = bhResult.data ?? []

    // Map to clean display columns
    const workSearchRows = workSearches.map((r) => ({
      Date: r.date,
      'Company / Organization': r.company_name,
      'Location / URL': r.company_location,
      'Contact Method': r.contact_method,
      'Contact Person': r.contact_person ?? '',
      'Position Applied For': r.position_applied,
      Result: r.result,
      'Date Logged': r.created_at,
    }))

    const businessHoursRows = businessHoursData.map((r) => ({
      Date: r.date,
      Entity: r.entity,
      'Activity Description': r.activity_description,
      Hours: r.hours,
      Minutes: r.minutes,
      'Total Minutes': r.hours * 60 + r.minutes,
      'Date Logged': r.created_at,
    }))

    const workSearchCsv = Papa.unparse(workSearchRows)
    const businessHoursCsv = Papa.unparse(businessHoursRows)

    const report = [
      `NYS DOL COMPLIANCE AUDIT REPORT`,
      `Date Range: ${start} to ${end}`,
      `Generated: ${new Date().toISOString()}`,
      ``,
      ``,
      `=== SECTION 1: WORK SEARCH LOG (${workSearches.length} record${workSearches.length !== 1 ? 's' : ''}) ===`,
      workSearchCsv,
      ``,
      ``,
      `=== SECTION 2: BUSINESS HOURS LOG (${businessHoursData.length} record${businessHoursData.length !== 1 ? 's' : ''}) ===`,
      businessHoursCsv,
    ].join('\n')

    return new Response(report, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="nys-dol-audit-${start}-to-${end}.csv"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Export failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
