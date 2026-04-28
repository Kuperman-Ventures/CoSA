"use server";

import { revalidatePath } from "next/cache";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { createPublicServiceRoleClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CommChannel = "email" | "linkedin" | "phone" | "meeting" | "other";
export type CommUrgency = "sent_today" | "due_today" | "this_week" | "needs_scheduling";

export interface CommTouch {
  id: string;
  channel: CommChannel;
  direction: "inbound" | "outbound";
  touched_at: string;
  brief: string | null;
}

export interface CommPeer {
  id: string;
  name: string;
  title: string | null;
  firm: string | null;
}

export interface CommunicationsContact {
  id: string;
  name: string;
  title: string | null;
  firm: string | null;
  strength: number; // 1–4 normalised from strategic_score
  urgency: CommUrgency;
  lastTouch: CommTouch | null;
  recentTouches: CommTouch[];
  nextActionDueDate: string | null;
  summaryOfPriorComms: string | null;
  peers: CommPeer[];
  hubspot_url: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeStrength(score: number | null): number {
  if (!score) return 1;
  if (score >= 75) return 4;
  if (score >= 50) return 3;
  if (score >= 25) return 2;
  return 1;
}

function toCommChannel(raw: string | null | undefined): CommChannel {
  const map: Record<string, CommChannel> = {
    email: "email",
    linkedin: "linkedin",
    phone: "phone",
    meeting: "meeting",
    zoom: "meeting",
    call: "phone",
  };
  return map[raw?.toLowerCase() ?? ""] ?? "other";
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(base: Date, n: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
}

function computeUrgency(
  nextActionDueDate: string | null,
  contactedToday: boolean,
): CommUrgency {
  if (contactedToday) return "sent_today";

  if (!nextActionDueDate) return "needs_scheduling";

  const today = startOfToday();
  const due = new Date(nextActionDueDate);
  due.setHours(0, 0, 0, 0);
  const diffDays = (due.getTime() - today.getTime()) / 86_400_000;

  if (diffDays <= 0) return "due_today";
  if (diffDays <= 7) return "this_week";
  return "needs_scheduling";
}

// ---------------------------------------------------------------------------
// Main query
// ---------------------------------------------------------------------------

export async function getCommunicationsData(): Promise<CommunicationsContact[]> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return [];

  try {
    const sb = createPublicServiceRoleClient();

    const { data: recruiters, error } = await sb
      .from("rr_recruiters")
      .select(
        "id,name,firm,title,strategic_score,last_contact_date,summary_of_prior_comms,hubspot_url"
      )
      .order("strategic_score", { ascending: false });

    if (error || !recruiters?.length) return [];

    const ids = recruiters.map((r) => r.id as string);
    const today = startOfToday();
    const ninetyDaysAgo = addDays(today, -90);

    const [{ data: states }, { data: touches }] = await Promise.all([
      sb
        .from("rr_contact_state")
        .select("contact_id,status,next_action_due_date")
        .in("contact_id", ids),
      sb
        .from("rr_touches")
        .select("id,contact_id,channel,direction,touched_at,brief")
        .in("contact_id", ids)
        .gte("touched_at", ninetyDaysAgo.toISOString())
        .order("touched_at", { ascending: false }),
    ]);

    const stateMap = new Map(
      (states ?? []).map((s) => [s.contact_id as string, s])
    );

    const touchesByContact = new Map<string, NonNullable<typeof touches>>();
    for (const t of touches ?? []) {
      const arr = touchesByContact.get(t.contact_id as string) ?? [];
      arr.push(t);
      touchesByContact.set(t.contact_id as string, arr);
    }

    // Build peer map by firm
    const firmMap = new Map<string, typeof recruiters>();
    for (const r of recruiters) {
      if (!r.firm) continue;
      const arr = firmMap.get(r.firm as string) ?? [];
      arr.push(r);
      firmMap.set(r.firm as string, arr);
    }

    return recruiters
      .filter((r) => stateMap.get(r.id as string)?.status !== "dismissed")
      .map((r) => {
        const state = stateMap.get(r.id as string) ?? null;
        const contactTouches = touchesByContact.get(r.id as string) ?? [];

        const contactedToday = contactTouches.some(
          (t) =>
            t.direction === "outbound" && new Date(t.touched_at as string) >= today
        );

        const lastTouchRaw = contactTouches[0] ?? null;
        const lastTouch: CommTouch | null = lastTouchRaw
          ? {
              id: lastTouchRaw.id as string,
              channel: toCommChannel(lastTouchRaw.channel as string),
              direction: (lastTouchRaw.direction ?? "outbound") as "inbound" | "outbound",
              touched_at: lastTouchRaw.touched_at as string,
              brief: (lastTouchRaw.brief as string) ?? null,
            }
          : null;

        const recentTouches: CommTouch[] = contactTouches.slice(0, 5).map((t) => ({
          id: t.id as string,
          channel: toCommChannel(t.channel as string),
          direction: (t.direction ?? "outbound") as "inbound" | "outbound",
          touched_at: t.touched_at as string,
          brief: (t.brief as string) ?? null,
        }));

        const peers: CommPeer[] = (firmMap.get(r.firm as string) ?? [])
          .filter((p) => p.id !== r.id)
          .slice(0, 5)
          .map((p) => ({
            id: p.id as string,
            name: p.name as string,
            title: (p.title as string) ?? null,
            firm: (p.firm as string) ?? null,
          }));

        return {
          id: r.id as string,
          name: r.name as string,
          title: (r.title as string) ?? null,
          firm: (r.firm as string) ?? null,
          strength: normalizeStrength(r.strategic_score as number | null),
          urgency: computeUrgency(
            (state?.next_action_due_date as string) ?? null,
            contactedToday
          ),
          lastTouch,
          recentTouches,
          nextActionDueDate: (state?.next_action_due_date as string) ?? null,
          summaryOfPriorComms: (r.summary_of_prior_comms as string) ?? null,
          peers,
          hubspot_url: (r.hubspot_url as string) ?? null,
        };
      });
  } catch (err) {
    console.error("[communications] getCommunicationsData failed", err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Post a Dispatch (Claude Cowork) request — service-role bypass so the
// Communications page works without requiring Supabase auth session.
// ---------------------------------------------------------------------------

export async function postDispatchRequest(input: {
  requestType: string;
  context: Record<string, unknown>;
  sourcePage: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { ok: false, error: "supabase_not_configured" };
  }

  try {
    // Need the admin client (service role) to both list users and bypass RLS.
    const admin = createSupabaseAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    // Single-user app: find the first user in auth.users to use as owner_id.
    const { data: users, error: usersError } = await admin.auth.admin.listUsers({ perPage: 1 });
    if (usersError || !users?.users?.length) {
      return { ok: false, error: "no_user_found — make sure at least one user exists in Supabase Auth" };
    }
    const ownerId = users.users[0].id;

    const { error } = await admin.from("dispatch_requests").insert({
      owner_id: ownerId,
      request_type: input.requestType,
      context: input.context,
      source_page: input.sourcePage,
    });

    if (error) {
      console.error("[communications] dispatch insert failed", error);
      return { ok: false, error: error.message };
    }

    return { ok: true };
  } catch (err) {
    console.error("[communications] postDispatchRequest failed", err);
    return { ok: false, error: String(err) };
  }
}

// ---------------------------------------------------------------------------
// Dismiss contact
// ---------------------------------------------------------------------------

export async function dismissCommunicationContact(contactId: string): Promise<void> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  const sb = createPublicServiceRoleClient();
  await sb.from("rr_contact_state").upsert(
    {
      contact_id: contactId,
      status: "dismissed",
      status_updated_at: new Date().toISOString(),
    },
    { onConflict: "contact_id" }
  );
  revalidatePath("/communications");
}

// ---------------------------------------------------------------------------
// Schedule next touch
// ---------------------------------------------------------------------------

type ScheduleOption =
  | "asap"
  | "next_week"
  | "2_weeks"
  | "1_month"
  | "3_months"
  | "custom";

function dueDateFromOption(option: ScheduleOption, customDate?: string): string {
  const today = startOfToday();
  switch (option) {
    case "asap":
      return today.toISOString().split("T")[0];
    case "next_week":
      return addDays(today, 7).toISOString().split("T")[0];
    case "2_weeks":
      return addDays(today, 14).toISOString().split("T")[0];
    case "1_month":
      return addDays(today, 30).toISOString().split("T")[0];
    case "3_months":
      return addDays(today, 90).toISOString().split("T")[0];
    case "custom":
      return customDate ?? addDays(today, 14).toISOString().split("T")[0];
  }
}

export async function scheduleNextTouch(
  contactId: string,
  option: ScheduleOption,
  customDate?: string
): Promise<void> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  const sb = createPublicServiceRoleClient();
  const dueDate = dueDateFromOption(option, customDate);
  await sb.from("rr_contact_state").upsert(
    {
      contact_id: contactId,
      next_action_due_date: dueDate,
      status_updated_at: new Date().toISOString(),
    },
    { onConflict: "contact_id" }
  );
  revalidatePath("/communications");
}
