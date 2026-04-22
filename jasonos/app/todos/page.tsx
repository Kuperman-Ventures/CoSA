import { MOCK_TODOS } from "@/lib/mock/data";
import { TrackPill } from "@/components/jasonos/track-pill";
import { TRACKS } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { format } from "date-fns";

export const metadata = { title: "To-Dos · JasonOS" };

export default function TodosPage() {
  const grouped = TRACKS.map((t) => ({
    track: t,
    items: MOCK_TODOS.filter((td) => td.track === t),
  }));

  return (
    <div className="mx-auto max-w-[1200px] space-y-4 px-4 py-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">To-Dos</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Manual, plan-step, card-spawned, and auto-extracted to-dos. Default grouping: by track.
          </p>
        </div>
        <Button size="sm" className="gap-2">
          <Plus className="h-3.5 w-3.5" />
          Add to-do
        </Button>
      </header>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {grouped.map(({ track, items }) => (
          <div key={track} className="rounded-xl border bg-card">
            <header className="flex items-center justify-between border-b px-3 py-2">
              <TrackPill track={track} />
              <span className="text-[11px] text-muted-foreground">
                {items.length} open
              </span>
            </header>
            <ul className="divide-y">
              {items.map((t) => (
                <li key={t.id} className="flex items-start gap-3 px-3 py-2.5">
                  <input
                    type="checkbox"
                    className="mt-1 h-3.5 w-3.5 rounded border-border bg-transparent"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{t.title}</div>
                    {t.notes ? (
                      <div className="mt-0.5 text-[11px] text-muted-foreground">{t.notes}</div>
                    ) : null}
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      {t.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                        >
                          {tag}
                        </span>
                      ))}
                      <span className="text-[10px] text-muted-foreground">
                        · {t.source_type?.replaceAll("_", " ")}
                      </span>
                    </div>
                  </div>
                  {t.due_date ? (
                    <span className="num-mono whitespace-nowrap text-[11px] text-muted-foreground">
                      {format(new Date(t.due_date), "MMM d")}
                    </span>
                  ) : null}
                </li>
              ))}
              {items.length === 0 ? (
                <li className="px-3 py-6 text-center text-[11px] text-muted-foreground">
                  Nothing here.
                </li>
              ) : null}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
