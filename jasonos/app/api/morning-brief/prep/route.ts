// POST /api/morning-brief/prep
// Hydrates attendee enrichment for the Morning Brief Prep sheet. Calls
// LeadDelta for LinkedIn + HubSpot for last-touch CRM history. Both
// integrations return configured:false until wired, in which case the UI
// renders a "not connected" line.

import { NextResponse } from "next/server";
import { z } from "zod";
import { getProfileForAttendee } from "@/lib/integrations/leaddelta";
import { getLastTouch } from "@/lib/integrations/hubspot";

export const runtime = "nodejs";

const Schema = z.object({
  attendees: z
    .array(z.object({ email: z.string().email(), name: z.string().optional() }))
    .max(10),
});

export async function POST(req: Request) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ attendees: [] });
  }
  const parsed = Schema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ attendees: [] });

  const enriched = await Promise.all(
    parsed.data.attendees.map(async (a) => ({
      email: a.email,
      name: a.name,
      linkedin: await getProfileForAttendee(a.email),
      hubspot: await getLastTouch(a.email),
    }))
  );
  return NextResponse.json({ attendees: enriched });
}
