// Shared, isomorphic constants/types for the Tier 1 Reconnect Runner.
// Safe to import from server components, client components, and server actions.
// (lib/data/contacts.ts is server-only and can't be imported by client code.)

import type { Contact, ContactScore } from "@/lib/types";
import { DEFAULT_WEIGHTS, type RankStrategy, type RankerWeights } from "@/lib/ranker/score";

export interface RankableContact {
  contact: Contact;
  score: ContactScore | null;
}

export interface RunnerStateShape {
  weights: RankerWeights;
  strategy: RankStrategy;
}

export const DEFAULT_RUNNER_STATE: RunnerStateShape = {
  weights: DEFAULT_WEIGHTS,
  strategy: "topscore",
};

export const RUNNER_ID = "tier1-ranker";
export const TASK_ID = "adv-t-tier1";
