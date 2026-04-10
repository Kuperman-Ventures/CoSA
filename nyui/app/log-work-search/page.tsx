import { WorkSearchForm } from '@/components/forms/work-search-form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function LogWorkSearchPage() {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Log Work Search Activity</h1>
        <p className="text-sm text-gray-500 mt-1">
          Record each contact or application attempt for NYS DOL compliance. Remember: you need activities on 3 different days per week.
        </p>
      </div>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">New Work Search Entry</CardTitle>
          <CardDescription>All fields marked below are required unless noted as optional.</CardDescription>
        </CardHeader>
        <CardContent>
          <WorkSearchForm />
        </CardContent>
      </Card>
    </div>
  )
}
