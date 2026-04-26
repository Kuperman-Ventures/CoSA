"use client";

import { useEffect, useState, useCallback } from "react";
import type { GmailReply } from "@/lib/integrations/gmail";
import type { InstantlyMetrics } from "@/lib/integrations/instantly";
import type { GranolaMeeting } from "@/lib/integrations/granola";
import type { FirefliesMeeting } from "@/lib/integrations/fireflies";
import type { CalendarEvent } from "@/lib/integrations/google-calendar";
import type { CrunchbaseHit } from "@/lib/integrations/crunchbase";
import type { IntegrationResult } from "@/lib/integrations/_base";

export interface MorningBriefPayload {
  generatedAt: string;
  tz: string;
  overnight: {
    gmail: IntegrationResult<GmailReply[]>;
    instantly: IntegrationResult<InstantlyMetrics>;
    granola: IntegrationResult<GranolaMeeting[]>;
    fireflies: IntegrationResult<FirefliesMeeting[]>;
  };
  calendar: IntegrationResult<CalendarEvent[]>;
  icpHits: IntegrationResult<CrunchbaseHit[]>;
}

type State =
  | { status: "loading"; data?: undefined; error?: undefined }
  | { status: "ready"; data: MorningBriefPayload; error?: undefined }
  | { status: "error"; data?: undefined; error: string };

function localTz(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "America/New_York";
  }
}

export function useMorningBrief(): State & {
  refresh: () => Promise<void>;
  removeIcpHit: (id: string) => void;
} {
  const [state, setState] = useState<State>({ status: "loading" });

  const load = useCallback(async () => {
    try {
      const tz = localTz();
      const res = await fetch(`/api/morning-brief?tz=${encodeURIComponent(tz)}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const payload = (await res.json()) as MorningBriefPayload;
      setState({ status: "ready", data: payload });
    } catch (err) {
      setState({
        status: "error",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const removeIcpHit = useCallback((id: string) => {
    setState((s) => {
      if (s.status !== "ready") return s;
      const next = {
        ...s.data,
        icpHits: {
          ...s.data.icpHits,
          data: s.data.icpHits.data.filter((h) => h.id !== id),
        },
      } as MorningBriefPayload;
      return { status: "ready", data: next };
    });
  }, []);

  return { ...state, refresh: load, removeIcpHit };
}
