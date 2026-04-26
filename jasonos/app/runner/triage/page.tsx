import {
  getNextUntriagedCard,
  getUntriagedReconnectCountsByTrack,
} from "@/lib/server-actions/triage";
import type { TrackFilter } from "@/lib/triage/types";
import { TriageRunnerWrapper } from "./client";

export const dynamic = "force-dynamic";

export default async function TriagePage({
  searchParams,
}: {
  searchParams: Promise<{ skip?: string; track?: string }>;
}) {
  const params = await searchParams;
  const skippedContactIds = parseSkippedContactIds(params.skip);
  const track = parseTrackFilter(params.track);
  const [next, counts] = await Promise.all([
    getNextUntriagedCard(skippedContactIds, track),
    getUntriagedReconnectCountsByTrack(),
  ]);

  return (
    <TriageRunnerWrapper
      key={next?.card_id ?? track ?? "all"}
      initial={next}
      skippedContactIds={skippedContactIds}
      currentTrack={track}
      counts={counts}
    />
  );
}

function parseSkippedContactIds(value?: string) {
  if (!value) return [];
  return value
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

function parseTrackFilter(value?: string): TrackFilter {
  switch (value) {
    case "venture":
    case "advisors":
    case "job_search":
    case "personal":
      return value;
    default:
      return null;
  }
}
