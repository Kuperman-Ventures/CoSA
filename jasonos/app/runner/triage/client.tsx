"use client";

import { useRouter } from "next/navigation";
import { TriageRunner } from "@/components/jasonos/runners/triage-runner";
import type { UntriagedReconnectCard } from "@/lib/triage/types";

export function TriageRunnerWrapper({
  initial,
  skippedContactIds,
}: {
  initial: UntriagedReconnectCard;
  skippedContactIds: string[];
}) {
  const router = useRouter();

  return (
    <TriageRunner
      cardId={initial.card_id}
      contactId={initial.contact_id}
      contactName={initial.contact_name}
      contactTitle={initial.contact_title}
      contactTags={initial.contact_tags ?? []}
      cardSubtitle={initial.subtitle}
      cardBodyHints={initial.body ?? {}}
      initialIntent={initial.current_intent}
      initialGoal={initial.current_goal}
      remainingCount={initial.remaining_count}
      onAdvance={() => router.refresh()}
      onSkip={(contactId) => {
        const skipped = [...new Set([...skippedContactIds, contactId])];
        router.replace(`/runner/triage?skip=${encodeURIComponent(skipped.join(","))}`);
      }}
    />
  );
}
