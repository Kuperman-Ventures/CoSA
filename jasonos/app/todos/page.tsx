import { InitiativeDashboard } from "@/components/jasonos/initiative-dashboard";

export const metadata = { title: "To-Dos · JasonOS" };

export default function TodosPage() {
  return (
    <div className="mx-auto max-w-[1800px] space-y-4 px-4 py-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">To-Dos</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Initiatives mapped to Ventures, Advisors, Job Search, and Personal. Checkbox state
          persists locally to your browser.
        </p>
      </header>

      <InitiativeDashboard />
    </div>
  );
}
