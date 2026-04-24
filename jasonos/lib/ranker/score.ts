// Tier 1 Reconnect Ranker — pure scoring utilities.
// No React, no Supabase, no Next.js — safe to import anywhere and unit test.

import type { Contact, ContactScore } from "@/lib/types";

// ---- Weights ---------------------------------------------------------------

export interface RankerWeights {
  rec: number;
  sen: number;
  fit: number;
}

export const DEFAULT_WEIGHTS: RankerWeights = { rec: 2, sen: 3, fit: 3 };

// ---- Strategies ------------------------------------------------------------

export type RankStrategy = "topscore" | "balanced" | "fresh";

export const STRATEGY_INFO: Record<
  RankStrategy,
  { label: string; description: string }
> = {
  topscore: {
    label: "Top score",
    description:
      "Top 30 purely by score. Ties broken by recency, then seniority.",
  },
  balanced: {
    label: "Cluster-balanced",
    description:
      "Top 4 from each primary cluster (TBWA, Agency.com, Omnicom, Videri, OUTFRONT) = 20. Remaining 10 by score. Prevents one era from dominating.",
  },
  fresh: {
    label: "Fresh-first",
    description:
      "Contacts touched in the last 365 days only. Top 30 by score. Biases toward warm network.",
  },
};

// ---- Alumni cluster derivation --------------------------------------------

export const ALUMNI_PREFIX = "alumni:";

export const PRIMARY_CLUSTERS = [
  "tbwa",
  "agency",
  "omnicom",
  "videri",
  "outfront",
] as const;

export const ALL_CLUSTERS = [
  ...PRIMARY_CLUSTERS,
  "industry",
  "other",
] as const;

export type AlumniCluster = (typeof ALL_CLUSTERS)[number];

export const CLUSTER_LABEL: Record<AlumniCluster, string> = {
  tbwa: "TBWA",
  agency: "Agency.com",
  omnicom: "Omnicom",
  videri: "Videri",
  outfront: "OUTFRONT",
  industry: "Industry",
  other: "Other",
};

export function clusterOf(contact: Contact): AlumniCluster | null {
  for (const tag of contact.tags ?? []) {
    if (!tag.startsWith(ALUMNI_PREFIX)) continue;
    const slug = tag.slice(ALUMNI_PREFIX.length).toLowerCase();
    if ((ALL_CLUSTERS as readonly string[]).includes(slug)) {
      return slug as AlumniCluster;
    }
  }
  return null;
}

// ---- Scoring ---------------------------------------------------------------

export function score(
  recency: number | null | undefined,
  seniority: number | null | undefined,
  fit: number | null | undefined,
  weights: RankerWeights = DEFAULT_WEIGHTS
): number {
  const r = clamp1to5(recency);
  const s = clamp1to5(seniority);
  const f = clamp1to5(fit);
  return weights.rec * r + weights.sen * s + weights.fit * f;
}

export function scoreBreakdown(
  recency: number | null | undefined,
  seniority: number | null | undefined,
  fit: number | null | undefined,
  weights: RankerWeights = DEFAULT_WEIGHTS
): string {
  const r = clamp1to5(recency);
  const s = clamp1to5(seniority);
  const f = clamp1to5(fit);
  return `${weights.rec}·${r} + ${weights.sen}·${s} + ${weights.fit}·${f} = ${
    weights.rec * r + weights.sen * s + weights.fit * f
  }`;
}

function clamp1to5(n: number | null | undefined): number {
  if (n == null || Number.isNaN(n)) return 0;
  if (n < 0) return 0;
  if (n > 5) return 5;
  return n;
}

// ---- Auto-rank -------------------------------------------------------------

export interface RankableContact {
  contact: Contact;
  score: ContactScore | null;
}

export interface RankedPick {
  contactId: string;
  rank: number;
  priorityScore: number;
  whyNow: string;
}

const DAY_MS = 86_400_000;

