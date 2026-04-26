// Fireflies adapter — meeting transcripts processed overnight. GraphQL API.
// Stubbed; same contract as the live adapters.

import "server-only";
import { emptyResult, envConfigured, type IntegrationResult } from "./_base";

export interface FirefliesMeeting {
  id: string;
  title: string;
  endedAt: string;
  source: "fireflies";
  summary?: string;
  transcriptUrl?: string;
  attendees?: { name?: string; email?: string }[];
}

export async function getOvernightFireflies(): Promise<IntegrationResult<FirefliesMeeting[]>> {
  if (!envConfigured("FIREFLIES_API_KEY")) return emptyResult([], false);
  // TODO(integration): POST https://api.fireflies.ai/graphql with `transcripts(date_from)` query.
  return emptyResult([], true);
}
