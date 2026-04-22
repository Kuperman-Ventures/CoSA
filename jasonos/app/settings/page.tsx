import { getStripeRevenue } from "@/lib/integrations/stripe";
import { getLemonSqueezyMetrics } from "@/lib/integrations/lemon-squeezy";

export const metadata = { title: "Settings · JasonOS" };
export const revalidate = 300;

const fmtUsd = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(n);

export default async function SettingsPage() {
  const [stripe, ls] = await Promise.all([
    getStripeRevenue(),
    getLemonSqueezyMetrics(),
  ]);

  return (
    <div className="mx-auto max-w-[900px] space-y-6 px-4 py-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Integration keys live in <code>.env.local</code> (or your Vercel
          project&rsquo;s environment variables). Personalization, alert
          thresholds, and tile pinning will surface here in v1.
        </p>
      </header>

      <Section
        title="Live data preview"
        rows={[
          [
            "Stripe · Revenue MTD",
            stripe.configured
              ? `${fmtUsd(stripe.mtd)} (prev: ${fmtUsd(stripe.prevPeriodMtd)})`
              : "Not configured",
          ],
          [
            "Stripe · Outstanding invoices",
            stripe.configured ? fmtUsd(stripe.outstandingInvoices) : "Not configured",
          ],
          [
            "Lemon Squeezy · MRR (gtmtools)",
            ls.configured
              ? `${fmtUsd(ls.mrr)} · ${ls.activeSubscribers} active, ${ls.trialingSubscribers} trialing`
              : "Not configured",
          ],
          [
            "Lemon Squeezy · 30-day revenue",
            ls.configured
              ? `${fmtUsd(ls.thirtyDayRevenue)} (${ls.thirtyDaySales} sales)`
              : "Not configured",
          ],
          [
            "Lemon Squeezy · trials expiring 48h",
            ls.configured ? String(ls.trialsExpiring48h) : "Not configured",
          ],
        ]}
      />

      <Section
        title="Connected services"
        rows={[
          ["Supabase",                       envSet("NEXT_PUBLIC_SUPABASE_URL")],
          ["Vercel AI Gateway",              envSet("AI_GATEWAY_API_KEY", true)],
          ["HubSpot",                        envSet("HUBSPOT_ACCESS_TOKEN")],
          ["Stripe (Advisors + Sprint)",     envSet("STRIPE_SECRET_KEY")],
          ["Lemon Squeezy (gtmtools.io)",    envSet("LEMON_SQUEEZY_API_KEY")],
          ["Gmail (MCP)",                    "Wired via Cursor MCP"],
          ["Google Calendar",                "Wired via Cursor MCP"],
          ["encore-os",                      "Wired via Cursor MCP"],
          ["Instantly",                      envSet("INSTANTLY_API_KEY")],
          ["Taplio",                         envSet("TAPLIO_API_KEY")],
          ["LeadDelta",                      envSet("LEADDELTA_API_KEY")],
        ]}
      />

      <Section
        title="Alert thresholds"
        rows={[
          ["Site uptime",                    "<99% rolling 24h"],
          ["Email reply rate drop",          "30% vs 14d median"],
          ["Open rate drop",                 "25% vs 14d median"],
          ["Site traffic drop (DoD)",        "40%"],
          ["Trial→paid drop",                "25% vs 30d median"],
          ["Deal stage aging",               ">14 days in current stage"],
          ["Pipeline reply wait",            ">3 business days"],
        ]}
      />

      <Section
        title="Models"
        rows={[
          ["Best Next Action engine",  "claude-opus-4-7 via Vercel AI Gateway"],
          ["Tell Claude / Goal→Plan",  "claude-sonnet-4-6 via Vercel AI Gateway"],
        ]}
      />
    </div>
  );
}

function envSet(name: string, optional = false) {
  const v = process.env[name];
  if (v) return "Connected";
  return optional ? "Not configured (optional)" : "Not configured";
}

function Section({
  title,
  rows,
}: {
  title: string;
  rows: [string, string][];
}) {
  return (
    <section className="rounded-xl border bg-card">
      <header className="border-b px-4 py-2.5">
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
      </header>
      <ul className="divide-y">
        {rows.map(([k, v]) => (
          <li key={k} className="flex items-center justify-between px-4 py-2 text-[12px]">
            <span className="text-muted-foreground">{k}</span>
            <span
              className={
                v === "Connected" || /Wired/.test(v)
                  ? "text-emerald-400"
                  : v.startsWith("Not configured (optional)")
                  ? "text-muted-foreground"
                  : v.startsWith("Not configured")
                  ? "text-amber-300"
                  : "text-foreground"
              }
            >
              {v}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
