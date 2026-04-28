"use server";

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { ActionCard } from "@/lib/types";

export async function pinCardToToday(cardId: string) {
  const sb = createServiceRoleClient();
  const { error } = await sb
    .from("cards")
    .update({ pinned_at: new Date().toISOString() })
    .eq("id", cardId);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/");
  revalidatePath("/reconnect");
  return { ok: true as const };
}

export async function unpinCard(cardId: string) {
  const sb = createServiceRoleClient();
  const { error } = await sb
    .from("cards")
    .update({ pinned_at: null })
    .eq("id", cardId);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/");
  revalidatePath("/reconnect");
  return { ok: true as const };
}

/**
 * Returns cards pinned with pinned_at::date = current_date. Cards pinned
 * yesterday automatically drop off without manual cleanup.
 */
export async function getPinnedTodayCards(): Promise<ActionCard[]> {
  const sb = createServiceRoleClient();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data, error } = await sb
    .from("cards")
    .select("*")
    .not("pinned_at", "is", null)
    .gte("pinned_at", todayStart.toISOString())
    .eq("state", "open")
    .order("pinned_at", { ascending: false });

  if (error || !data) return [];
  return data as ActionCard[];
}
