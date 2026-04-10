'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { Download, FileDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { DatePicker } from '@/components/date-picker'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

export function ExportDialog() {
  const [open, setOpen] = useState(false)
  const [startDate, setStartDate] = useState<Date | undefined>()
  const [endDate, setEndDate] = useState<Date | undefined>()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleExport() {
    if (!startDate || !endDate) {
      setError('Please select both a start date and an end date.')
      return
    }
    if (endDate < startDate) {
      setError('End date must be on or after the start date.')
      return
    }
    setError(null)
    setLoading(true)
    try {
      const start = format(startDate, 'yyyy-MM-dd')
      const end = format(endDate, 'yyyy-MM-dd')
      const response = await fetch(`/api/export?start=${start}&end=${end}`)
      if (!response.ok) throw new Error(await response.text())
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `nys-dol-audit-report-${start}-to-${end}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setOpen(false)
      setStartDate(undefined)
      setEndDate(undefined)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <FileDown className="h-4 w-4 mr-2" />
        Generate Audit Report
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Generate NYS DOL Audit Report</DialogTitle>
            <DialogDescription>
              Exports all Work Search and Business Hours records for the selected date range as a CSV file.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Start Date</Label>
              <DatePicker value={startDate} onChange={setStartDate} placeholder="Select start date" />
            </div>
            <div className="space-y-1.5">
              <Label>End Date</Label>
              <DatePicker value={endDate} onChange={setEndDate} placeholder="Select end date" />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>
            )}

            <div className="flex gap-3 pt-1">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setOpen(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleExport}
                disabled={loading || !startDate || !endDate}
              >
                <Download className="h-4 w-4 mr-2" />
                {loading ? 'Generating…' : 'Download CSV'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
