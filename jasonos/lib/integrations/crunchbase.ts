// Crunchbase adapter — overnight funding hits filtered through the Refactor
// Sprint ICP. Long-term we read the Crunchbase Daily email digest via Gmail
// (cheaper than the official API). Until then this returns mock data.

import "server-only";
import { ICP, scoreIcpFit, type CompanySignal } from "@/lib/icp";
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

function mockHits(): CrunchbaseHit[] {
  const candidates: (CompanySignal & {
    id: string;
    raiseUsd: number;
    domain: string;
    suggestedTemplate: string;
    announcedAt: string;
  })[] = [
    {
      id: "cb-001",
      name: "Atomic.dev",
      domain: "atomic.dev",
      segment: "Fintech",
      arrUsd: 18_000_000,
      stage: "Series B",
      monthsCrmData: 24,
      monthlyMarketingSpendUsd: 65_000,
      raiseUsd: 42_000_000,
      announcedAt: new Date(Date.now() - 18 * 3600_000).toISOString(),
      suggestedTemplate:
        "Hi {first} — congrats on the Series B and on landing at {company}. With the new round and a fresh CMO seat, the next 60 days usually decide whether the GTM motion compounds or stalls. I run a 4-week Refactor Sprint that's been the difference for two of your peers. Worth a 20-minute look?",
    },
    {
      id: "cb-002",
      name: "Stitchpay",
      domain: "stitchpay.com",
      segment: "Fintech",
      arrUsd: 9_500_000,
      stage: "Series A",
      monthsCrmData: 18,
      monthlyMarketingSpendUsd: 28_000,
      raiseUsd: 22_000_000,
      announcedAt: new Date(Date.now() - 9 * 3600_000).toISOString(),
      suggestedTemplate:
        "Hi {first} — saw the Series A. Most fintech infra companies at your stage burn the first quarter post-raise on positioning thrash. We compress that into 4 weeks. Quick chat?",
    },
    {
      id: "cb-003",
      name: "Lattice Risk",
      domain: "latticerisk.com",
      segment: "B2B SaaS",
      arrUsd: 32_000_000,
      stage: "Series B",
      monthsCrmData: 36,
      monthlyMarketingSpendUsd: 90_000,
      raiseUsd: 55_000_000,
      announcedAt: new Date(Date.now() - 5 * 3600_000).toISOString(),
      suggestedTemplate:
        "Hi {first} — the B round suggests you'll be doubling the GTM team this year. Sprint engagements are designed for exactly that growth bend. 20 min?",
    },
    {
      id: "cb-004",
      name: "Helio.AI",
      domain: "helio.ai",
      segment: "Tech",
      arrUsd: 4_200_000,
      stage: "Seed",
      monthsCrmData: 8,
      raiseUsd: 12_000_000,
      announcedAt: new Date(Date.now() - 4 * 3600_000).toISOString(),
      suggestedTemplate: "n/a",
    },
  ];

  return candidates
    .map((c) => {
      const score = scoreIcpFit(c);
      const hit: CrunchbaseHit & { passes: boolean } = {
        id: c.id,
        name: c.name,
        domain: c.domain,
        segment: c.segment,
        raiseUsd: c.raiseUsd,
        stage: c.stage ?? "Unknown",
        arrUsdEstimate: c.arrUsd,
        fitScore: score.score,
        fitRationale: score.rationale,
        suggestedTemplate: c.suggestedTemplate,
        announcedAt: c.announcedAt,
        passes: score.passes,
      };
      return hit;
    })
    .filter((h) => h.passes)
    .sort((a, b) => b.fitScore - a.fitScore)
    .slice(0, 3)
    .map(({ passes: _passes, ...rest }) => rest);
}

export async function getOvernightHits(): Promise<IntegrationResult<CrunchbaseHit[]>> {
  // TODO(integration): wire to Gmail-IMAP parse of the Crunchbase Daily email,
  // OR to the official Daily API if/when the seat is purchased. For now we
  // return realistic mock data so the Morning Brief renders end-to-end.
  return emptyResult(mockHits(), false);
}

export const _crunchbaseIcp = ICP;
