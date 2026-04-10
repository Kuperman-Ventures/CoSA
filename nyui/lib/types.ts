export type WorkSearch = {
  id: string
  date: string
  company_name: string
  company_location: string
  contact_method: string
  contact_person: string | null
  position_applied: string
  result: string
  created_at: string
}

export type BusinessHours = {
  id: string
  date: string
  entity: 'Kuperman Ventures LLC' | 'Kuperman Advisors LLC'
  activity_description: string
  hours: number
  minutes: number
  created_at: string
}

export type ActionResult =
  | { success: true }
  | { error: string }
