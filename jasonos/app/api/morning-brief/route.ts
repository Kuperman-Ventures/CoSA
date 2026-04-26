// GET /api/morning-brief
// Bundles every section of the Morning Brief into a single fetch so the UI
// can render in one render-pass with one network hop. Each integration's
// configured-state is preserved alongside its data so the UI can label
// "live" vs "mock" inline.

import { NextResponse } from "next/server";
import { getOvernightReplies } from "@/lib/integrations/gmail";
import { getInstantlyOvernight } from "@/lib/integrations/instantly";
import { getOvernightGranola } from "@/lib/integrations/granola";
import { getOvernightFireflies } from "@/lib/integrations/fireflies";
import { getTodaysCalendar } from "@/lib/integrations/google-calendar";
import { getOvernightHits } from "@/lib/integrations/crunchbase";

export const runtime = "nodejs";
export const revalidate = 60;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const tz = url.searchParams.get("tz") ?? "America/New_York";

  const sinceIso = new Date(Date.now() - 14 * 3600_000).toISOString();

  const [emails, instantly, granola, fireflies, calendar, hits] = await Promise.all([
    getOvernightReplies({ sinceIso }),
    getInstantlyOvernight(),
    getOvernightGranola(),
    getOvernightFireflies(),
    getTodaysCalendar({ tz }),
    getOvernightHits(),
  ]);

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    tz,
    overnight: {
      gmail: emails,
      instantly,
      granola,
      fireflies,
    },
    calendar,
    icpHits: hits,
  });
}
