import { Card, CardContent } from "@/components/ui/card";
import type { ReconnectStats } from "@/lib/reconnect/types";

const STATS = [
  ["toActOn", "To act on", "Tier 1 + 2 in queue"],
  ["outreachThisWeek", "Outreach this week", "Outbound touches, 7d"],
  ["repliesThisWeek", "Replies this week", "Inbound or replied, 7d"],
  ["awaitingResponse", "Awaiting response", "Sent >7d"],
] as const;

export function ReconnectStatsStrip({ stats }: { stats: ReconnectStats }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {STATS.map(([key, label, helper]) => (
        <Card key={key} size="sm" className="border-border/70 bg-card/80">
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
