// Server-side data layer for the dashboard.
// Stitches live integration data (Stripe, Lemon Squeezy) into the existing
// MOCK_TILES / hero / KPI shape so the UI can stay shape-stable as more
// integrations come online.

import "server-only";
import { MOCK_TILES } from "@/lib/mock/data";
import type { MonitoringTile, Track } from "@/lib/types";
import { getStripeRevenue } from "@/lib/integrations/stripe";
import { getLemonSqueezyMetrics } from "@/lib/integrations/lemon-squeezy";

// ---------- Hero strip ---------------------------------------------------

export interface HeroDatum {
  track: Track;
  metric: string;
  value: string;
  secondary?: string;
  delta: number;
  series: number[];
  source: "live" | "mock";
}

export interface CrossKpi {
  label: string;
  value: string;
  delta?: number;
  alarm?: boolean;
  sourceNote?: string;
  source: "live" | "mock";
}

export interface DashboardData {
  hero: HeroDatum[];
  kpis: CrossKpi[];
  tiles: MonitoringTile[];
}

const fmtUsd = (n: number, opts?: Intl.NumberFormatOptions) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
    ...opts,
  }).format(n);

const fmtUsdShort = (n: number) => {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 10_000) return `$${(n / 1_000).toFixed(0)}k`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return fmtUsd(n);
};

// Synthetic-ish flat sparkline ending at `value` with mild noise.
// Used as a placeholder until we have historical snapshots stored in Supabase.
function flatSeries(value: number, n = 30, jitter = 0.02): number[] {
  return Array.from({ length: n }, (_, i) => {
    const wave = Math.sin(i * 0.6) * jitter * value;
    return Math.max(0, +(value + wave).toFixed(2));
  });
}

export async function getDashboardData(): Promise<DashboardData> {
  const [stripe, ls] = await Promise.all([
    getStripeRevenue(),
    getLemonSqueezyMetrics(),
  ]);

  // ---- Hero ------------------------------------------------------------
  const heroVenture: HeroDatum = ls.configured
    ? {
        track: "venture",
        metric: "MRR · gtmtools.io",
        value: fmtUsd(ls.mrr),
        secondary: `${ls.activeSubscribers} active · ${ls.trialingSubscribers} trialing`,
        delta: 0,
        series: ls.series30d,
        source: "live",
      }
    : {
        track: "venture",
        metric: "MRR · gtmtools.io",
        value: "$3,840",
        secondary: "23 active testers · encoreOS",
        delta: 0.18,
        series: [
          2.7, 2.8, 2.9, 2.95, 3.0, 3.1, 3.2, 3.25, 3.3, 3.4, 3.5, 3.55, 3.6,
          3.7, 3.8, 3.84,
        ],
        source: "mock",
      };

  const hero: HeroDatum[] = [
    heroVenture,
    {
      track: "advisors",
      metric: "Weighted pipeline",
      value: "$184k",
      secondary: "3 active Sprints",
      delta: 0.09,
      series: [110, 118, 122, 130, 138, 142, 150, 155, 160, 165, 170, 175, 178, 182, 184],
      source: "mock",
    },
    {
      track: "job_search",
      metric: "Active conversations",
      value: "14",
      secondary: "4d since last forward motion",
      delta: 0.0,
      series: [9, 10, 10, 11, 12, 12, 13, 13, 14, 14, 14, 14, 14, 14, 14],
      source: "mock",
    },
    {
      track: "personal",
      metric: "Open personal to-dos",
      value: "6",
      secondary: "2 due this week",
      delta: -0.25,
      series: [10, 10, 9, 9, 8, 8, 8, 7, 7, 7, 7, 6, 6, 6, 6],
      source: "mock",
    },
  ];

  // ---- Cross-track KPIs ------------------------------------------------
  const totalMtd = (stripe.configured ? stripe.mtd : 0) + (ls.configured ? ls.thirtyDayRevenue : 0);
  // Crude blended delta — only Stripe gives us a true period-over-period.
  const blendedDelta = stripe.configured && stripe.prevPeriodMtd > 0
    ? (stripe.mtd - stripe.prevPeriodMtd) / stripe.prevPeriodMtd
    : 0;

  const revenueLive = stripe.configured || ls.configured;

  const kpis: CrossKpi[] = [
    revenueLive
      ? {
          label: "Revenue MTD",
          value: fmtUsdShort(totalMtd),
          delta: blendedDelta,
          source: "live",
          sourceNote: "Stripe MTD + Lemon Squeezy 30d",
        }
      : { label: "Revenue MTD", value: "$11,420", delta: 0.42, source: "mock" },
    stripe.configured
      ? {
          label: "Outstanding invoices",
          value: fmtUsdShort(stripe.outstandingInvoices),
          delta: undefined,
          source: "live",
          sourceNote: "Stripe · open invoices",
        }
      : { label: "Outstanding invoices", value: "$4,300", delta: -0.1, source: "mock" },
    { label: "Meetings this week", value: "11", delta: 0.0, source: "mock" },
    { label: "Live errors", value: "1", alarm: true, source: "mock" },
  ];

  // ---- Monitoring tiles ------------------------------------------------
  const tiles = MOCK_TILES.map<MonitoringTile>((t) => {
    if (t.id === "t-rev-mtd" && stripe.configured) {
      return {
        ...t,
        label: "Revenue MTD (Stripe)",
        value: fmtUsd(stripe.mtd),
        delta: stripe.delta,
        deltaLabel: "vs same days last month",
        series: stripe.series30d,
        refreshedAt: new Date().toISOString(),
        source: "Stripe (live)",
      };
    }
    if (t.id === "t-ls-mrr" && ls.configured) {
      return {
        ...t,
        label: "gtmtools.io MRR",
        value: fmtUsd(ls.mrr),
        delta: 0,
        deltaLabel: `${ls.activeSubscribers} active`,
        series: ls.series30d.length ? ls.series30d : flatSeries(ls.mrr),
        refreshedAt: new Date().toISOString(),
        source: "Lemon Squeezy (live)",
      };
    }
    if (t.id === "t-ls-trial" && ls.configured) {
      // We don't have trial→paid conversion live yet — but we can show count of
      // trials currently active and how many expire in 48h, which is more useful
      // than a stale percentage.
      return {
        ...t,
        label: "gtmtools.io trials",
        value: `${ls.trialingSubscribers}`,
        delta: undefined,
        deltaLabel:
          ls.trialsExpiring48h > 0
            ? `${ls.trialsExpiring48h} expiring in 48h`
            : "no trials expiring soon",
        series: flatSeries(ls.trialingSubscribers || 0.0001),
        refreshedAt: new Date().toISOString(),
        source: "Lemon Squeezy (live)",
        alert:
          ls.trialsExpiring48h > 0
            ? {
                tone: "warn",
                message: `${ls.trialsExpiring48h} trial(s) expire within 48 hours.`,
                verb: "Send conversion nudge",
              }
            : undefined,
      };
    }
    return t;
  });

  return { hero, kpis, tiles };
}
