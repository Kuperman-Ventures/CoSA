"use client";

import { ActionCardItem } from "./action-card";
import { Button } from "@/components/ui/button";
import { Pin, RefreshCw, Sparkles } from "lucide-react";
import { useMemo } from "react";
import { MOCK_BNA, MOCK_CARDS } from "@/lib/mock/data";
import { toast } from "sonner";

export function MustDos() {
  const items = useMemo(
    () =>
      MOCK_BNA.map((b) => {
        const card = MOCK_CARDS.find((c) => c.id === b.card_id);
        return card ? { card, ...b } : null;
      }).filter(Boolean) as { card: (typeof MOCK_CARDS)[number]; rank: number; why_now: string; suggested_time_block?: string; pinned?: boolean }[],
    []
  );

  return (
    <section className="rounded-xl border bg-card">
      <header className="flex items-center justify-between gap-2 border-b px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-amber-400" />
          <h2 className="text-sm font-semibold tracking-tight">Today&rsquo;s Must-Dos</h2>
          <span className="text-[11px] text-muted-foreground">
            · {items.length} ranked by Claude
          </span>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 gap-1.5 px-2 text-[11px] text-muted-foreground hover:text-foreground"
          onClick={() =>
            toast.info("BNA re-run queued", {
              description:
                "Wired to /api/bna once Supabase + integrations land. Currently mock.",
            })
          }
        >
          <RefreshCw className="h-3 w-3" />
          Re-run
        </Button>
      </header>

      <div className="space-y-2 p-3">
        {items.map((it) => (
          <div key={it.card.id} className="relative">
            {it.pinned ? (
              <div className="absolute -left-1 top-3 z-10">
                <Pin className="h-3 w-3 fill-amber-400 text-amber-400" />
              </div>
            ) : null}
            <ActionCardItem
              card={it.card}
              rank={it.rank}
              whyNowOverride={
                it.suggested_time_block
                  ? `${it.why_now}  •  ${it.suggested_time_block}`
                  : it.why_now
              }
              compact
            />
          </div>
        ))}
      </div>
    </section>
  );
}
