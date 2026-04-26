// GET /api/crunchbase/briefing
// Returns the top ICP-passing funded companies for the Morning Brief.
// Currently powered by mock data (see lib/integrations/crunchbase.ts) — wire
// to the IMAP / Crunchbase Daily API ingestion when ready.

import { NextResponse } from "next/server";
import { getOvernightHits } from "@/lib/integrations/crunchbase";

export const runtime = "nodejs";
export const revalidate = 300;

export async function GET() {
  const result = await getOvernightHits();
  return NextResponse.json({
    hits: result.data,
    configured: result.configured,
    source: result.configured ? "crunchbase" : "mock",
    lastSyncAt: result.lastSyncAt,
  });
}
