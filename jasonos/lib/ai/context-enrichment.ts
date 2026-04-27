import "server-only";

import { createPublicServiceRoleClient, createServiceRoleClient } from "@/lib/supabase/server";
import {
  gatherGmailHistory,
  gatherHubSpotHistory,
  type ContactContext as DraftContactContext,
} from "@/lib/server-actions/draft-from-history";
import type { TellClaudeContext } from "./tell-claude";

export interface EnrichedContext {
  scope: TellClaudeContext["scope"];
  raw_payload: unknown;
  global_state: GlobalState;
  matched_firms: FirmContext[];
  matched_contacts: ContactContext[];
  unmatched_entities: string[];
  intent_signals: string[];
  data_available: boolean;
  missing_context: string[];
}

export interface GlobalState {
  total_recruiters: number;
  triaged_count: number;
  sent_count: number;
  replied_count: number;
  meeting_count: number;
  active_intents_breakdown: Record<string, number>;
  open_alerts: number;
  current_date: string;
}

export interface FirmContext {
  firm: string;
  contact_count: number;
  contacts: Array<{
    id: string;
    name: string;
    title: string;
    specialty: string;
    strategic_score: number | null;
    intent: string | null;
    personal_goal: string | null;
    last_contact_date: string | null;
    status: string;
    has_replied: boolean;
    prior_context: string | null;
  }>;
  practice_clusters: string[];
}

export interface ContactContext {
  name: string;
  firm: string;
  title: string;
  intent: string | null;
  personal_goal: string | null;
  last_contact_date: string | null;
  strategic_score: number | null;
  status: string;
  recent_activity_summary: string;
}

const EMPTY_GLOBAL_STATE: GlobalState = {
  total_recruiters: 0,
  triaged_count: 0,
  sent_count: 0,
  replied_count: 0,
  meeting_count: 0,
  active_intents_breakdown: {},
  open_alerts: 0,
  current_date: new Date().toISOString().slice(0, 10),
};

const INTENT_KEYWORDS: Record<string, RegExp> = {
  strategy: /\bstrateg(y|ic|ies)\b|\bplan\b|\bapproach\b|\bnext (move|step)/i,
  today: /\btoday\b|\bnow\b|\bthis morning\b|\bright now\b/i,
  this_week: /\bthis week\b|\bweek\b/i,
  priority: /\bpriorit(y|ies|ize|ization)\b|\bmost important\b|\bfocus\b/i,
  outreach: /\boutreach\b|\bsend\b|\bdraft\b|\bemail\b|\bmessage\b|\bdm\b|\blinkedin\b/i,
  firm_level: /\bfirm\b|\bagency\b|\boffice\b|\borganization\b/i,
  reply_status: /\brepl(y|ies|ied)\b|\banswer(ed)?\b|\bback\b|\bhear(d)? from\b/i,
  triage: /\btriage\b|\bintent\b|\bgoal\b|\bsort\b/i,
  decision: /\bshould (i|we)\b|\bwhich\b|\bwho\b|\bbest\b|\bnext\b/i,
  comparison: /\bvs\b|\bversus\b|\bcompare\b|\binstead of\b|\bor\b/i,
};

export async function enrichContext(
  instruction: string,
  uiContext: TellClaudeContext
): Promise<EnrichedContext> {
  const intentSignals = detectIntentSignals(instruction);

  if (!hasSupabaseServiceRole()) {
    return {
      scope: uiContext.scope,
      raw_payload: uiContext.payload,
      global_state: EMPTY_GLOBAL_STATE,
      matched_firms: [],
      matched_contacts: [],
      unmatched_entities: extractPotentialNames(instruction),
      intent_signals: intentSignals,
      data_available: false,
      missing_context: ["Supabase service-role environment variables are not configured."],
    };
  }

  try {
    const [globalState, matchedFirms, matchedContacts] = await Promise.all([
      fetchGlobalState(),
      fetchMatchedFirms(instruction),
      fetchMatchedContacts(instruction),
    ]);

    const matchedNames = new Set([
      ...matchedFirms.flatMap((firm) => firm.contacts.map((contact) => normalizeText(contact.name))),
      ...matchedContacts.map((contact) => normalizeText(contact.name)),
    ]);

    return {
      scope: uiContext.scope,
      raw_payload: uiContext.payload,
      global_state: globalState,
      matched_firms: matchedFirms,
      matched_contacts: matchedContacts,
      unmatched_entities: extractPotentialNames(instruction).filter(
        (name) => !matchedNames.has(normalizeText(name))
      ),
      intent_signals: intentSignals,
      data_available: true,
      missing_context: [],
    };
  } catch (error) {
    return {
      scope: uiContext.scope,
      raw_payload: uiContext.payload,
      global_state: EMPTY_GLOBAL_STATE,
      matched_firms: [],
      matched_contacts: [],
      unmatched_entities: extractPotentialNames(instruction),
      intent_signals: intentSignals,
      data_available: false,
      missing_context: [
        error instanceof Error ? error.message : "Context enrichment failed.",
      ],
    };
  }
}

