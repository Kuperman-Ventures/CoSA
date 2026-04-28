import type { Track } from "@/lib/types";
import type { FirmContext } from "@/lib/server-actions/triage";

export type Intent = "warm" | "intel" | "door" | "pipeline" | "role_inquiry";
export type TrackFilter = Track | null;

export type TriageTrackCounts = {
  total: number;
  by_track: Record<Track, number>;
};

export const INTENT_LABELS: Record<Intent, string> = {
  warm: "Warm reconnect",
  intel: "Market / company intel",
  door: "Door opener",
  pipeline: "Sprint / Fractional pipeline",
  role_inquiry: "Role inquiry (job search)",
};

export const INTENTS: Intent[] = [
  "warm",
  "intel",
  "door",
  "pipeline",
  "role_inquiry",
];

export interface UntriagedReconnectCard {
  card_id: string;
  contact_id: string;
  title: string;
  subtitle: string | null;
  body: ReconnectCardBody | null;
  priority_score: number | null;
  contact_name: string;
  contact_title: string | null;
  contact_company: string | null;
  company_missing: boolean;
  contact_tags: string[];
  contact_track: Track | null;
  current_intent: Intent | null;
  current_goal: string | null;
  days_since_contact: number | null;
  remaining_count: number;
  firm_context: FirmContext | null;
}

export interface ReconnectCardBody {
  firm?: string;
  firm_normalized?: string;
  specialty?: string;
  last_contact_date?: string;
  prior_communication?: boolean;
  linkedin_url?: string;
  hubspot_url?: string;
  strategic_score?: number;
  firm_fit_score?: number;
  practice_match_score?: number;
  recency_score?: number;
  signal_score?: number;
  strategic_priority?: string;
  outlook_history?: string;
  other_contacts_at_firm?: string;
  source?: string;
  strategic_recommended_approach?: string;
  summary_of_prior_comms?: string;
  [key: string]: unknown;
}
