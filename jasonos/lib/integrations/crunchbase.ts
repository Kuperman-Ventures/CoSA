// Crunchbase adapter — overnight funding hits filtered through the Refactor
// Sprint ICP. Long-term we read the Crunchbase Daily email digest via Gmail
// or the official API. Until then this returns an empty, unconfigured result.

import "server-only";
import { ICP } from "@/lib/icp";
import { emptyResult, type IntegrationResult } from "./_base";

export interface CrunchbaseHit {
  id: string;
  name: string;
  domain?: string;
  segment?: string;
  raiseUsd: number;
  stage: string;
  arrUsdEstimate?: number;
  fitScore: number;
  fitRationale: string;
  suggestedTemplate: string;
  announcedAt: string;
  sourceUrl?: string;
}

export async function getOvernightHits(): Promise<IntegrationResult<CrunchbaseHit[]>> {
  return emptyResult([], false);
}

export const _crunchbaseIcp = ICP;