function detectIntentSignals(instruction: string): string[] {
  return Object.entries(INTENT_KEYWORDS)
    .filter(([, regex]) => regex.test(instruction))
    .map(([key]) => key);
}

async function fetchGlobalState(): Promise<GlobalState> {
  const sb = createServiceRoleClient();
  const sbPublic = createPublicServiceRoleClient();

  const [{ data: contacts }, { data: recruiters }, { data: rrStates }, { data: alerts }] =
    await Promise.all([
      sb.from("contacts").select("id,intent").limit(2000),
      sbPublic.from("rr_recruiters").select("id").limit(2000),
      sbPublic.from("rr_contact_state").select("status"),
      sb.from("alerts").select("id").eq("state", "open").eq("severity", "critical"),
    ]);

  const intentBreakdown: Record<string, number> = {};
  for (const contact of contacts ?? []) {
    const intent = getString(contact.intent);
    if (intent) intentBreakdown[intent] = (intentBreakdown[intent] ?? 0) + 1;
  }

  const statusCounts = (rrStates ?? []).reduce<Record<string, number>>((acc, row) => {
    const status = getString(row.status);
    if (status) acc[status] = (acc[status] ?? 0) + 1;
    return acc;
  }, {});

  return {
    total_recruiters: recruiters?.length ?? contacts?.length ?? 0,
    triaged_count: Object.values(intentBreakdown).reduce((sum, count) => sum + count, 0),
    sent_count: statusCounts.sent ?? 0,
    replied_count: statusCounts.replied ?? 0,
    meeting_count: (statusCounts.in_conversation ?? 0) + (statusCounts.live_role ?? 0),
    active_intents_breakdown: intentBreakdown,
    open_alerts: alerts?.length ?? 0,
    current_date: new Date().toISOString().slice(0, 10),
  };
}

async function fetchMatchedFirms(instruction: string): Promise<FirmContext[]> {
  const sbPublic = createPublicServiceRoleClient();
  const { data: firmRows } = await sbPublic
    .from("rr_recruiters")
    .select("firm,firm_normalized")
    .not("firm", "is", null)
    .limit(2000);

  const firmCandidates = uniqueFirms(
    (firmRows ?? []).map((row) => ({
      firm: getString(row.firm) ?? "",
      firm_normalized: getString(row.firm_normalized) ?? getString(row.firm) ?? "",
    }))
  );

  const instructionKey = normalizeText(instruction);
  const matched = firmCandidates.filter((candidate) => {
    const display = normalizeText(candidate.firm);
    const normalized = normalizeText(candidate.firm_normalized);
    return (
      display.length > 2 &&
      (instructionKey.includes(display) ||
        instructionKey.includes(normalized) ||
        instructionKey.includes(display.replace(/\s+/g, "")))
    );
  });

  const results: FirmContext[] = [];
  for (const firm of matched.slice(0, 3)) {
    const { data: contacts } = await sbPublic
      .from("rr_recruiters")
      .select(
        "id,name,firm,title,specialty,strategic_score,last_contact_date,summary_of_prior_comms,outlook_history,strategic_recommended_approach"
      )
      .or(`firm.eq.${escapeFilterValue(firm.firm)},firm_normalized.eq.${escapeFilterValue(firm.firm_normalized)}`)
      .order("strategic_score", { ascending: false, nullsFirst: false });

    if (!contacts?.length) continue;

    const ids = contacts.map((contact) => getString(contact.id)).filter((id): id is string => !!id);
    const [intentByRrId, statusByRrId] = await Promise.all([
      fetchIntentByRecruiterId(ids),
      fetchStatusByRecruiterId(ids),
    ]);

    results.push({
      firm: firm.firm,
      contact_count: contacts.length,
      contacts: contacts.slice(0, 20).map((contact) => {
        const id = getString(contact.id) ?? "";
        const priorContext =
          getString(contact.outlook_history) ??
          getString(contact.summary_of_prior_comms) ??
          getString(contact.strategic_recommended_approach);
        return {
          id,
          name: getString(contact.name) ?? "Unknown contact",
          title: getString(contact.title) ?? "",
          specialty: getString(contact.specialty) ?? "",
          strategic_score: getNumber(contact.strategic_score),
          intent: intentByRrId.get(id)?.intent ?? null,
          personal_goal: intentByRrId.get(id)?.personal_goal ?? null,
          last_contact_date: getString(contact.last_contact_date),
          status: statusByRrId.get(id) ?? "queue",
          has_replied: Boolean(priorContext),
          prior_context: priorContext ?? null,
        };
      }),
      practice_clusters: Array.from(
        new Set(
          contacts
            .map((contact) => getString(contact.specialty))
            .filter((specialty): specialty is string => Boolean(specialty))
        )
      ),
    });
  }

  return results;
}

