import { BusinessHoursForm } from '@/components/forms/business-hours-form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function LogBusinessHoursPage() {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Log Business Hours</h1>
        <p className="text-sm text-gray-500 mt-1">
          Record operational work for Kuperman Ventures LLC or Kuperman Advisors LLC. Combined weekly hours must stay under 31 to preserve UI eligibility.
        </p>
      </div>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">New Business Hours Entry</CardTitle>
          <CardDescription>All fields are required.</CardDescription>
        </CardHeader>
        <CardContent>
          <BusinessHoursForm />
        </CardContent>
      </Card>
    </div>
  )
}
