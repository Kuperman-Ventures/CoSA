# Product Health

Uptime + response-time monitoring for our public sites and the Refactor
Sprint internal tool surfaces. Renders in the right rail of Home, above
the business-KPI `MonitoringGrid`.

## Architecture

```
lib/monitoring/targets.ts     ← edit this to add/remove targets
       │
       ├──→ /api/monitoring/health-check  (Vercel Cron, every 2 min)
       │       persists rows into jasonos.health_checks (Supabase)
       │       fires lib/notify on 2 consecutive internal-tool failures
       │
       └──→ /api/monitoring/health-summary (GET, 30s cache)
               returns {target, latest, p95Hour, series[], history24h[]}
                  │
                  └──→ <ProductHealth /> tile cluster on Home
```

## Adding a new target

1. Open [`lib/monitoring/targets.ts`](../../../lib/monitoring/targets.ts).
2. Append to `MONITORING_TARGETS`:

   ```ts
   {
     id: "rs-new-page",                     // stable, used as DB target_id
     label: "RS · /new-page",                // shown in the tile
     url: "https://refactorsprint.com/new-page",
     intervalMs: 2 * 60_000,                 // informational
     timeoutMs: 10_000,
     criticality: "high",                    // critical | high | normal
     kind: "internal_tool",                  // internal_tool | public_site
     expect: { maxResponseTimeMs: 2000 },    // any response over → yellow
   },
   ```

3. Deploy. The cron picks the new target up on its next run; no DB
   migration is required because `target_id` is just a `text` column.

## Status classification

`classifyStatus()` in [`targets.ts`](../../../lib/monitoring/targets.ts):

- `green` — 2xx **and** under `expect.maxResponseTimeMs`.
- `yellow` — 3xx, status code outside `expect.statusCodes`, or 2xx but
  slower than `expect.maxResponseTimeMs`.
- `red` — 4xx, 5xx, network error, or timeout.
- `unknown` — no probes recorded yet (e.g. brand-new target on a fresh
  Supabase deploy).

## Operational notes

- The cron route is gated by `CRON_SECRET` when that env var is set.
  Vercel automatically supplies the bearer token. In local/dev (no
  `CRON_SECRET`) the route is open.
- Probes use a fixed `User-Agent` string `JasonOS-ProductHealth/0.1`.
  Whitelist this in any WAF rules on monitored origins.
- 9 targets × every 2 min × 24h = ~6,500 rows/day. A daily prune job
  should delete rows older than 30 days; until then the table will
  grow unbounded. Suggested SQL:

  ```sql
  delete from jasonos.health_checks
  where checked_at < now() - interval '30 days';
  ```

- Feature flag: `NEXT_PUBLIC_PRODUCT_HEALTH_ENABLED=false` hides the UI
  while leaving the backend running.
