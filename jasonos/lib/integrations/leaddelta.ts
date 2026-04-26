// LeadDelta adapter — LinkedIn enrichment for the Morning Brief Prep button.
// Stubbed; bearer-token REST.

import "server-only";
import { emptyResult, envConfigured, type IntegrationResult } from "./_base";

export interface LinkedInProfile {
  email?: string;
  linkedinUrl?: string;
  fullName?: string;
  headline?: string;
  company?: string;
  recentPosts?: { url: string; preview: string; postedAt: string }[];
}

export async function getProfileForAttendee(
  attendeeEmail: string
): Promise<IntegrationResult<LinkedInProfile | null>> {
  if (!envConfigured("LEADDELTA_API_KEY")) return emptyResult(null, false);
  // TODO(integration): real call once LeadDelta API contract is finalized.
  void attendeeEmail;
  return emptyResult(null, true);
}
