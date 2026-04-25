import { ArrowDownLeft, ArrowUpRight, NotebookPen } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { RecruiterNote, RecruiterTouch } from "@/lib/reconnect/types";

type Entry =
  | (RecruiterNote & { kind: "note" })
  | (RecruiterTouch & { kind: "touch" });

export function NotesTimeline({
  notes,
  touches,
}: {
  notes: RecruiterNote[];
  touches: RecruiterTouch[];
}) {
  const entries: Entry[] = [
    ...notes.map((n) => ({ ...n, kind: "note" as const })),
    ...touches.map((t) => ({ ...t, kind: "touch" as const })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  if (entries.length === 0) {
    return <p className="text-xs text-muted-foreground">No notes or touches logged yet.</p>;
  }

  return (
    <div className="space-y-2">
      {entries.map((entry) => {
        const isTouch = entry.kind === "touch";
        const Icon = !isTouch
          ? NotebookPen
          : entry.direction === "inbound"
          ? ArrowDownLeft
          : ArrowUpRight;
        return (
          <div key={`${entry.kind}-${entry.id}`} className="rounded-lg border bg-background/40 p-3">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
              <Icon className="h-3.5 w-3.5" />
              <span>
                {isTouch ? `${entry.direction} · ${entry.channel}` : "Note"}
              </span>
              <span className="ml-auto normal-case tracking-normal">
                {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
              </span>
            </div>
            <p className="mt-1 text-sm leading-relaxed text-foreground/90">{entry.body}</p>
          </div>
        );
      })}
    </div>
  );
}