async function fetchMatchedContacts(instruction: string): Promise<ContactContext[]> {
  const sb = createServiceRoleClient();
  const sbPublic = createPublicServiceRoleClient();
  const instructionKey = normalizeText(instruction);

  const [{ data: appContacts }, { data: recruiters }] = await Promise.all([
    sb
      .from("contacts")
      .select("id,name,emails,linkedin_url,title,intent,personal_goal,last_touch_date,source_ids,tags")
      .limit(1000),
    sbPublic
      .from("rr_recruiters")
      .select(
        "id,name,firm,title,specialty,strategic_score,last_contact_date,summary_of_prior_comms,outlook_history,strategic_recommended_approach,hubspot_contact_id"
      )
      .limit(2000),
  ]);

  const recruiterMatches = (recruiters ?? []).filter((row) =>
    nameMatchesInstruction(getString(row.name) ?? "", instructionKey)
  );
  const appMatches = (appContacts ?? []).filter((row) =>
    nameMatchesInstruction(getString(row.name) ?? "", instructionKey)
  );

  const statusByRrId = await fetchStatusByRecruiterId(
    recruiterMatches.map((row) => getString(row.id)).filter((id): id is string => !!id)
  );

  const results: ContactContext[] = [];
  for (const row of recruiterMatches.slice(0, 5)) {
    const id = getString(row.id) ?? "";
    const appContact = appMatches.find((contact) => {
      const sourceIds = contact.source_ids as Record<string, unknown> | null;
      return getString(sourceIds?.recruiter_pipeline_id) === id;
    });

    const draftCtx = buildDraftContactContextFromRecruiter(row, appContact);
    const recentActivitySummary = await summarizeContactActivity(draftCtx);
    results.push({
      name: getString(row.name) ?? "Unknown contact",
      firm: getString(row.firm) ?? "",
      title: getString(row.title) ?? "",
      intent: getString(appContact?.intent),
      personal_goal: getString(appContact?.personal_goal),
      last_contact_date: getString(appContact?.last_touch_date) ?? getString(row.last_contact_date),
      strategic_score: getNumber(row.strategic_score),
      status: statusByRrId.get(id) ?? "queue",
      recent_activity_summary: recentActivitySummary,
    });
  }

  for (const contact of appMatches.slice(0, 5)) {
    if (results.some((result) => normalizeText(result.name) === normalizeText(getString(contact.name) ?? ""))) {
      continue;
    }
    const draftCtx = buildDraftContactContextFromAppContact(contact);
    const recentActivitySummary = await summarizeContactActivity(draftCtx);
    results.push({
      name: getString(contact.name) ?? "Unknown contact",
      firm: getFirmFromTags((contact.tags as string[] | null) ?? []) ?? "",
      title: getString(contact.title) ?? "",
      intent: getString(contact.intent),
      personal_goal: getString(contact.personal_goal),
      last_contact_date: getString(contact.last_touch_date),
      strategic_score: null,
      status: "queue",
      recent_activity_summary: recentActivitySummary,
    });
  }

  return results.slice(0, 5);
}

async function fetchIntentByRecruiterId(ids: string[]) {
  const map = new Map<string, { intent: string | null; personal_goal: string | null }>();
  if (!ids.length) return map;
  const sb = createServiceRoleClient();
  const { data } = await sb
    .from("contacts")
    .select("source_ids,intent,personal_goal")
    .in("source_ids->>recruiter_pipeline_id", ids);

  for (const row of data ?? []) {
    const sourceIds = row.source_ids as Record<string, unknown> | null;
    const id = getString(sourceIds?.recruiter_pipeline_id);
    if (!id) continue;
    map.set(id, {
      intent: getString(row.intent),
      personal_goal: getString(row.personal_goal),
    });
  }
  return map;
}

async function fetchStatusByRecruiterId(ids: string[]) {
  const map = new Map<string, string>();
  if (!ids.length) return map;
  const sbPublic = createPublicServiceRoleClient();
  const { data } = await sbPublic
    .from("rr_contact_state")
    .select("contact_id,status")
    .in("contact_id", ids);

  for (const row of data ?? []) {
    const id = getString(row.contact_id);
    if (id) map.set(id, getString(row.status) ?? "queue");
  }
  return map;
}

