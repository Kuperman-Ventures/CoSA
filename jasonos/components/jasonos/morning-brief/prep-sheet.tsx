"use client";

import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import type { CalendarEvent } from "@/lib/integrations/google-calendar";
import type { HubspotLastTouch } from "@/lib/integrations/hubspot";
import type { LinkedInProfile } from "@/lib/integrations/leaddelta";
import type { IntegrationResult } from "@/lib/integrations/_base";
import { format } from "date-fns";

interface PrepData {
  attendees: {
    email: string;
    name?: string;
    linkedin: IntegrationResult<LinkedInProfile | null>;
    hubspot: IntegrationResult<HubspotLastTouch | null>;
  }[];
}

export function PrepSheet({
  event,
  open,
  onOpenChange,
}: {
  event: CalendarEvent | null;
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) {
  const [data, setData] = useState<PrepData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!event || !open) return;
    setData(null);
    setLoading(true);
    const externalAttendees = event.attendees.filter((a) => !a.isMe).slice(0, 5);
    fetch(`/api/morning-brief/prep`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attendees: externalAttendees.map((a) => ({ email: a.email, name: a.name })) }),
    })
      .then((r) => r.json())
      .then((j: PrepData) => setData(j))
      .catch(() => setData({ attendees: [] }))
      .finally(() => setLoading(false));
  }, [event, open]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{event?.title ?? "Meeting prep"}</SheetTitle>
          <SheetDescription>
            {event ? (
              <>
                {format(new Date(event.startsAt), "EEE MMM d · h:mm a")} – {format(new Date(event.endsAt), "h:mm a")}
                {event.attendees.length ? ` · ${event.attendees.length} attendees` : null}
              </>
            ) : null}
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-3 px-4 pb-4">
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : null}
          {!loading && data?.attendees.length === 0 ? (
            <div className="rounded-md border bg-muted/30 px-3 py-4 text-center text-xs text-muted-foreground">
              No external attendees to enrich.
            </div>
          ) : null}
          {!loading
            ? data?.attendees.map((a) => (
                <div key={a.email} className="rounded-md border bg-card p-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-sm font-medium">{a.name ?? a.email}</p>
                    <span className="text-[10px] text-muted-foreground">{a.email}</span>
                  </div>
                  <div className="mt-2 grid gap-2 text-[11px]">
                    <PrepLine
                      label="LinkedIn"
                      configured={a.linkedin.configured}
                      value={
                        a.linkedin.data
                          ? `${a.linkedin.data.headline ?? ""} ${a.linkedin.data.company ? "· " + a.linkedin.data.company : ""}`.trim() ||
                            a.linkedin.data.linkedinUrl
                          : undefined
                      }
                    />
                    <PrepLine
                      label="HubSpot last touch"
                      configured={a.hubspot.configured}
                      value={
                        a.hubspot.data
                          ? [
                              a.hubspot.data.lastActivityType,
                              a.hubspot.data.lastActivityAt
                                ? format(new Date(a.hubspot.data.lastActivityAt), "MMM d")
                                : undefined,
                              a.hubspot.data.dealStage ? `· ${a.hubspot.data.dealStage}` : undefined,
                            ]
                              .filter(Boolean)
                              .join(" · ")
                          : undefined
                      }
                    />
                  </div>
                </div>
              ))
            : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function PrepLine({
  label,
  configured,
  value,
}: {
  label: string;
  configured: boolean;
  value?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</span>
      <span className="text-right text-[11px] text-foreground">
        {!configured ? (
          <span className="text-muted-foreground">not connected</span>
        ) : value ? (
          value
        ) : (
          <span className="text-muted-foreground">no record</span>
        )}
      </span>
    </div>
  );
}
