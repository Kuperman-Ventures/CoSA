"use server";

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { Intent, UntriagedReconnectCard } from "@/lib/triage/types";

type ActionResult = { ok: true } | { ok: false; error: string };

export async function setContactTriage(input: {
  contactId: string;
  intent: Intent | null;
  personalGoal: string | null;
}): Promise<ActionResult> {
  if (!hasSupabaseConfig()) {
    return { ok: false, error: "Supabase service role env vars are not configured." };
  }

  const supabase = createServiceRoleClient();
  const triagedAt = new Date().toISOString();

  const { error: updateErr } = await supabase
    .from("contacts")
    .update({
      intent: input.intent,
      personal_goal: input.personalGoal,
      updated_at: triagedAt,
    })
    .eq("id", input.contactId);

  if (updateErr) return { ok: false, error: updateErr.message };

  const { error: artifactErr } = await supabase.from("runner_artifacts").insert({
    runner_id: "triage",
    task_id: "contact_triage",
    schema_version: "v1",
    payload: {
      contact_id: input.contactId,
      intent: input.intent,
      personal_goal: input.personalGoal,
      triaged_at: triagedAt,
    },
  });

  if (artifactErr) return { ok: false, error: artifactErr.message };

  revalidatePath("/runner/triage");
  revalidatePath("/reconnect");
  return { ok: true };
}

/**
 * Returns the next un-triaged reconnect card, ordered by priority. Skipped
 * contacts are excluded only for this browser session via the route query.
 */
export async function getNextUntriagedCard(
  skippedContactIds: string[] = []
): Promise<UntriagedReconnectCard | null> {
  if (!hasSupabaseConfig()) return null;

  const supabase = createServiceRoleClient();
  const skipped = new Set(skippedContactIds.filter(Boolean));

  const { data, error } = await supabase.rpc("next_untriaged_reconnect_card");
  if (error) {
    console.error("[triage] getNextUntriagedCard error", error);
    return null;
  }

  const rpcCard = normalizeCard(Array.isArray(data) ? data[0] : data);
  if (!rpcCard || !skipped.has(rpcCard.contact_id)) return rpcCard;

  return getNextUntriagedCardAfterSkips(skipped, rpcCard.remaining_count);
}

export async function getUntriagedReconnectCount(): Promise<number> {
  if (!hasSupabaseConfig()) return 0;

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.rpc("next_untriaged_reconnect_card");
  if (error) {
    console.error("[triage] getUntriagedReconnectCount error", error);
    return 0;
  }

  const row = Array.isArray(data) ? data[0] : data;
  return Number(row?.remaining_count ?? 0);
}

async function getNextUntriagedCardAfterSkips(
  skipped: Set<string>,
  totalRemaining: number
): Promise<UntriagedReconnectCard | null> {
  if (!hasSupabaseConfig()) return null;

  const supabase = createServiceRoleClient();
  const { data: cards, error: cardsError } = await supabase
    .from("cards")
    .select("id,title,subtitle,body,priority_score,linked_object_ids")
    .eq("module", "reconnect")
    .eq("state", "open")
    .order("priority_score", { ascending: false, nullsFirst: false })
    .limit(50);

  if (cardsError || !cards?.length) {
    if (cardsError) console.error("[triage] fallback cards error", cardsError);
    return null;
  }

  const cardRows = cards
    .map((card) => {
      const contactId = getLinkedContactId(card.linked_object_ids);
      return contactId ? { ...card, contact_id: contactId } : null;
    })
    .filter((card): card is NonNullable<typeof card> => !!card && !skipped.has(card.contact_id));

  const contactIds = cardRows.map((card) => card.contact_id);
  if (!contactIds.length) return null;

  const { data: contacts, error: contactsError } = await supabase
    .from("contacts")
    .select("id,name,title,tags,intent,personal_goal")
    .in("id", contactIds)
    .is("intent", null);

  if (contactsError || !contacts?.length) {
    if (contactsError) console.error("[triage] fallback contacts error", contactsError);
    return null;
  }

  const contactsById = new Map(contacts.map((contact) => [contact.id, contact]));
  const card = cardRows.find((row) => contactsById.has(row.contact_id));
  if (!card) return null;

  const contact = contactsById.get(card.contact_id);
  return normalizeCard({
    card_id: card.id,
    contact_id: card.contact_id,
    title: card.title,
    subtitle: card.subtitle,
    body: card.body,
    priority_score: card.priority_score,
    contact_name: contact?.name,
    contact_title: contact?.title,
    contact_tags: contact?.tags,
    current_intent: contact?.intent,
    current_goal: contact?.personal_goal,
    remaining_count: Math.max(totalRemaining - skipped.size, 1),
  });
}

function hasSupabaseConfig() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

function getLinkedContactId(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const contactId = (value as { contact_id?: unknown }).contact_id;
  return typeof contactId === "string" ? contactId : null;
}

function normalizeCard(row: unknown): UntriagedReconnectCard | null {
  if (!row || typeof row !== "object") return null;
  const value = row as Record<string, unknown>;
  const contactId = value.contact_id;
  const cardId = value.card_id;
  const contactName = value.contact_name;

  if (
    typeof contactId !== "string" ||
    typeof cardId !== "string" ||
    typeof contactName !== "string"
  ) {
    return null;
  }

  return {
    card_id: cardId,
    contact_id: contactId,
    title: typeof value.title === "string" ? value.title : contactName,
    subtitle: typeof value.subtitle === "string" ? value.subtitle : null,
    body:
      value.body && typeof value.body === "object"
        ? (value.body as Record<string, unknown>)
        : null,
    priority_score:
      typeof value.priority_score === "number" ? value.priority_score : null,
    contact_name: contactName,
    contact_title:
      typeof value.contact_title === "string" ? value.contact_title : null,
    contact_tags: Array.isArray(value.contact_tags)
      ? value.contact_tags.filter((tag): tag is string => typeof tag === "string")
      : [],
    current_intent: isIntent(value.current_intent) ? value.current_intent : null,
    current_goal: typeof value.current_goal === "string" ? value.current_goal : null,
    remaining_count:
      typeof value.remaining_count === "number" ? value.remaining_count : 0,
  };
}

function isIntent(value: unknown): value is Intent {
  return (
    value === "warm" ||
    value === "intel" ||
    value === "door" ||
    value === "pipeline" ||
    value === "role_inquiry"
  );
}
