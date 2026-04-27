// Server-only data layer for the /contacts Tier 1 Ranker.
// Phase 1 convention: service-role client only. JasonOS has no auth flow yet,
// and RLS on these tables is "to authenticated", so the anon/browser client
// would be blocked. Server actions and server components both run in trusted
// space, so service-role is safe here. Swap to authenticated client when
// auth lands.

import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { ActionCard, Contact, ContactScore } from "@/lib/types";
import {
  DEFAULT_RUNNER_STATE,
  type RankableContact,
  type RunnerStateShape,
} from "@/lib/contacts/runner";

// ---- Configuration check --------------------------------------------------
// Mirrors the Stripe / Lemon Squeezy "configured" pattern so the page renders
// gracefully (empty + setup hint) instead of throwing when env vars are missing.

export function isContactsConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

// ---- Reads ----------------------------------------------------------------

export async function listContactsWithScores(): Promise<RankableContact[]> {
  if (!isContactsConfigured()) return [];

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("contacts")
    .select(
      `
      id, name, emails, linkedin_url, title, company_id, vip, tracks, tags,
      source_ids, last_touch_date, last_touch_channel, objective_result, notes,
      company:companies (
        id, name
      ),
      contact_scores (
        id, contact_id, recency, seniority, fit, scored_by, notes,
        created_at, updated_at
      )
    `
    )
    .order("name", { ascending: true });

  if (error) {
    console.error("[contacts.listContactsWithScores]", error);
    return [];
  }

  return (data ?? []).map((row) => {
    const { contact_scores, ...rest } = row as Record<string, unknown> & {
      contact_scores: ContactScore[] | ContactScore | null;
    };
    const scoreRow = Array.isArray(contact_scores)
      ? contact_scores[0] ?? null
      : contact_scores ?? null;
    return {
      contact: rest as unknown as Contact,
      score: scoreRow,
    };
  });
}

export async function getRunnerState(
  runnerId: string,
  taskId: string
): Promise<RunnerStateShape> {
  if (!isContactsConfigured()) return DEFAULT_RUNNER_STATE;

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("runner_state")
    .select("state")
    .eq("runner_id", runnerId)
    .eq("task_id", taskId)
    .maybeSingle();

  if (error) {
    console.error("[contacts.getRunnerState]", error);
    return DEFAULT_RUNNER_STATE;
  }

  const persisted = (data?.state ?? null) as Partial<RunnerStateShape> | null;
  if (!persisted) return DEFAULT_RUNNER_STATE;

  return {
    weights: { ...DEFAULT_RUNNER_STATE.weights, ...(persisted.weights ?? {}) },
    strategy: persisted.strategy ?? DEFAULT_RUNNER_STATE.strategy,
  };
}

export async function getExistingTier1Cards(): Promise<ActionCard[]> {
  if (!isContactsConfigured()) return [];

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("cards")
    .select("*")
    .eq("module", "reconnect")
    .eq("object_type", "tier1_contact")
    .eq("state", "open")
    .order("priority_score", { ascending: false });

  if (error) {
    console.error("[contacts.getExistingTier1Cards]", error);
    return [];
  }
  return (data ?? []) as ActionCard[];
}
