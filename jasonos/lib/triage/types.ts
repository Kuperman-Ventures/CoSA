import type { Track } from "@/lib/types";

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
  body: Record<string, unknown> | null;
  priority_score: number | null;
  contact_name: string;
  contact_title: string | null;
  contact_company: string | null;
  company_missing: boolean;
  contact_tags: string[];
  contact_track: Track;
  current_intent: Intent | null;
  current_goal: string | null;
  remaining_count: number;
}
