// Google Calendar adapter — today's events for the Morning Brief.
// Uses the same Google OAuth refresh token as gmail.ts.

import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { emptyResult, envConfigured, type IntegrationResult } from "./_base";

export interface CalendarEvent {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  attendees: { email: string; name?: string; isOrganizer?: boolean; isMe?: boolean }[];
  conferenceUrl?: string;
  location?: string;
  notes?: string;
}

const CAL_BASE = "https://www.googleapis.com/calendar/v3";

async function loadAccessToken(): Promise<string | null> {
  if (!envConfigured("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY")) {
    return null;
  }
  try {
    const sb = createServiceRoleClient();
    const { data } = await sb
      .from("user_integrations")
      .select("access_token, refresh_token, expires_at")
      .eq("provider", "google")
      .maybeSingle();
    if (!data) return null;
    if (
      data.access_token &&
      data.expires_at &&
      Date.parse(data.expires_at) - Date.now() > 60_000
    )
      return data.access_token;
    if (data.refresh_token) {
      const cid = process.env.GOOGLE_CLIENT_ID;
      const cs = process.env.GOOGLE_CLIENT_SECRET;
      if (!cid || !cs) return data.access_token;
      const res = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: cid,
          client_secret: cs,
          refresh_token: data.refresh_token,
          grant_type: "refresh_token",
        }),
      });
      if (!res.ok) return data.access_token;
      const j = (await res.json()) as { access_token?: string };
      return j.access_token ?? data.access_token;
    }
    return data.access_token;
  } catch {
    return null;
  }
}

interface GCalEvent {
  id: string;
  summary?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  attendees?: { email: string; displayName?: string; organizer?: boolean; self?: boolean }[];
  hangoutLink?: string;
  conferenceData?: { entryPoints?: { uri?: string; entryPointType?: string }[] };
  location?: string;
  description?: string;
}

export async function getTodaysCalendar(opts?: {
  tz?: string;
  calendarId?: string;
}): Promise<IntegrationResult<CalendarEvent[]>> {
  const token = await loadAccessToken();
  if (!token) return emptyResult([], false);

  try {
    const tz = opts?.tz ?? "America/New_York";
    const calendarId = opts?.calendarId ?? "primary";
    // Day window in user's TZ.
    const now = new Date();
    const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
    const ymd = fmt.format(now);
    const dayStart = new Date(`${ymd}T00:00:00`);
    const dayEnd = new Date(`${ymd}T23:59:59`);
    const params = new URLSearchParams({
      timeMin: dayStart.toISOString(),
      timeMax: dayEnd.toISOString(),
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "50",
    });
    const res = await fetch(
      `${CAL_BASE}/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
      { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
    );
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`GCal ${res.status} :: ${txt.slice(0, 200)}`);
    }
    const j = (await res.json()) as { items?: GCalEvent[] };
    const events: CalendarEvent[] = (j.items ?? []).map((e) => ({
      id: e.id,
      title: e.summary ?? "(untitled)",
      startsAt: e.start?.dateTime ?? `${e.start?.date}T00:00:00`,
      endsAt: e.end?.dateTime ?? `${e.end?.date}T23:59:59`,
      attendees: (e.attendees ?? []).map((a) => ({
        email: a.email,
        name: a.displayName,
        isOrganizer: a.organizer,
        isMe: a.self,
      })),
      conferenceUrl:
        e.hangoutLink ??
        e.conferenceData?.entryPoints?.find((p) => p.entryPointType === "video")?.uri,
      location: e.location,
      notes: e.description,
    }));
    return emptyResult(events, true);
  } catch (err) {
    console.error("[gcal] fetch failed:", err);
    return emptyResult([], true, err instanceof Error ? err.message : String(err));
  }
}
