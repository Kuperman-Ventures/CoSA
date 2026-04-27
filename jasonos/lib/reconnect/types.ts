import type { FirstContactState } from "@/lib/first-contact/types";

export type RecruiterTier = "TIER 1" | "TIER 2" | "TIER 3" | "TIER 4";

export type RecruiterStatus =
  | "queue"
  | "sent"
  | "replied"
  | "in_conversation"
  | "live_role"
  | "closed"
  | "snoozed"
  | "archived";

export type RecruiterSource =
  | "LeadDelta"
  | "Outlook (new)"
  | "HubSpot (new)"
  | "Both";

export type ReconnectIntent =
  | "warm"
  | "intel"
  | "door"
  | "pipeline"
  | "role_inquiry";

export type ReconnectObjectType = "all" | "recruiter" | "tier1_contact" | "manual" | "cold_target";

export interface ReconnectTypeCounts {
  total: number;
  by_type: Record<string, number>;
}

export interface Recruiter {
  id: string;
  name: string;
  firm: string;
  firm_normalized?: string;
  title?: string;
  specialty?: string;
  source: RecruiterSource;
  tier: RecruiterTier;
  strategic_score: number;
  firm_fit_score: number;
  practice_match_score: number;
  recency_score: number;
  signal_score: number;
  strategic_recommended_approach: string;
  summary_of_prior_comms?: string;
  outlook_history?: string;
  linkedin_url?: string;
  hubspot_url?: string;
  last_contact_date?: string;
  other_contacts_at_firm?: string;
}

export interface RecruiterContactState {
  recruiter_id: string;
  status: RecruiterStatus;
  next_action_due_date?: string;
  custom_priority_override?: number;
  starred: boolean;
  updated_at: string;
}

export interface RecruiterTouch {
  id: string;
  recruiter_id: string;
  channel: "linkedin" | "email" | "phone" | "meeting" | "other";
  direction: "outbound" | "inbound";
  body: string;
  created_at: string;
}

export interface RecruiterNote {
  id: string;
  recruiter_id: string;
  body: string;
  created_at: string;
}

export interface ReconnectContact extends Recruiter {
  state: RecruiterContactState;
  notes: RecruiterNote[];
  touches: RecruiterTouch[];
  intent?: ReconnectIntent | null;
  personal_goal?: string | null;
  reconnect_object_type?: string | null;
  has_open_reconnect_card?: boolean;
  first_contact?: FirstContactState | null;
  first_contact_card_id?: string | null;
  why_target?: string | null;
}

export interface ReconnectStats {
  toActOn: number;
  outreachThisWeek: number;
  repliesThisWeek: number;
  awaitingResponse: number;
  triagedReady: number;
}

export interface ReconnectDashboardData {
  stats: ReconnectStats;
  queue: ReconnectContact[];
  contacts: ReconnectContact[];
}
