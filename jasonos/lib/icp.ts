// Single source of truth for the Refactor Sprint / Kuperman Advisors ICP.
// Used by the Crunchbase ingestion filter, Action Queue badging, and future
// BNA prompts. Edit here, not in a hook or component.

export interface IcpFilter {
  segments: string[];          // industry buckets
  arrMinUsd: number;           // ARR floor in dollars
  arrMaxUsd: number;
  stages: string[];            // funding rounds
  minMonthsCrmData: number;
  monthlyMarketingSpendMinUsd: number;
}

export const ICP: IcpFilter = {
  segments: ["B2B SaaS", "Tech", "Fintech"],
  arrMinUsd: 2_000_000,
  arrMaxUsd: 50_000_000,
  stages: ["Series A", "Series B"],
  minMonthsCrmData: 12,
  monthlyMarketingSpendMinUsd: 20_000,
};

export interface CompanySignal {
  name: string;
  segment?: string;
  arrUsd?: number;
  stage?: string;
  monthsCrmData?: number;
  monthlyMarketingSpendUsd?: number;
}

export interface IcpScore {
  passes: boolean;
  score: number;     // 0..1, only meaningful when passes
  rationale: string; // short human string
  failedReasons: string[];
}

// Rough fit score — proximity to the ICP center, not just pass/fail.
// Center of segment-blind dimensions weighted: stage 0.35, ARR fit 0.35,
// CRM history 0.15, marketing spend 0.15.
export function scoreIcpFit(c: CompanySignal): IcpScore {
  const failed: string[] = [];

  const segmentOk = c.segment
    ? ICP.segments.some((s) => s.toLowerCase() === c.segment!.toLowerCase())
    : false;
  if (!segmentOk) failed.push(`segment "${c.segment ?? "?"}" not in ${ICP.segments.join("/")}`);

  const arrOk =
    c.arrUsd !== undefined && c.arrUsd >= ICP.arrMinUsd && c.arrUsd <= ICP.arrMaxUsd;
  if (!arrOk) failed.push(`ARR ${c.arrUsd ?? "?"} outside ${ICP.arrMinUsd}-${ICP.arrMaxUsd}`);

  const stageOk = c.stage
    ? ICP.stages.some((s) => s.toLowerCase() === c.stage!.toLowerCase())
    : false;
  if (!stageOk) failed.push(`stage "${c.stage ?? "?"}" not in ${ICP.stages.join("/")}`);

  const crmOk =
    c.monthsCrmData !== undefined && c.monthsCrmData >= ICP.minMonthsCrmData;
  // Marketing spend / CRM data are nice-to-have proofs, not hard fails.

  const passes = segmentOk && arrOk && stageOk;

  // Score: pass = average of normalized fit on each dimension.
  let score = 0;
  if (passes) {
    const arrCenter = (ICP.arrMinUsd + ICP.arrMaxUsd) / 2;
    const arrSpan = (ICP.arrMaxUsd - ICP.arrMinUsd) / 2;
    const arrFit = c.arrUsd !== undefined
      ? 1 - Math.min(1, Math.abs(c.arrUsd - arrCenter) / arrSpan)
      : 0.5;
    const stageFit = stageOk ? 1 : 0;
    const crmFit = crmOk ? 1 : 0.5;
    const spendFit =
      c.monthlyMarketingSpendUsd !== undefined &&
      c.monthlyMarketingSpendUsd >= ICP.monthlyMarketingSpendMinUsd
        ? 1
        : 0.5;
    score =
      0.35 * stageFit + 0.35 * arrFit + 0.15 * crmFit + 0.15 * spendFit;
  }

  // 1-line rationale geared for Morning Brief display
  const rationale = passes
    ? `${c.stage ?? "?"} · ${c.segment ?? "?"} · ${
        c.arrUsd ? `~$${(c.arrUsd / 1_000_000).toFixed(1)}M ARR` : "ARR ?"
      }`
    : failed[0] ?? "missing signal";

  return { passes, score: +score.toFixed(2), rationale, failedReasons: failed };
}
