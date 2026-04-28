"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { TriageRunner } from "@/components/jasonos/runners/triage-runner";
import type {
  TrackFilter,
  TriageTrackCounts,
  UntriagedReconnectCard,
} from "@/lib/triage/types";
import type { Track } from "@/lib/types";

const TRACK_TABS: Array<{ track: Track; label: string; always?: boolean }> = [
  { track: "advisors", label: "Advisors", always: true },
  { track: "job_search", label: "Job Search", always: true },
  { track: "venture", label: "Ventures" },
  { track: "personal", label: "Personal" },
];

export function TriageRunnerWrapper({
  initial,
  skippedContactIds,
  currentTrack,
  counts,
}: {
  initial: UntriagedReconnectCard | null;
  skippedContactIds: string[];
  currentTrack: TrackFilter;
  counts: TriageTrackCounts;
}) {
  const router = useRouter();
  const [triagedThisSession, setTriagedThisSession] = useState(0);
  const trackLabel = currentTrack
    ? TRACK_TABS.find((tab) => tab.track === currentTrack)?.label ?? currentTrack
    : null;

  return (
    <main className="mx-auto max-w-3xl space-y-4 px-4 py-6">
      <TriageTabs currentTrack={currentTrack} counts={counts} />

      {initial ? (
        <TriageRunner
          key={initial.card_id}
          cardId={initial.card_id}
          contactId={initial.contact_id}
          contactName={initial.contact_name}
          contactTitle={initial.contact_title}
          contactCompany={initial.contact_company}
          companyMissing={initial.company_missing}
          contactTags={initial.contact_tags ?? []}
          cardSubtitle={initial.subtitle}
          cardBody={initial.body}
          daysSinceContact={initial.days_since_contact}
          initialIntent={initial.current_intent}
          initialGoal={initial.current_goal}
          remainingCount={initial.remaining_count}
          firmContext={initial.firm_context}
          triagedThisSession={triagedThisSession}
          onTriaged={() => setTriagedThisSession((count) => count + 1)}
          onAdvance={() => router.refresh()}
          onSkip={(contactId) => {
            const skipped = [...new Set([...skippedContactIds, contactId])];
            const params = new URLSearchParams();
            if (currentTrack) params.set("track", currentTrack);
            params.set("skip", skipped.join(","));
            router.replace(`/runner/triage?${params}`);
          }}
        />
      ) : (
        <div className="mx-auto max-w-2xl space-y-4 rounded-xl border bg-card p-12 text-center">
          <h1 className="text-2xl font-semibold">
            {trackLabel ? `All caught up on ${trackLabel}` : "All caught up"}
          </h1>
          <p className="text-muted-foreground">
            Every reconnect contact in this queue has an intent set. Come back
            after the next ranker run.
          </p>
          {currentTrack ? (
            <Link href="/runner/triage" className="underline">
              View all tracks
            </Link>
          ) : (
            <Link href="/reconnect" className="underline">
              Back to Reconnect
            </Link>
          )}
        </div>
      )}
    </main>
  );
}

function TriageTabs({
  currentTrack,
  counts,
}: {
  currentTrack: TrackFilter;
  counts: TriageTrackCounts;
}) {
  const tabs = [
    { href: "/runner/triage", label: `All (${counts.total})`, active: !currentTrack },
    ...TRACK_TABS.filter((tab) => tab.always || counts.by_track[tab.track] > 0).map(
      (tab) => ({
        href: `/runner/triage?track=${tab.track}`,
        label: `${tab.label} (${counts.by_track[tab.track]})`,
        active: currentTrack === tab.track,
      })
    ),
  ];

  return (
    <nav className="flex flex-wrap gap-1 rounded-lg border bg-card p-1 text-sm">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={cn(
            "rounded-md px-2.5 py-1.5 transition-colors",
            tab.active
              ? "bg-muted text-foreground"
              : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