async function summarizeContactActivity(ctx: DraftContactContext) {
  const [hubspot, gmail] = await Promise.allSettled([
    withTimeout(gatherHubSpotHistory(ctx), 4_000, { found: false }),
    withTimeout(gatherGmailHistory(ctx), 4_000, { found: false }),
  ]);

  const summaries = [];
  if (hubspot.status === "fulfilled" && hubspot.value.found && hubspot.value.summary) {
    summaries.push(`HubSpot: ${hubspot.value.summary.slice(0, 800)}`);
  }
  if (gmail.status === "fulfilled" && gmail.value.found && gmail.value.summary) {
    summaries.push(`Gmail: ${gmail.value.summary.slice(0, 800)}`);
  }
  return summaries.join("\n") || "No HubSpot/Gmail activity found or integrations unavailable.";
}

function buildDraftContactContextFromRecruiter(
  row: Record<string, unknown>,
  appContact?: Record<string, unknown>
): DraftContactContext {
  const sourceIds = (appContact?.source_ids as Record<string, unknown> | null) ?? {};
  const emails = Array.isArray(appContact?.emails) ? (appContact.emails as string[]) : [];
  return {
    id: getString(appContact?.id) ?? getString(row.id) ?? "",
    name: getString(row.name) ?? getString(appContact?.name) ?? "Unknown contact",
    emails,
    linkedin_url: getString(appContact?.linkedin_url),
    title: getString(row.title) ?? getString(appContact?.title),
    intent: null,
    personal_goal: getString(appContact?.personal_goal),
    last_touch_date: getString(appContact?.last_touch_date) ?? getString(row.last_contact_date),
    source_ids: sourceIds,
    tags: [],
    firm: getString(row.firm),
    specialty: getString(row.specialty),
    recruiterStrategicNotes:
      getString(row.outlook_history) ??
      getString(row.summary_of_prior_comms) ??
      getString(row.strategic_recommended_approach),
    recruiterScores: {
      strategic: getNumber(row.strategic_score),
      firm_fit: null,
      practice_match: null,
      signal: null,
    },
    hubspotContactId: getString(row.hubspot_contact_id) ?? getString(sourceIds.hubspot),
    primaryEmail: emails[0] ?? null,
  };
}

function buildDraftContactContextFromAppContact(row: Record<string, unknown>): DraftContactContext {
  const sourceIds = (row.source_ids as Record<string, unknown> | null) ?? {};
  const emails = Array.isArray(row.emails) ? (row.emails as string[]) : [];
  return {
    id: getString(row.id) ?? "",
    name: getString(row.name) ?? "Unknown contact",
    emails,
    linkedin_url: getString(row.linkedin_url),
    title: getString(row.title),
    intent: null,
    personal_goal: getString(row.personal_goal),
    last_touch_date: getString(row.last_touch_date),
    source_ids: sourceIds,
    tags: (row.tags as string[] | null) ?? [],
    firm: getFirmFromTags((row.tags as string[] | null) ?? []),
    specialty: null,
    recruiterStrategicNotes: null,
    recruiterScores: null,
    hubspotContactId: getString(sourceIds.hubspot),
    primaryEmail: emails[0] ?? null,
  };
}

function uniqueFirms(firms: Array<{ firm: string; firm_normalized: string }>) {
  const map = new Map<string, { firm: string; firm_normalized: string }>();
  for (const firm of firms) {
    const key = normalizeText(firm.firm_normalized || firm.firm);
    if (key && !map.has(key)) map.set(key, firm);
  }
  return [...map.values()];
}

function nameMatchesInstruction(name: string, instructionKey: string) {
  const key = normalizeText(name);
  if (!key || key.length < 3) return false;
  if (instructionKey.includes(key)) return true;
  const parts = key.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return parts[0]?.length > 3 && instructionKey.includes(parts[0]);
  const first = parts[0];
  const last = parts[parts.length - 1];
  return (
    first.length > 2 &&
    last.length > 2 &&
    instructionKey.includes(first) &&
    instructionKey.includes(last)
  );
}

function extractPotentialNames(instruction: string) {
  const names = instruction.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b/g) ?? [];
  return [...new Set(names.filter((name) => !["Jason", "Claude", "Search"].includes(name)))];
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getFirmFromTags(tags: string[]) {
  const tag = tags.find((item) => item.startsWith("firm:"));
  return tag ? tag.replace(/^firm:/, "").replace(/-/g, " ") : null;
}

function getString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function escapeFilterValue(value: string) {
  return value.replace(/[,()]/g, "\\$&");
}

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise
      .then(resolve)
      .catch(() => resolve(fallback))
      .finally(() => clearTimeout(timer));
  });
}

function hasSupabaseServiceRole() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}
