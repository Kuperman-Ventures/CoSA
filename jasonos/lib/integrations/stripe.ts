// Stripe adapter — read-only billing pulls for Kuperman Advisors + Refactor Sprint.
// Server-only. All public functions are wrapped in unstable_cache (5-min TTL)
// so a dashboard refresh doesn't hammer the Stripe API.

import "server-only";
import Stripe from "stripe";
import { unstable_cache } from "next/cache";

const apiKey = process.env.STRIPE_SECRET_KEY;
const stripe = apiKey
  ? new Stripe(apiKey, {
      apiVersion: "2026-03-25.dahlia",
      maxNetworkRetries: 2,
      timeout: 15_000,
      appInfo: { name: "JasonOS", version: "0.1.0" },
    })
  : null;

const DAY_MS = 86_400_000;
const CACHE_TTL = 300; // 5 minutes

function startOfMonthUtc(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function startOfPrevMonthUtc(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1));
}

async function listSucceededCharges(sinceUnix: number) {
  if (!stripe) return [] as Stripe.Charge[];
  const out: Stripe.Charge[] = [];
  for await (const ch of stripe.charges.list({
    created: { gte: sinceUnix },
    limit: 100,
  })) {
    if (ch.status === "succeeded" && !ch.refunded) out.push(ch);
  }
  return out;
}

export interface StripeRevenue {
  mtd: number;            // dollars
  prevPeriodMtd: number;  // same number of days into prev month, for delta
  delta: number;          // (mtd - prev) / prev, 0 if prev=0
  series30d: number[];    // daily totals (oldest → newest), dollars
  outstandingInvoices: number; // dollars (status=open)
  currency: string;       // "usd"
  configured: boolean;
}

async function fetchStripeRevenueImpl(): Promise<StripeRevenue> {
  if (!stripe) {
    return {
      mtd: 0,
      prevPeriodMtd: 0,
      delta: 0,
      series30d: Array(30).fill(0),
      outstandingInvoices: 0,
      currency: "usd",
      configured: false,
    };
  }

  const now = new Date();
  const monthStart = startOfMonthUtc(now);
  const prevMonthStart = startOfPrevMonthUtc(now);
  const dayInMonth = now.getUTCDate(); // 1..31
  const prevPeriodEnd = new Date(prevMonthStart);
  prevPeriodEnd.setUTCDate(dayInMonth);

  // We fetch enough history to cover (a) current MTD, (b) prev-month MTD window,
  // (c) the 30-day sparkline. Earliest of those three is our floor.
  const start30d = new Date(now.getTime() - 30 * DAY_MS);
  const floor = new Date(
    Math.min(
      monthStart.getTime(),
      prevMonthStart.getTime(),
      start30d.getTime()
    )
  );
  const sinceUnix = Math.floor(floor.getTime() / 1000);

  const [charges, openInvoices] = await Promise.all([
    listSucceededCharges(sinceUnix),
    (async () => {
      const invs: Stripe.Invoice[] = [];
      for await (const inv of stripe.invoices.list({ status: "open", limit: 100 })) {
        invs.push(inv);
      }
      return invs;
    })(),
  ]);

  let mtd = 0;
  let prevPeriodMtd = 0;
  let currency = "usd";
  const series30d = new Array(30).fill(0) as number[];

  for (const ch of charges) {
    const created = ch.created * 1000;
    const amt = (ch.amount ?? 0) / 100;
    if (ch.currency) currency = ch.currency;

    if (created >= monthStart.getTime()) mtd += amt;
    if (
      created >= prevMonthStart.getTime() &&
      created < prevPeriodEnd.getTime()
    ) {
      prevPeriodMtd += amt;
    }
    if (created >= start30d.getTime()) {
      const ageDays = Math.floor((now.getTime() - created) / DAY_MS);
      const idx = 29 - ageDays;
      if (idx >= 0 && idx < 30) series30d[idx] += amt;
    }
  }

  const outstandingInvoices = openInvoices.reduce(
    (s, inv) => s + (inv.amount_due ?? inv.total ?? 0) / 100,
    0
  );

  const delta = prevPeriodMtd > 0 ? (mtd - prevPeriodMtd) / prevPeriodMtd : 0;

  return {
    mtd: round2(mtd),
    prevPeriodMtd: round2(prevPeriodMtd),
    delta,
    series30d: series30d.map(round2),
    outstandingInvoices: round2(outstandingInvoices),
    currency,
    configured: true,
  };
}

const cachedFetch = unstable_cache(
  fetchStripeRevenueImpl,
  ["jasonos:stripe:revenue"],
  { revalidate: CACHE_TTL, tags: ["jasonos:stripe"] }
);

/**
 * Returns Stripe revenue MTD, prior-period MTD, a 30-day daily series (sparkline),
 * and outstanding invoices total. Cached 5 minutes. Returns zeros + configured:false
 * if STRIPE_SECRET_KEY is missing; callers should render an empty state.
 */
export async function getStripeRevenue(): Promise<StripeRevenue> {
  try {
    return await cachedFetch();
  } catch (err) {
    console.error("[stripe] fetch failed:", err);
    return {
      mtd: 0,
      prevPeriodMtd: 0,
      delta: 0,
      series30d: Array(30).fill(0),
      outstandingInvoices: 0,
      currency: "usd",
      configured: !!stripe,
    };
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
