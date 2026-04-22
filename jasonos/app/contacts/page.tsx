export const metadata = { title: "Contacts · JasonOS" };

export default function ContactsPage() {
  return (
    <div className="mx-auto max-w-[1200px] space-y-3 px-4 py-6">
      <h1 className="text-xl font-semibold tracking-tight">Contacts</h1>
      <p className="text-xs text-muted-foreground">
        Reconciled view across encore-os, HubSpot, LeadDelta, and Gmail. Wired
        in v2 (spec §12.2). Schema is ready in <code>jasonos.contacts</code>.
      </p>
      <div className="rounded-xl border bg-card p-10 text-center text-xs text-muted-foreground">
        Coming online with the Job Search hygiene module.
      </div>
    </div>
  );
}
