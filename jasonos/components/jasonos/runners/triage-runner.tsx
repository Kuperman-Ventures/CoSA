"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setContactTriage } from "@/lib/server-actions/triage";
import { INTENTS, INTENT_LABELS, type Intent } from "@/lib/triage/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface TriageRunnerProps {
  cardId: string;
  contactId: string;
  contactName: string;
  contactTitle: string | null;
  contactTags: string[];
  cardSubtitle: string | null;
  cardBodyHints?: {
    strategic_recommended_approach?: string;
    summary_of_prior_comms?: string;
  };
  initialIntent: Intent | null;
  initialGoal: string | null;
  remainingCount: number;
  onAdvance: () => void;
  onSkip: (contactId: string) => void;
}

export function TriageRunner(props: TriageRunnerProps) {
  const [intent, setIntent] = useState<Intent | null>(props.initialIntent);
  const [goal, setGoal] = useState(props.initialGoal ?? "");
  const [pending, startTransition] = useTransition();

  const submit = () => {
    if (!intent) return;

    startTransition(async () => {
      const result = await setContactTriage({
        contactId: props.contactId,
        intent,
        personalGoal: goal.trim() || null,
      });

      if (result.ok) {
        toast.success("Triage saved");
        props.onAdvance();
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-6">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Triage · {props.cardId.slice(0, 8)}
          </div>
          <h2 className="mt-1 text-xl font-semibold">{props.contactName}</h2>
        </div>
        <Badge variant="outline">{props.remainingCount} remaining</Badge>
      </div>

      {props.contactTitle ? (
        <p className="text-sm text-muted-foreground">{props.contactTitle}</p>
      ) : null}
      {props.cardSubtitle ? (
        <p className="text-sm text-muted-foreground">{props.cardSubtitle}</p>
      ) : null}

      {props.contactTags.length ? (
        <div className="flex flex-wrap gap-1">
          {props.contactTags.map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>
      ) : null}

      {props.cardBodyHints?.strategic_recommended_approach ? (
        <div className="rounded-md border bg-muted/40 p-3 text-sm">
          <div className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">
            Recommended approach
          </div>
          {props.cardBodyHints.strategic_recommended_approach}
        </div>
      ) : null}

      {props.cardBodyHints?.summary_of_prior_comms ? (
        <div className="rounded-md border bg-background/40 p-3 text-sm">
          <div className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">
            Prior comms
          </div>
          {props.cardBodyHints.summary_of_prior_comms}
        </div>
      ) : null}

      <div className="space-y-2">
        <div className="text-sm font-medium">What do I want from this contact?</div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {INTENTS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setIntent(option)}
              className={`rounded-md border px-3 py-2 text-left text-sm transition ${
                intent === option
                  ? "border-foreground bg-foreground/5"
                  : "hover:border-foreground/50"
              }`}
            >
              {INTENT_LABELS[option]}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="goal" className="text-sm font-medium">
          One-sentence goal (optional)
        </label>
        <Textarea
          id="goal"
          value={goal}
          onChange={(event) => setGoal(event.target.value)}
          placeholder="Get intro to VP Eng at NewCo / hear their read on the AdTech market / etc."
          rows={2}
        />
      </div>

      <div className="flex justify-between pt-2">
        <Button
          variant="ghost"
          onClick={() => props.onSkip(props.contactId)}
          disabled={pending}
        >
          Skip
        </Button>
        <Button onClick={submit} disabled={!intent || pending}>
          {pending ? "Saving..." : "Save & next"}
        </Button>
      </div>
    </div>
  );
}
