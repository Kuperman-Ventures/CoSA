// Track Capability Registry
//
// Single source of truth for what each of the four tracks supports:
//   - PM depth (light | medium | heavy)
//   - Modules enabled (reconnect, pipeline, monitoring, etc.)
//   - Home dashboard widgets to render
//   - Runners available for in-track tasks
//
// Sidebar nav, home page composition, and the runner dispatcher all read
// from this. Adding capabilities to one track no longer pollutes others.
//
// Target path in repo: jasonos/lib/dashboard/tracks.ts

import type { Track } from "@/lib/types";

// ---------------------------------------------------------------------------
// Vocabulary types
// ---------------------------------------------------------------------------

export type PmDepth = "light" | "medium" | "heavy";

export type ModuleId =
  | "reconnect"
  | "pipeline"
  | "monitoring"
  | "brief"
  | "compose"
  | "bna"
  | "initiatives"
  | "plan90"
  | "dispatch"
  // job_search-specific (heavy track):
  | "interview-prep"
  | "offer-model"
  | "application-tracker";

export type WidgetId =
  | "this-week"
  | "must-dos"
  | "action-queue"
  | "morning-brief"
  | "monitoring-grid"
  | "cross-kpis"
  | "daily-wrap"
  | "hero-strip"
  | "plan90-roadmap"
  | "initiative-dashboard"
  | "reconnect-queue"
  | "reconnect-stats"
  // ventures:
  | "portfolio-tiles"
  | "ventures-pipeline-summary"
  // advisors:
  | "sprint-pipeline"
  // job_search:
  | "recruiter-queue"
  | "application-tracker"
  | "interview-week"
  // personal:
  | "personal-monitoring";

export type RunnerId =
  | "tier1-ranker"
  | "candidate-import"
  | "triage"
  | "composer"
  | "briefing"
  // job_search-specific runners:
  | "recruiter-triage"
  | "interview-prep"
  | "offer-compare";

// ---------------------------------------------------------------------------
// Capability shape
// ---------------------------------------------------------------------------

export interface TrackCapability {
  track: Track;
  pmDepth: PmDepth;
  enabledModules: ModuleId[];
  homeWidgets: WidgetId[];
  runners: RunnerId[];
}

// ---------------------------------------------------------------------------
// Per-track capability profiles
// ---------------------------------------------------------------------------

export const TRACK_CAPABILITIES: Record<Track, TrackCapability> = {
  venture: {
    track: "venture",
    pmDepth: "light",
    enabledModules: ["monitoring", "brief", "reconnect"],
    homeWidgets: ["portfolio-tiles", "ventures-pipeline-summary"],
    runners: [], // visibility only — no PM runners
  },

  advisors: {
    track: "advisors",
    pmDepth: "medium",
    enabledModules: [
      "pipeline",
      "reconnect",
      "compose",
      "brief",
      "monitoring",
      "initiatives",
      "plan90",
      "bna",
    ],
    homeWidgets: [
      "sprint-pipeline",
      "this-week",
      "reconnect-queue",
      "must-dos",
      "morning-brief",
    ],
    runners: ["tier1-ranker", "candidate-import", "composer", "briefing"],
  },

  job_search: {
    track: "job_search",
    pmDepth: "heavy",
    enabledModules: [
      "pipeline",
      "reconnect",
      "compose",
      "brief",
      "monitoring",
      "initiatives",
      "plan90",
      "interview-prep",
      "offer-model",
      "application-tracker",
      "bna",
    ],
    homeWidgets: [
      "recruiter-queue",
      "application-tracker",
      "interview-week",
      "reconnect-stats",
      "this-week",
      "must-dos",
      "morning-brief",
    ],
    runners: [
      "recruiter-triage",
      "tier1-ranker",
      "composer",
      "briefing",
      "interview-prep",
      "offer-compare",
    ],
  },

  personal: {
    track: "personal",
    pmDepth: "light",
    enabledModules: ["monitoring", "brief"],
    homeWidgets: ["daily-wrap", "personal-monitoring"],
    runners: [],
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Return true if the given module is enabled for the given track.
 * Use to gate UI rendering.
 */
export function isModuleEnabled(track: Track, module: ModuleId): boolean {
  return TRACK_CAPABILITIES[track].enabledModules.includes(module);
}

/**
 * Return true if the given runner is available for the given track.
 */
export function isRunnerAvailable(track: Track, runner: RunnerId): boolean {
  return TRACK_CAPABILITIES[track].runners.includes(runner);
}

/**
 * Return all tracks that have a module enabled. Useful for cross-track features.
 */
export function tracksWithModule(module: ModuleId): Track[] {
  return (Object.keys(TRACK_CAPABILITIES) as Track[]).filter((t) =>
    isModuleEnabled(t, module)
  );
}

/**
 * Return the PM depth for a track. Lets components opt into heavy/medium/light
 * rendering modes.
 */
export function pmDepth(track: Track): PmDepth {
  return TRACK_CAPABILITIES[track].pmDepth;
}
