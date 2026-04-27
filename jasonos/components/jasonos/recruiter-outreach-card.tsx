"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Props {
  stats: {
    total: number;
    sent: number;
    replied: number;
    queueRemaining: number;
    nextThreeNames: string[];
  };
}

export function RecruiterOutreachCard({ stats }: Props) {
  const safeStats = {
    total: stats?.total ?? 0,
    sent: stats?.sent ?? 0,
    replied: stats?.replied ?? 0,
    queueRemaining: stats?.queueRemaining ?? 0,
    nextThreeNames: Array.isArray(stats?.nextThreeNames) ? stats.nextThreeNames : [],
  };

  if (safeStats.total === 0) {
    return (
      <Card size="sm" className="border-dashed">
        <CardContent>
          <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Recruiter outreach
          </div>
          <div className="mt-1 text-sm text-muted-foreground">
            No priority targets yet. Triage recruiters at /reconnect.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/70 bg-card/80">
      <CardContent className="space-y-2 p-4">
        <div className="flex items-baseline justify-between">
          <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Recruiter outreach
          </div>
          <Link href="/reconnect" className="text-xs text-muted-foreground hover:text-foreground">
            Open <ArrowRight className="inline h-3 w-3" />
          </Link>
        </div>

        <div className="text-sm">
          <span className="font-semibold">{safeStats.sent}</span> sent ·{" "}
          <span className="font-semibold">{safeStats.replied}</span> replied ·{" "}
          <span className="font-semibold">{safeStats.queueRemaining}</span> in queue
        </div>

        {safeStats.nextThreeNames.length > 0 ? (
          <div className="rounded-md border bg-background/30 p-2 text-xs">
            <div className="mb-1 uppercase tracking-wider text-muted-foreground">
              Send today:
            </div>
            {safeStats.nextThreeNames.map((name) => (
              <div key={name}>{name}</div>
            ))}
          </div>
        ) : null}

        <Button size="sm" className="w-full" render={<Link href="/reconnect?intent=triaged_ready" />}>
          Send 3 today
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </CardContent>
    </Card>
  );
}
