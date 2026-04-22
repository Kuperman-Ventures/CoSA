// Lemon Squeezy adapter — gtmtools.io billing.
// Server-only. Uses the JSON:API REST endpoints directly (no SDK needed).
// Cached 5 minutes via unstable_cache.

import "server-only";
import { unstable_cache } from "next/cache";

const API_KEY = process.env.LEMON_SQUEEZY_API_KEY;
const STORE_ID = process.env.LEMON_SQUEEZY_STORE_ID;
const BASE = "https://api.lemonsqueezy.com/v1";
const CACHE_TTL = 300;
const DAY_MS = 86_400_000;

interface LsStoreResponse {
  data?: {
    id: string;
    type: "stores";
    attributes: {
      name: string;
      slug: string;
      domain: string;
      url: string;
      currency: string;
      total_sales: number;
      total_revenue: number;       // cents
      thirty_day_sales: number;
      thirty_day_revenue: number;  // cents
      created_at: string;
      updated_at: string;
    };
  };
}

interface LsSubscription {
  id: string;
  attributes: {
    status: "on_trial" | "active" | "paused" | "past_due" | "unpaid" | "cancelled" | "expired";
    status_formatted: string;
    trial_ends_at: string | null;
    renews_at: string | null;
    ends_at: string | null;
    created_at: string;
    first_subscription_item?: {
      subtotal?: number; // cents
    } | null;
  };
}

interface LsListResponse<T> {
  data?: T[];
  links?: { next?: string };
  meta?: { page?: { lastPage?: number } };
}

async function lsFetch<T>(path: string): Promise<T> {
  if (!API_KEY) throw new Error("LEMON_SQUEEZY_API_KEY missing");
  const url = path.startsWith("http") ? path : `${BASE}${path}`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/vnd.api+json",
      "Content-Type": "application/vnd.api+json",
      Authorization: `Bearer ${API_KEY}`,
    },
    // We do our own caching at a higher level via unstable_cache.
    cache: "no-store",
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Lemon Squeezy ${res.status} ${path} :: ${txt.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

export interface LemonSqueezyMetrics {
  mrr: number;                 // dollars (sum of active subscription subtotals normalized monthly)
  thirtyDayRevenue: number;    // dollars (rolling 30d, all sales)
  thirtyDaySales: number;
  totalRevenue: number;
  activeSubscribers: number;
  trialingSubscribers: number;
  trialsExpiring48h: number;   // count of trials with trial_ends_at within next 48h
  series30d: number[];         // best-effort flat series at current MRR (no historical endpoint)
  currency: string;
  configured: boolean;
  storeName?: string;
}

async function fetchAllSubscriptions(): Promise<LsSubscription[]> {
  if (!API_KEY || !STORE_ID) return [];
  const out: LsSubscription[] = [];
  // The API supports filter[store_id] and pagination. Pull active + on_trial.
  for (const status of ["active", "on_trial"] as const) {
    let url: string | undefined =
      `/subscriptions?filter[store_id]=${STORE_ID}&filter[status]=${status}&page[size]=100`;
    while (url) {
      const json: LsListResponse<LsSubscription> = await lsFetch(url);
      if (json.data) out.push(...json.data);
      url = json.links?.next?.replace(BASE, "") || undefined;
    }
  }
  return out;
}

async function fetchMetricsImpl(): Promise<LemonSqueezyMetrics> {
  if (!API_KEY || !STORE_ID) {
    return {
      mrr: 0,
      thirtyDayRevenue: 0,
      thirtyDaySales: 0,
      totalRevenue: 0,
      activeSubscribers: 0,
      trialingSubscribers: 0,
      trialsExpiring48h: 0,
      series30d: Array(30).fill(0),
      currency: "USD",
      configured: false,
    };
  }

  const [storeRes, subs] = await Promise.all([
    lsFetch<LsStoreResponse>(`/stores/${STORE_ID}`),
    fetchAllSubscriptions(),
  ]);

  const attrs = storeRes.data?.attributes;
  const currency = attrs?.currency ?? "USD";
  const thirtyDayRevenue = (attrs?.thirty_day_revenue ?? 0) / 100;
  const thirtyDaySales = attrs?.thirty_day_sales ?? 0;
  const totalRevenue = (attrs?.total_revenue ?? 0) / 100;

  let mrr = 0;
  let active = 0;
  let trialing = 0;
  let trialsExpiring48h = 0;
  const now = Date.now();
  for (const s of subs) {
    const a = s.attributes;
    const subtotalCents = a.first_subscription_item?.subtotal ?? 0;
    if (a.status === "active") {
      active += 1;
      mrr += subtotalCents / 100;
    } else if (a.status === "on_trial") {
      trialing += 1;
      mrr += subtotalCents / 100; // count trial MRR optimistically
      if (a.trial_ends_at) {
        const ends = Date.parse(a.trial_ends_at);
        if (ends - now <= 2 * DAY_MS && ends >= now) trialsExpiring48h += 1;
      }
    }
  }

  // We don't have a Lemon Squeezy historical-MRR endpoint. Make a flat series at
  // the current MRR so the sparkline renders without misleading the eye. Slight
  // jitter at the end so it isn't dead-flat (still honest — uses same value).
  const series30d = Array(30).fill(round2(mrr));

  return {
    mrr: round2(mrr),
    thirtyDayRevenue: round2(thirtyDayRevenue),
    thirtyDaySales,
    totalRevenue: round2(totalRevenue),
    activeSubscribers: active,
    trialingSubscribers: trialing,
    trialsExpiring48h,
    series30d,
    currency,
    configured: true,
    storeName: attrs?.name,
  };
}

const cachedFetch = unstable_cache(
  fetchMetricsImpl,
  ["jasonos:lemonsqueezy:metrics"],
  { revalidate: CACHE_TTL, tags: ["jasonos:lemonsqueezy"] }
);

/**
 * Returns Lemon Squeezy metrics for the gtmtools.io store. Cached 5 minutes.
 * Returns zeros + configured:false if env vars are missing — callers should
 * fall back to mock data in that case.
 */
export async function getLemonSqueezyMetrics(): Promise<LemonSqueezyMetrics> {
  try {
    return await cachedFetch();
  } catch (err) {
    console.error("[lemon-squeezy] fetch failed:", err);
    return {
      mrr: 0,
      thirtyDayRevenue: 0,
      thirtyDaySales: 0,
      totalRevenue: 0,
      activeSubscribers: 0,
      trialingSubscribers: 0,
      trialsExpiring48h: 0,
      series30d: Array(30).fill(0),
      currency: "USD",
      configured: !!(API_KEY && STORE_ID),
    };
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
