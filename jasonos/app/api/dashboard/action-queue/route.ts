import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { Track } from "@/lib/types";

export const dynamic = "force-dynamic";

const TRACKS = new Set<Track>(["venture", "advisors", "job_search", "personal"]);

export async function GET(request: Request) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ cards: [], configured: false });
  }

  try {
    const url = new URL(request.url);
    const track = url.searchParams.get("track");
    const sb = createServiceRoleClient();
    let query = sb
      .from("cards")
      .select("*")
      .eq("state", "open")
      .order("priority_score", { ascending: false, nullsFirst: false })
      .limit(50);

    if (track && TRACKS.has(track as Track)) {
      query = query.eq("track", track);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ cards: data ?? [], configured: true });
  } catch (error) {
    console.error("[dashboard] action queue query failed", error);
    return NextResponse.json({ cards: [], configured: true });
  }
}
