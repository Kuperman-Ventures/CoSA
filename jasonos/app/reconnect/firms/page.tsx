import Link from "next/link";
import { getReconnectDashboardData } from "@/lib/reconnect/data";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export const metadata = { title: "Reconnect Firms · JasonOS" };

export default async function ReconnectFirmsPage() {
  const data = await getReconnectDashboardData();
  const firms = Array.from(
    data.contacts.reduce((map, contact) => {
      const current = map.get(contact.firm) ?? {
        firm: contact.firm,
        count: 0,
        total: 0,
        top: contact,
      };
      current.count += 1;
      current.total += contact.strategic_score;
      if (contact.strategic_score > current.top.strategic_score) current.top = contact;
      map.set(contact.firm, current);
      return map;
    }, new Map<string, { firm: string; count: number; total: number; top: (typeof data.contacts)[number] }>())
  ).map(([, firm]) => firm).sort((a, b) => b.total / b.count - a.total / a.count);

  return (
    <div className="mx-auto max-w-[1100px] space-y-4 px-4 py-6">
      <Button variant="ghost" size="sm" render={<Link href="/reconnect" />} className="-ml-2">
        <ArrowLeft className="h-4 w-4" />
        Reconnect
      </Button>
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Firm View</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          v1.1 firm grouping scaffold: contact count, average score, and the top recruiter.
        </p>
      </header>
      <div className="grid gap-3 md:grid-cols-2">
        {firms.map((firm) => (
          <article key={firm.firm} className="rounded-xl border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold tracking-tight">{firm.firm}</h2>
                <p className="text-sm text-muted-foreground">
                  {firm.count} contact{firm.count === 1 ? "" : "s"}
                </p>
              </div>
              <div className="num-mono rounded-md border px-2 py-1 text-sm">
                {Math.round(firm.total / firm.count)}
              </div>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              Top contact: <span className="text-foreground">{firm.top.name}</span>
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}
