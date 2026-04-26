// Instantly adapter — outbound email reply tracking.
// Returns overnight reply counts plus per-sequence health. Bearer-token API.
// Stubbed pending real wiring; adheres to the same contract as stripe.ts.

import "server-only";
import { emptyResult, envConfigured, makeCachedFetcher, type IntegrationResult } from "./_base";

const API_KEY = process.env.INSTANTLY_API_KEY;
const BASE = "https://api.instantly.ai/api/v2";
const CACHE_TTL = 300;

export interface InstantlyReply {
  id: string;
  fromEmail: string;
  fromName?: string;
  subject: string;
  receivedAt: string;
  sequenceName?: string;
  preview?: string;
}

export interface InstantlyMetrics {
  repliesSinceCutoff: InstantlyReply[];
  totalReplies24h: number;
  totalSends24h: number;
  replyRate30d: number;            // 0..1
  sequenceHealth: { name: string; replyRate: number; sends: number; replies: number }[];
}

async function fetchOvernightImpl(): Promise<InstantlyMetrics> {
  // TODO(integration): real call once we point at production Instantly.
  // const res = await fetch(`${BASE}/emails?after=${cutoffIso}&type=reply`, { ... });
  return {
    repliesSinceCutoff: [],
    totalReplies24h: 0,
    totalSends24h: 0,
    replyRate30d: 0,
    sequenceHealth: [],
  };
}

const cached = makeCachedFetcher(
  "jasonos:instantly:overnight",
  fetchOvernightImpl,
  CACHE_TTL
);

export async function getInstantlyOvernight(): Promise<IntegrationResult<InstantlyMetrics>> {
  if (!envConfigured("INSTANTLY_API_KEY")) {
    return emptyResult(
      {
        repliesSinceCutoff: [],
        totalReplies24h: 0,
        totalSends24h: 0,
        replyRate30d: 0,
        sequenceHealth: [],
      },
      false
    );
  }
  try {
    const data = await cached();
    return emptyResult(data, true);
  } catch (err) {
    console.error("[instantly] fetch failed:", err);
    return emptyResult(
      {
        repliesSinceCutoff: [],
        totalReplies24h: 0,
        totalSends24h: 0,
        replyRate30d: 0,
        sequenceHealth: [],
      },
      true,
      err instanceof Error ? err.message : String(err)
    );
  }
}

export const _instantlyBase = BASE;
export const _instantlyConfigured = !!API_KEY;
