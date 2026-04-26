// GET /api/monitoring/health-summary
// Drives the Product Health tile cluster on Home. Returns one entry per
// monitoring target containing: latest probe, P95 over the last hour,
// 24h response-time series for the sparkline, full 24h history for the
// detail sheet, and the consecutive-failure count for prioritization.
//
// Cached 30s — refreshed faster than the 2-minute cron, so the UI is
// at-most ~30s stale relative to ground truth.

import { NextResponse } from "next/server";
import {
  MONITORING_TARGETS,
  classifyStatus,
  type HealthStatus,
  type MonitoringTarget,
} from "@/lib/monitoring/targets";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const revalidate = 30;

interface HealthCheckRow {
  id: string;
  target_id: string;
  url: string;
  status_code: number | null;
  response_time_ms: number | null;
  ok: boolean;
  error_message: string | null;
  checked_at: string;
}

export interface HealthSummaryEntry {
  target: MonitoringTarget;
  status: HealthStatus;
  latest: {
    statusCode: number | null;
    responseTimeMs: number | null;
    ok: boolean;
    errorMessage: string | null;
    checkedAt: string | null;
  };
  p95Hour: number | null;
  series: number[];
  history24h: HealthCheckRow[];
  consecutiveFailures: number;
}

export interface HealthSummaryPayload {
  generatedAt: string;
  configured: boolean;
  note?: string;
  targets: HealthSummaryEntry[];
}

function emptyEntry(target: MonitoringTarget): HealthSummaryEntry {
  return {
    target,
    status: "unknown",
    latest: {
      statusCode: null,
      responseTimeMs: null,
      ok: false,
      errorMessage: null,
      checkedAt: null,
    },
    p95Hour: null,
    series: [],
    history24h: [],
    consecutiveFailures: 0,
  };
}

function p95(values: number[]): number | null {
  const xs = values.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (xs.length === 0) return null;
  const idx = Math.min(xs.length - 1, Math.floor(xs.length * 0.95));
  return Math.round(xs[idx]);
}

function consecutiveFailures(rows: HealthCheckRow[]): number {
  // rows arrive newest-first; count leading non-ok rows.
  let n = 0;
  for (const r of rows) {
    if (r.ok) break;
    n += 1;
  }
  return n;
}

export async function GET() {
  const supaConfigured =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supaConfigured) {
    return NextResponse.json<HealthSummaryPayload>(
      {
        generatedAt: new Date().toISOString(),
        configured: false,
        note: "Supabase service role missing — render synthetic-green until cron persists checks.",
        targets: MONITORING_TARGETS.map((t) => ({
          ...emptyEntry(t),
          status: "unknown",
        })),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const sb = createServiceRoleClient();
    const since = new Date(Date.now() - 24 * 3600_000).toISOString();
    const { data, error } = await sb
      .from("health_checks")
      .select("id, target_id, url, status_code, response_time_ms, ok, error_message, checked_at")
      .gte("checked_at", since)
      .order("checked_at", { ascending: false })
      .limit(20_000);
    if (error) throw error;

    const byTarget = new Map<string, HealthCheckRow[]>();
    for (const row of (data ?? []) as HealthCheckRow[]) {
      const arr = byTarget.get(row.target_id) ?? [];
      arr.push(row);
      byTarget.set(row.target_id, arr);
    }

    const hourAgo = Date.now() - 3600_000;

    const entries: HealthSummaryEntry[] = MONITORING_TARGETS.map((target) => {
      const rows = byTarget.get(target.id) ?? [];
      if (rows.length === 0) return emptyEntry(target);
      const latest = rows[0];
      const lastHour = rows.filter((r) => Date.parse(r.checked_at) >= hourAgo);
      const p95H = p95(
        lastHour
          .map((r) => r.response_time_ms)
          .filter((n): n is number => typeof n === "number")
      );
      // Series: oldest → newest, capped at 60 points so the sparkline stays readable.
      const series = rows
        .slice(0, 60)
        .reverse()
        .map((r) => r.response_time_ms ?? 0);

      return {
        target,
        status: classifyStatus({
          statusCode: latest.status_code,
          responseTimeMs: latest.response_time_ms,
          ok: latest.ok,
          expect: target.expect,
        }),
        latest: {
          statusCode: latest.status_code,
          responseTimeMs: latest.response_time_ms,
          ok: latest.ok,
          errorMessage: latest.error_message,
          checkedAt: latest.checked_at,
        },
        p95Hour: p95H,
        series,
        history24h: rows,
        consecutiveFailures: consecutiveFailures(rows),
      };
    });

    return NextResponse.json<HealthSummaryPayload>(
      {
        generatedAt: new Date().toISOString(),
        configured: true,
        targets: entries,
      },
      {
        headers: {
          // Vercel CDN: 30s SWR — matches `revalidate` above, just spelled out.
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120",
        },
      }
    );
  } catch (err) {
    console.error("[/api/monitoring/health-summary] query failed:", err);
    return NextResponse.json<HealthSummaryPayload>(
      {
        generatedAt: new Date().toISOString(),
        configured: true,
        note: err instanceof Error ? err.message : String(err),
        targets: MONITORING_TARGETS.map(emptyEntry),
      },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }
}
