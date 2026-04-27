"use client";

import { useState } from "react";
import { HeroStrip } from "@/components/jasonos/hero-strip";
import { CrossTrackKpis } from "@/components/jasonos/cross-kpis";
import { MustDos } from "@/components/jasonos/must-dos";
import { ActionQueue } from "@/components/jasonos/action-queue";
import { MonitoringGrid } from "@/components/jasonos/monitoring-grid";
import { RecruiterOutreachCard } from "@/components/jasonos/recruiter-outreach-card";
import { DailyWrap } from "@/components/jasonos/daily-wrap";
import { ThisWeekCard } from "@/components/jasonos/this-week-card";
import { AskDispatchButton } from "@/components/dispatch/AskDispatchButton";
import type { Track } from "@/lib/types";
import type { DashboardData } from "@/lib/data/dashboard";

export function DashboardClient({ data }: { data: DashboardData }) {
  const [trackFilter, setTrackFilter] = useState<Track | null>(null);

  return (
    <div className="mx-auto max-w-[1800px] space-y-4 px-4 py-4">
      <div className="flex justify-end">
        <AskDispatchButton
          requestType="daily_briefing"
          sourcePage="/"
          context={{
            date: new Date().toISOString().slice(0, 10),
            open_tasks: data.kpis,
            pending_outreaches: data.hero.find((item) => item.track === "job_search"),
          }}
          label="Ask Dispatch for briefing"
        />
      </div>
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
          <RecruiterOutreachCard stats={data.recruiterOutreach} />
          <MonitoringGrid tiles={data.tiles} trackFilter={trackFilter} />
        </div>
      </div>

      <DailyWrap />
    </div>
  );
}