function daysSince(dateStr?: string): number | null {
  if (!dateStr) return null;
  const t = Date.parse(dateStr);
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / DAY_MS);
}

export function daysAgoLabel(dateStr?: string): string {
  const d = daysSince(dateStr);
  if (d == null) return "never";
  if (d < 1) return "today";
  if (d < 30) return `${d}d ago`;
  if (d < 365) return `${Math.round(d / 30)}mo ago`;
  return `${Math.round(d / 365)}y ago`;
}

function buildWhyNow(
  rc: RankableContact,
  rank: number,
  weights: RankerWeights
): string {
  const cluster = clusterOf(rc.contact);
  const clusterLabel = cluster ? CLUSTER_LABEL[cluster] : "Other";
  const fit = rc.score?.fit ?? 0;
  return `#${rank} · ${clusterLabel} · last touch ${daysAgoLabel(
    rc.contact.last_touch_date
  )} · fit ${fit}/5 (score ${score(
    rc.score?.recency,
    rc.score?.seniority,
    rc.score?.fit,
    weights
  )})`;
}

function scored(
  rcs: RankableContact[],
  weights: RankerWeights
): Array<RankableContact & { _score: number }> {
  return rcs.map((rc) => ({
    ...rc,
    _score: score(rc.score?.recency, rc.score?.seniority, rc.score?.fit, weights),
  }));
}

function sortByScoreDesc(
  list: Array<RankableContact & { _score: number }>
): Array<RankableContact & { _score: number }> {
  return [...list].sort((a, b) => {
    if (b._score !== a._score) return b._score - a._score;
    const r = (b.score?.recency ?? 0) - (a.score?.recency ?? 0);
    if (r !== 0) return r;
    return (b.score?.seniority ?? 0) - (a.score?.seniority ?? 0);
  });
}

export function autoRank(
  rcs: RankableContact[],
  strategy: RankStrategy,
  weights: RankerWeights,
  targetSize = 30
): RankedPick[] {
  // Candidate pool = only contacts with a contact_scores row. Unscored contacts
  // are excluded entirely from auto-rank candidacy regardless of strategy. This
  // prevents zero-scored rows from filling out the top 30 when the user has
  // scored fewer than 30 contacts.
  let pool = scored(rcs, weights).filter((rc) => rc.score !== null);

  if (strategy === "fresh") {
    pool = pool.filter((rc) => {
      const d = daysSince(rc.contact.last_touch_date);
      return d != null && d <= 365;
    });
  }

  let chosen: typeof pool = [];

  if (strategy === "balanced") {
    const used = new Set<string>();
    for (const cluster of PRIMARY_CLUSTERS) {
      const ofCluster = sortByScoreDesc(
        pool.filter((rc) => clusterOf(rc.contact) === cluster)
      );
      for (const rc of ofCluster.slice(0, 4)) {
        chosen.push(rc);
        used.add(rc.contact.id);
      }
    }
    const remaining = sortByScoreDesc(
      pool.filter((rc) => !used.has(rc.contact.id))
    );
    for (const rc of remaining) {
      if (chosen.length >= targetSize) break;
      chosen.push(rc);
      used.add(rc.contact.id);
    }
  } else {
    chosen = sortByScoreDesc(pool).slice(0, targetSize);
  }

  return chosen.slice(0, targetSize).map((rc, i) => ({
    contactId: rc.contact.id,
    rank: i + 1,
    priorityScore: rc._score,
    whyNow: buildWhyNow(rc, i + 1, weights),
  }));
}

// ---- Last-touch color tier (used by UI) -----------------------------------

export type RecencyTier = "fresh" | "ok" | "stale" | "cold";

export function lastTouchTier(dateStr?: string): RecencyTier {
  const d = daysSince(dateStr);
  if (d == null) return "cold";
  if (d < 60) return "fresh";
  if (d < 180) return "ok";
  if (d < 365) return "stale";
  return "cold";
}
