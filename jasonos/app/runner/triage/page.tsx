import Link from "next/link";
import { getNextUntriagedCard } from "@/lib/server-actions/triage";
import { TriageRunnerWrapper } from "./client";

export const dynamic = "force-dynamic";

export default async function TriagePage({
  searchParams,
}: {
  searchParams: Promise<{ skip?: string }>;
}) {
  const params = await searchParams;
  const skippedContactIds = parseSkippedContactIds(params.skip);
  const next = await getNextUntriagedCard(skippedContactIds);

  if (!next) {
    return (
      <main className="mx-auto max-w-2xl space-y-4 p-12 text-center">
        <h1 className="text-2xl font-semibold">All caught up</h1>
        <p className="text-muted-foreground">
          Every reconnect contact has an intent set. Come back after the next
          ranker run.
        </p>
        <Link href="/reconnect" className="underline">
          Back to Reconnect
        </Link>
      </main>
    );
  }

  return (
    <TriageRunnerWrapper
      key={next.card_id}
      initial={next}
      skippedContactIds={skippedContactIds}
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
