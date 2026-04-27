"use client";

import { useMemo } from "react";
import { MonitoringTileCard } from "./monitoring-tile";
import { EmptyState } from "./empty-state";
import type { MonitoringTile, Track } from "@/lib/types";

const GROUP_LABEL: Record<string, string> = {
  sites_marketing: "Sites & marketing",
  outbound_email: "Outbound & email",
  pipeline_revenue: "Pipeline & revenue",
  refactor_sprint_engagements: "Refactor Sprint · engagements",
  venture_health: "Ventures · product health",
  job_search: "Job search",
  personal_ops: "Personal ops",
};

const EMPTY_TILES = [
  {
    title: "Configure Stripe",
    hint: "Connect Stripe to see revenue and outstanding invoices here.",
  },
  {
    title: "Configure Lemon Squeezy",
    hint: "Connect Lemon Squeezy to see MRR, subscribers, and trials.",
  },
  {
    title: "Configure HubSpot",
    hint: "Connect HubSpot to see Sprint pipeline and lifecycle health.",
  },
  {
    title: "Configure Vercel or analytics",
    hint: "Connect production telemetry to monitor traffic, errors, and conversions.",
  },
];

export function MonitoringGrid({
  tiles: allTiles,
  trackFilter,
}: {
  tiles: MonitoringTile[];
  trackFilter: Track | null;
}) {
  const tiles = useMemo(
    () => allTiles.filter((t) => (trackFilter ? t.track === trackFilter : true)),
    [allTiles, trackFilter]
  );

  const grouped = useMemo(() => {
    const m = new Map<string, typeof tiles>();
    for (const t of tiles) {
      if (!m.has(t.group)) m.set(t.group, []);
      m.get(t.group)!.push(t);
    }
    return m;
  }, [tiles]);

  return (
    <section className="rounded-xl border bg-card">
      <header className="flex items-center justify-between gap-2 border-b px-4 py-2.5">
        <h2 className="text-sm font-semibold tracking-tight">Monitoring</h2>
        <span className="text-[11px] text-muted-foreground">
          · {tiles.length} tiles
        </span>
      </header>
      <div className="space-y-4 p-3">
        {Array.from(grouped.entries()).map(([group, ts]) => (
          <div key={group}>
            <div className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              {GROUP_LABEL[group] ?? group}
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {ts.map((t) => (
                <MonitoringTileCard key={t.id} tile={t} />
              ))}
            </div>
          </div>
        ))}
        {tiles.length === 0 ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {EMPTY_TILES.map((tile) => (
              <EmptyState
                key={tile.title}
                title={tile.title}
                hint={tile.hint}
                action={{ label: "Open settings", href: "/settings" }}
                size="sm"
              />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
