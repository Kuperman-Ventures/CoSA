// Granola adapter — meeting notes processed overnight.
// Bearer-token API. Stubbed; same contract as the live adapters.

import "server-only";
import { emptyResult, envConfigured, type IntegrationResult } from "./_base";

export interface GranolaMeeting {
  id: string;
  title: string;
  endedAt: string;
  source: "granola";
  summary?: string;
  notesUrl?: string;
  attendees?: { name?: string; email?: string }[];
}

export async function getOvernightGranola(): Promise<IntegrationResult<GranolaMeeting[]>> {
  if (!envConfigured("GRANOLA_API_KEY")) return emptyResult([], false);
  // TODO(integration): GET https://api.granola.ai/v1/notes?since=...
  return emptyResult([], true);
}
