"use client";

import { useState } from "react";
import { HeroStrip } from "@/components/jasonos/hero-strip";
import { CrossTrackKpis } from "@/components/jasonos/cross-kpis";
import { MustDos } from "@/components/jasonos/must-dos";
import { ActionQueue } from "@/components/jasonos/action-queue";
import { MonitoringGrid } from "@/components/jasonos/monitoring-grid";
import { DailyWrap } from "@/components/jasonos/daily-wrap";
import { ThisWeekCard } from "@/components/jasonos/this-week-card";
import type { Track } from "@/lib/types";
import type { DashboardData } from "@/lib/data/dashboard";

export function DashboardClient({ data }: { data: DashboardData }) {
  const [trackFilter, setTrackFilter] = useState<Track | null>(null);

  return (
    <div className="mx-auto max-w-[1800px] space-y-4 px-4 py-4">
      <ThisWeekCard />
      <HeroStrip
        data={data.hero}
        activeTrack={trackFilter}
        onSelectTrack={setTrackFilter}
      />
      <CrossTrackKpis kpis={data.kpis} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <MustDos />
          <ActionQueue trackFilter={trackFilter} onTrackFilter={setTrackFilter} />
        </div>
        <div className="space-y-4">
          <MonitoringGrid tiles={data.tiles} trackFilter={trackFilter} />
        </div>
      </div>

      <DailyWrap />
    </div>
  );
}
