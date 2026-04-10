'use server'

import { createClient } from './supabase/server'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from './types'

export async function submitWorkSearch(data: {
  date: string
  company_name: string
  company_location: string
  contact_method: string
  contact_person: string
  position_applied: string
  result: string
}): Promise<ActionResult> {
  try {
    const supabase = createClient()
    const { error } = await supabase.from('work_searches').insert([data])
    if (error) return { error: error.message }
    revalidatePath('/')
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

export async function submitBusinessHours(data: {
  date: string
  entity: string
  activity_description: string
  hours: number
  minutes: number
}): Promise<ActionResult> {
  try {
    const supabase = createClient()
    const { error } = await supabase.from('business_hours').insert([data])
    if (error) return { error: error.message }
    revalidatePath('/')
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Unknown error' }
  }
}
