import { Card, CardContent } from "@/components/ui/card";
import type { ReconnectStats } from "@/lib/reconnect/types";

const STATS = [
  ["toActOn", "To act on", "Tier 1 + 2 in queue"],
  ["outreachThisWeek", "Outreach this week", "Outbound touches, 7d"],
  ["repliesThisWeek", "Replies this week", "Inbound or replied, 7d"],
  ["awaitingResponse", "Awaiting response", "Sent >7d"],
  ["triagedReady", "Triaged ready", "Intent set, not sent"],
] as const;

export function ReconnectStatsStrip({
  stats,
  onTriagedReadyClick,
  triagedReadyActive,
}: {
  stats: ReconnectStats;
  onTriagedReadyClick?: () => void;
  triagedReadyActive?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      {STATS.map(([key, label, helper]) => (
        <Card
          key={key}
          size="sm"
          className={`border-border/70 bg-card/80 ${
            key === "triagedReady" && onTriagedReadyClick
              ? "cursor-pointer transition-colors hover:border-foreground/40 hover:bg-muted/20"
              : ""
          } ${key === "triagedReady" && triagedReadyActive ? "border-foreground/70" : ""}`}
          onClick={key === "triagedReady" ? onTriagedReadyClick : undefined}
          role={key === "triagedReady" && onTriagedReadyClick ? "button" : undefined}
          tabIndex={key === "triagedReady" && onTriagedReadyClick ? 0 : undefined}
          onKeyDown={
            key === "triagedReady" && onTriagedReadyClick
              ? (event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onTriagedReadyClick();
                  }
                }
              : undefined
          }
        >
          <CardContent className="space-y-1">
            <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {label}
            </div>
            <div className="num-mono text-2xl font-semibold tracking-tight">
              {stats[key]}
            </div>
            <div className="text-[11px] text-muted-foreground">{helper}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
