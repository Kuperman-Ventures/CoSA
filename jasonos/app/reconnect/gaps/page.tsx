import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Reconnect Gaps · JasonOS" };

const GAPS = [
  {
    firm: "Egon Zehnder",
    why: "Strong CMO/SVP search presence, no scored contact in current seed.",
    bridge: "Ask TBWA alumni network for a warm intro.",
  },
  {
    firm: "True Search",
    why: "High-growth SaaS and PE-backed searches map well to the GTM Architect frame.",
    bridge: "Look for Agency.com or Omnicom overlap.",
  },
  {
    firm: "Daversa Partners",
    why: "Venture-backed GTM leadership lane; useful for $50M-$500M SaaS target.",
    bridge: "Search LinkedIn for shared founders and board contacts.",
  },
];

export default function ReconnectGapsPage() {
  return (
    <div className="mx-auto max-w-[900px] space-y-4 px-4 py-6">
      <Button variant="ghost" size="sm" render={<Link href="/reconnect" />} className="-ml-2">
        <ArrowLeft className="h-4 w-4" />
        Reconnect
      </Button>
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Network Gaps</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          v1.1 static gap scaffold. Replace this with the imported Network Gaps JSON
          when that file lands.
        </p>
      </header>
      <div className="space-y-3">
        {GAPS.map((gap) => (
          <article key={gap.firm} className="rounded-xl border bg-card p-4">
            <h2 className="font-semibold tracking-tight">{gap.firm}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{gap.why}</p>
            <p className="mt-3 rounded-lg border bg-background/40 p-3 text-sm">
              {gap.bridge}
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}
