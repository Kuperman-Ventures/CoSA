'use client'

import { useState, useTransition } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format } from 'date-fns'
import { useRouter } from 'next/navigation'
import { submitWorkSearch } from '@/lib/actions'
import { CONTACT_METHODS, RESULT_OPTIONS } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DatePicker } from '@/components/date-picker'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'

const schema = z.object({
  date: z.date({ required_error: 'Date is required' }),
  company_name: z.string().min(1, 'Company / organization name is required'),
  company_location: z.string().min(1, 'Location or URL is required'),
  contact_method: z.string().min(1, 'Contact method is required'),
  contact_person: z.string().optional().default(''),
  position_applied: z.string().min(1, 'Position applied for is required'),
  result: z.string().min(1, 'Result is required'),
})

type FormValues = z.infer<typeof schema>

export function WorkSearchForm() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { contact_person: '' },
  })

  function onSubmit(data: FormValues) {
    setServerError(null)
    startTransition(async () => {
      const result = await submitWorkSearch({
        date: format(data.date, 'yyyy-MM-dd'),
        company_name: data.company_name,
        company_location: data.company_location,
        contact_method: data.contact_method,
        contact_person: data.contact_person ?? '',
        position_applied: data.position_applied,
        result: data.result,
      })
      if ('error' in result) {
        setServerError(result.error)
      } else {
        setSuccess(true)
        reset()
        setTimeout(() => {
          setSuccess(false)
          router.push('/')
          router.refresh()
        }, 1500)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {serverError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert className="border-green-300 bg-green-50 text-green-900">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription>Work search activity logged. Redirecting…</AlertDescription>
        </Alert>
      )}

      {/* Date */}
      <div className="space-y-1.5">
        <Label>Date</Label>
        <Controller
          control={control}
          name="date"
          render={({ field }) => (
            <DatePicker value={field.value} onChange={field.onChange} />
          )}
        />
        {errors.date && <p className="text-xs text-red-600">{errors.date.message}</p>}
      </div>

      {/* Company Name */}
      <div className="space-y-1.5">
        <Label htmlFor="company_name">Company / Organization Name</Label>
        <Input id="company_name" placeholder="e.g., Acme Corporation" {...register('company_name')} />
        {errors.company_name && <p className="text-xs text-red-600">{errors.company_name.message}</p>}
      </div>

      {/* Location */}
      <div className="space-y-1.5">
        <Label htmlFor="company_location">Physical Address, Email, or Web URL</Label>
        <Input id="company_location" placeholder="e.g., https://careers.acme.com or 123 Main St, NY" {...register('company_location')} />
        {errors.company_location && <p className="text-xs text-red-600">{errors.company_location.message}</p>}
      </div>

      {/* Contact Method */}
      <div className="space-y-1.5">
        <Label>Contact Method</Label>
        <Controller
          control={control}
          name="contact_method"
          render={({ field }) => (
            <Select onValueChange={field.onChange} value={field.value}>
              <SelectTrigger>
                <SelectValue placeholder="Select contact method…" />
              </SelectTrigger>
              <SelectContent>
                {CONTACT_METHODS.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.contact_method && <p className="text-xs text-red-600">{errors.contact_method.message}</p>}
      </div>

      {/* Contact Person */}
      <div className="space-y-1.5">
        <Label htmlFor="contact_person">
          Name &amp; Title of Person Contacted <span className="text-gray-400 font-normal">(optional)</span>
        </Label>
        <Input id="contact_person" placeholder="e.g., Jane Smith, VP of Talent Acquisition" {...register('contact_person')} />
      </div>

      {/* Position Applied */}
      <div className="space-y-1.5">
        <Label htmlFor="position_applied">Position Applied For</Label>
        <Input
          id="position_applied"
          placeholder="e.g., Chief Marketing Officer, SVP Marketing, Board Member"
          {...register('position_applied')}
        />
        {errors.position_applied && <p className="text-xs text-red-600">{errors.position_applied.message}</p>}
      </div>

      {/* Result */}
      <div className="space-y-1.5">
        <Label>Result</Label>
        <Controller
          control={control}
          name="result"
          render={({ field }) => (
            <Select onValueChange={field.onChange} value={field.value}>
              <SelectTrigger>
                <SelectValue placeholder="Select result…" />
              </SelectTrigger>
              <SelectContent>
                {RESULT_OPTIONS.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.result && <p className="text-xs text-red-600">{errors.result.message}</p>}
      </div>

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? 'Submitting…' : 'Log Work Search Activity'}
      </Button>
    </form>
  )
}
