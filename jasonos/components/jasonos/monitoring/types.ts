// Shared client-side types for Product Health components. Mirrors the
// shape returned by /api/monitoring/health-summary so the route is the
// single source of truth.

import type { HealthStatus, MonitoringTarget } from "@/lib/monitoring/targets";

export interface HealthCheckRow {
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
