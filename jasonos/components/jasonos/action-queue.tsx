"use client";

import { useMemo } from "react";
import { ActionCardItem } from "./action-card";
import { MOCK_CARDS } from "@/lib/mock/data";
import { TRACK_META, TRACKS, type Track } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function ActionQueue({
  trackFilter,
  onTrackFilter,
}: {
  trackFilter: Track | null;
  onTrackFilter: (t: Track | null) => void;
}) {
  const filtered = useMemo(() => {
    return MOCK_CARDS.filter((c) => c.state === "open")
      .filter((c) => (trackFilter ? c.track === trackFilter : true))
      .sort((a, b) => (b.priority_score ?? 0) - (a.priority_score ?? 0));
  }, [trackFilter]);

  const grouped = useMemo(() => {
    const map = new Map<Track, typeof filtered>();
    for (const c of filtered) {
      if (!map.has(c.track)) map.set(c.track, []);
      map.get(c.track)!.push(c);
    }
    return map;
  }, [filtered]);

  return (
    <section className="rounded-xl border bg-card">
      <header className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5">
        <h2 className="text-sm font-semibold tracking-tight">Action Queue</h2>
        <span className="text-[11px] text-muted-foreground">
          · {filtered.length} open
        </span>

        <div className="ml-auto flex flex-wrap items-center gap-1">
          <Button
            size="sm"
            variant={trackFilter === null ? "secondary" : "ghost"}
            className="h-7 px-2 text-[11px]"
            onClick={() => onTrackFilter(null)}
          >
            All tracks
          </Button>
          {TRACKS.map((t) => (
            <Button
              key={t}
              size="sm"
              variant={trackFilter === t ? "secondary" : "ghost"}
              className={cn(
                "h-7 px-2 text-[11px]",
                trackFilter === t && TRACK_META[t].accent
              )}
              onClick={() => onTrackFilter(trackFilter === t ? null : t)}
            >
              {TRACK_META[t].short}
            </Button>
          ))}
        </div>
      </header>

      <div className="grid grid-cols-1 gap-3 p-3 lg:grid-cols-2">
        {Array.from(grouped.entries()).map(([track, cards]) => (
          <div key={track} className="space-y-2">
            <div
              className={cn(
                "flex items-center gap-2 px-1 text-[10px] font-semibold uppercase tracking-widest",
                TRACK_META[track].accent
              )}
            >
              <span className="h-1 w-1 rounded-full bg-current" />
              {TRACK_META[track].label}
              <span className="text-muted-foreground">· {cards.length}</span>
            </div>
            <div className="space-y-2">
              {cards.map((c) => (
                <ActionCardItem key={c.id} card={c} />
              ))}
            </div>
          </div>
        ))}
        {filtered.length === 0 ? (
          <div className="col-span-full py-10 text-center text-xs text-muted-foreground">
            Inbox zero across this filter. Take a breath.
          </div>
        ) : null}
      </div>
    </section>
  );
}
