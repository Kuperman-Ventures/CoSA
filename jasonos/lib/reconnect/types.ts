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
}

export interface ReconnectStats {
  toActOn: number;
  outreachThisWeek: number;
  repliesThisWeek: number;
  awaitingResponse: number;
}

export interface ReconnectDashboardData {
  stats: ReconnectStats;
  queue: ReconnectContact[];
  contacts: ReconnectContact[];
}
