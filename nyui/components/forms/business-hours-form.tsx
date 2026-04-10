'use client'

import { useState, useTransition } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format } from 'date-fns'
import { useRouter } from 'next/navigation'
import { submitBusinessHours } from '@/lib/actions'
import { ENTITIES } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DatePicker } from '@/components/date-picker'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'

const schema = z.object({
  date: z.date({ required_error: 'Date is required' }),
  entity: z.string().min(1, 'Entity is required'),
  activity_description: z.string().min(1, 'Activity description is required'),
  hours: z.coerce.number().min(0, 'Hours must be 0 or more').max(24, 'Hours cannot exceed 24'),
  minutes: z.coerce.number().min(0, 'Minutes must be 0 or more').max(59, 'Minutes must be 0–59'),
})

type FormValues = z.infer<typeof schema>

export function BusinessHoursForm() {
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
    defaultValues: { hours: 0, minutes: 0 },
  })

  function onSubmit(data: FormValues) {
    setServerError(null)
    startTransition(async () => {
      const result = await submitBusinessHours({
        date: format(data.date, 'yyyy-MM-dd'),
        entity: data.entity,
        activity_description: data.activity_description,
        hours: data.hours,
        minutes: data.minutes,
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
          <AlertDescription>Business hours logged. Redirecting…</AlertDescription>
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

      {/* Entity */}
      <div className="space-y-1.5">
        <Label>Entity</Label>
        <Controller
          control={control}
          name="entity"
          render={({ field }) => (
            <Select onValueChange={field.onChange} value={field.value}>
              <SelectTrigger>
                <SelectValue placeholder="Select entity…" />
              </SelectTrigger>
              <SelectContent>
                {ENTITIES.map((e) => (
                  <SelectItem key={e} value={e}>{e}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.entity && <p className="text-xs text-red-600">{errors.entity.message}</p>}
      </div>

      {/* Activity Description */}
      <div className="space-y-1.5">
        <Label htmlFor="activity_description">Activity Description</Label>
        <Textarea
          id="activity_description"
          placeholder="Detailed description of operational activity performed…"
          rows={4}
          {...register('activity_description')}
        />
        {errors.activity_description && (
          <p className="text-xs text-red-600">{errors.activity_description.message}</p>
        )}
      </div>

      {/* Time Spent */}
      <div className="space-y-1.5">
        <Label>Time Spent</Label>
        <div className="flex items-center gap-3">
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                max={24}
                className="w-20 text-center"
                {...register('hours')}
              />
              <span className="text-sm text-gray-600">hours</span>
            </div>
            {errors.hours && <p className="text-xs text-red-600">{errors.hours.message}</p>}
          </div>
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                max={59}
                className="w-20 text-center"
                {...register('minutes')}
              />
              <span className="text-sm text-gray-600">minutes</span>
            </div>
            {errors.minutes && <p className="text-xs text-red-600">{errors.minutes.message}</p>}
          </div>
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? 'Submitting…' : 'Log Business Hours'}
      </Button>
    </form>
  )
}
