import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { ActionCard, BestNextActionItem } from "@/lib/types";

export const dynamic = "force-dynamic";

interface BnaRunRow {
  items: BestNextActionItem[] | null;
}

export async function GET() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ items: [], configured: false });
  }

  try {
    const sb = createServiceRoleClient();
    const { data: run, error: runError } = await sb
      .from("bna_runs")
      .select("items")
      .order("run_at", { ascending: false })
      .limit(1)
      .maybeSingle<BnaRunRow>();

    if (runError || !run?.items?.length) {
      return NextResponse.json({ items: [], configured: true });
    }

    const cardIds = run.items.map((item) => item.card_id).filter(Boolean);
    if (!cardIds.length) return NextResponse.json({ items: [], configured: true });

    const { data: cards, error: cardsError } = await sb
      .from("cards")
      .select("*")
      .in("id", cardIds);

    if (cardsError || !cards?.length) {
      return NextResponse.json({ items: [], configured: true });
    }

    const cardsById = new Map((cards as ActionCard[]).map((card) => [card.id, card]));
    const items = run.items
      .map((item) => {
        const card = cardsById.get(item.card_id);
        return card ? { ...item, card } : null;
      })
      .filter(Boolean);

    return NextResponse.json({ items, configured: true });
  } catch (error) {
    console.error("[dashboard] must-dos query failed", error);
    return NextResponse.json({ items: [], configured: true });
  }
}
