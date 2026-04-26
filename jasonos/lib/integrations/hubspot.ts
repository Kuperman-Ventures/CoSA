// HubSpot adapter — last-touch CRM history for the Morning Brief Prep button.
// Read-only private app token. Stubbed; same contract as the live adapters.

import "server-only";
import { emptyResult, envConfigured, type IntegrationResult } from "./_base";

export interface HubspotLastTouch {
  contactEmail: string;
  contactName?: string;
  ownerName?: string;
  lastActivityAt?: string;
  lastActivityType?: string;
  lastNote?: string;
  dealStage?: string;
  dealAmountUsd?: number;
}

export async function getLastTouch(email: string): Promise<IntegrationResult<HubspotLastTouch | null>> {
  if (!envConfigured("HUBSPOT_ACCESS_TOKEN")) return emptyResult(null, false);
  // TODO(integration): GET /crm/v3/objects/contacts/{email}?idProperty=email
  // then GET /crm/v3/objects/contacts/{id}/associations/{notes,emails,deals}
  void email;
  return emptyResult(null, true);
}
