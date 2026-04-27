// GET /api/crunchbase/briefing
// Returns the top ICP-passing funded companies for the Morning Brief.
// Returns empty until the Crunchbase Daily email/API ingestion is configured.

import { NextResponse } from "next/server";
import { getOvernightHits } from "@/lib/integrations/crunchbase";

export const runtime = "nodejs";
export const revalidate = 300;

export async function GET() {
  const result = await getOvernightHits();
  return NextResponse.json({
    hits: result.data,
    configured: result.configured,
    source: "crunchbase",
    lastSyncAt: result.lastSyncAt,
  });
}
