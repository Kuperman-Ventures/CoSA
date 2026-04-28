"use client";

import Link from "next/link";
import { useState, useTransition, type ReactNode } from "react";
import { format, parseISO } from "date-fns";
import {
  BarChart3,
  Clock3,
  ExternalLink,
  HelpCircle,
  Lightbulb,
  Mail,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { setContactTriage } from "@/lib/server-actions/triage";
import {
  INTENTS,
  INTENT_LABELS,
  type Intent,
  type ReconnectCardBody,
} from "@/lib/triage/types";
import { TierBadge } from "@/components/jasonos/reconnect/tier-badge";
import type { RecruiterTier } from "@/lib/reconnect/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface TriageRunnerProps {
  cardId: string;
  contactId: string;
  contactName: string;
  contactTitle: string | null;
  contactCompany: string | null;
  companyMissing: boolean;
  contactTags: string[];
  cardSubtitle: string | null;
  cardBody: ReconnectCardBody | null;
  daysSinceContact: number | null;
  initialIntent: Intent | null;
  initialGoal: string | null;
  remainingCount: number;
  triagedThisSession: number;
  onTriaged: () => void;
  onAdvance: () => void;
  onSkip: (contactId: string) => void;
}

export function TriageRunner(props: TriageRunnerProps) {
  const [intent, setIntent] = useState<Intent | null>(props.initialIntent);
  const [goal, setGoal] = useState(props.initialGoal ?? "");
  const [pending, startTransition] = useTransition();
  const body = props.cardBody ?? {};
  const firm = getNonEmptyString(body.firm) ?? props.contactCompany;
  const firmSource = getNonEmptyString(body.firm) ? "source" : "tag";
  const specialty = getNonEmptyString(body.specialty);
  const priority = getNonEmptyString(body.strategic_priority);
  const strategicScore = getNumber(body.strategic_score);
  const firmFitScore = getNumber(body.firm_fit_score);
  const practiceScore = getNumber(body.practice_match_score);
  const recencyScore = getNumber(body.recency_score);
  const signalScore = getNumber(body.signal_score);
  const lastContact = getLastContactLabel(
    getNonEmptyString(body.last_contact_date),
    props.daysSinceContact,
    body.prior_communication
  );
  const scoreItems = [
    ["Strategic", strategicScore, 100],
    ["Firm Fit", firmFitScore, 40],
    ["Practice", practiceScore, 30],
    ["Recency", recencyScore, 15],
    ["Signal", signalScore, 15],
  ].filter((item): item is [string, number, number] => typeof item[1] === "number");
  const outlookHistory = getNonEmptyString(body.outlook_history);
  const aiSummary = getNonEmptyString(body.summary_of_prior_comms);
  const suggestedAngle = getNonEmptyString(body.strategic_recommended_approach);
  const showAiSummary =
    !outlookHistory && aiSummary && !isDuplicateSummary(aiSummary, suggestedAngle);
  const othersAtFirm = getNonEmptyString(body.other_contacts_at_firm);
  const linkedinUrl = getNonEmptyString(body.linkedin_url);
  const hasContext = Boolean(outlookHistory || showAiSummary || othersAtFirm || suggestedAngle);

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
        props.onTriaged();
        props.onAdvance();
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <div className="mx-auto flex max-w-2xl flex-col overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b bg-muted/30 px-5 py-3">
          <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Triage · {props.triagedThisSession} done
          </div>
          <Badge variant="outline">{props.remainingCount} remaining</Badge>
        </div>

        <section className="space-y-4 border-b px-5 py-5">
          <SectionKicker>Who</SectionKicker>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-semibold tracking-tight">
                {props.contactName}
              </h2>
              {strategicScore ? <TierBadge tier={getTier(strategicScore)} /> : null}
              {priority ? (
                <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
                  {priority} priority
                </Badge>
              ) : null}
            </div>

            <div className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">
                {props.contactTitle ?? "No title recorded"}
              </span>
              {firm ? (
                <>
                  <span> · </span>
                  <span className="font-medium text-foreground">{firm}</span>
                </>
              ) : null}
            </div>

            {specialty ? (
              <p className="text-sm text-muted-foreground">Specialty: {specialty}</p>
            ) : props.cardSubtitle ? (
              <p className="text-sm text-muted-foreground">{props.cardSubtitle}</p>
            ) : null}

            <div className="flex flex-wrap items-center gap-2 text-xs">
              {props.companyMissing && firm ? (
                <Badge variant="outline" className="h-5 rounded-full text-[10px]">
                  Firm inferred from {firmSource}
                </Badge>
              ) : null}
              {props.companyMissing && !firm ? (
                <Badge variant="destructive" className="h-5 rounded-full text-[10px]">
                  Missing company
                </Badge>
              ) : null}
            </div>
          </div>

          <div className="space-y-2 rounded-lg border bg-background/60 p-3 text-sm">
            <div className="flex items-center gap-2">
              <Clock3 className="h-4 w-4 text-muted-foreground" />
              {lastContact ? (
                <span>Last contact: {lastContact}</span>
              ) : (
                <span className="text-muted-foreground">No prior contact recorded</span>
              )}
            </div>
            {scoreItems.length ? (
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                {scoreItems.map(([label, score, max], index) => (
                  <span key={label} className="text-muted-foreground">
                    {index > 0 ? "· " : null}
                    <span className="text-foreground">{label}</span> {score}/{max}
                  </span>
                ))}
              </div>
            ) : null}
            {linkedinUrl ? (
              <a
                href={linkedinUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium underline-offset-4 hover:underline"
              >
                LinkedIn
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            ) : null}
          </div>
        </section>

        <section className="space-y-4 border-b px-5 py-5">
          <SectionKicker>What We Know</SectionKicker>
          {hasContext ? (
            <div className="space-y-3">
              {outlookHistory ? (
                <ContextBlock
                  icon={<Mail className="h-4 w-4" />}
                  title="Prior contact (from Outlook)"
                  emphasis
                >
                  {outlookHistory}
                </ContextBlock>
              ) : null}

              {showAiSummary ? (
                <ContextBlock
                  icon={<Mail className="h-4 w-4" />}
                  title={
                    <span className="inline-flex items-center gap-1">
                      Prior contact (AI-summarized)
                      <HelpCircle
                        className="h-3.5 w-3.5 text-muted-foreground"
                        aria-label="Generated from import; may overlap with the suggested angle."
                      />
                    </span>
                  }
                  emphasis
                >
                  {aiSummary}
                </ContextBlock>
              ) : null}

              {othersAtFirm ? (
                <ExpandableContextBlock
                  icon={<Users className="h-4 w-4" />}
                  title={`Others at ${firm ?? "this firm"} you know`}
                  text={othersAtFirm}
                />
              ) : null}

              {suggestedAngle ? (
                <ContextBlock
                  icon={<Lightbulb className="h-4 w-4 text-amber-400" />}
                  title="Suggested angle"
                  accent
                >
                  {suggestedAngle}
                </ContextBlock>
              ) : null}
            </div>
          ) : (
            <p className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
              No additional context - pick intent from name + firm alone.
            </p>
          )}
        </section>

        <section className="space-y-4 px-5 py-5">
          <SectionKicker>What I Want</SectionKicker>
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
              Goal (one sentence)
            </label>
            <Textarea
              id="goal"
              value={goal}
              onChange={(event) => setGoal(event.target.value)}
              placeholder="Get intro to VP Eng at NewCo / hear their read on the AdTech market / etc."
              rows={2}
            />
            <p className="text-xs text-muted-foreground">
              Tip: write the goal as if instructing yourself in 3 weeks.
            </p>
          </div>

          <div className="space-y-2 pt-2">
            <div className="flex justify-between gap-3">
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
            <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
              <span>{props.triagedThisSession} triaged this session</span>
              <Link href="/reconnect?intent=any" className="hover:text-foreground hover:underline">
                View triaged so far -&gt;
              </Link>
            </div>
          </div>
        </section>
    </div>
  );
}

function SectionKicker({ children }: { children: ReactNode }) {
  return (
    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
      {children}
    </div>
  );
}

function ContextBlock({
  icon,
  title,
  children,
  emphasis,
  muted,
  accent,
}: {
  icon: ReactNode;
  title: ReactNode;
  children: ReactNode;
  emphasis?: boolean;
  muted?: boolean;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-3 text-sm ${
        accent
          ? "border-amber-500/40 bg-amber-500/8"
          : emphasis
            ? "bg-background"
            : muted
              ? "bg-muted/25 text-muted-foreground"
              : "bg-muted/30"
      }`}
    >
      <div
        className={`mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide ${
          accent ? "text-amber-400" : "text-muted-foreground"
        }`}
      >
        {icon}
        {title}
      </div>
      <p className={`leading-6 ${accent ? "font-medium text-foreground" : muted ? "text-sm" : ""}`}>
        {children}
      </p>
    </div>
  );
}

function ExpandableContextBlock({
  icon,
  title,
  text,
}: {
  icon: ReactNode;
  title: string;
  text: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const shouldTruncate = text.length > 200;
  const visibleText = shouldTruncate && !expanded ? `${text.slice(0, 200).trim()}...` : text;

  return (
    <div className="rounded-lg border bg-muted/30 p-3 text-sm">
      <div className="mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {icon}
        {title}
      </div>
      <p className="leading-6">{visibleText}</p>
      {shouldTruncate ? (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="mt-1 text-xs font-medium underline-offset-4 hover:underline"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      ) : null}
    </div>
  );
}

function getTier(score: number): RecruiterTier {
  if (score >= 5) return "TIER 1";
  if (score >= 4) return "TIER 2";
  if (score >= 3) return "TIER 3";
  return "TIER 4";
}

function getLastContactLabel(
  value: string | null,
  daysSinceContact: number | null,
  priorCommunication: unknown
) {
  if (!value || priorCommunication === false) return null;
  try {
    const formatted = format(parseISO(value), "MMM d, yyyy");
    return daysSinceContact === null
      ? formatted
      : `${formatted} (${formatRelativeAge(daysSinceContact)})`;
  } catch {
    return null;
  }
}

function formatRelativeAge(days: number) {
  if (days < 30) return `${days} ${days === 1 ? "day" : "days"} ago`;
  if (days < 90) {
    const weeks = Math.max(1, Math.round(days / 7));
    return `${weeks} ${weeks === 1 ? "week" : "weeks"} ago`;
  }
  if (days <= 365) {
    const months = Math.max(1, Math.round(days / 30));
    return `${months} ${months === 1 ? "month" : "months"} ago`;
  }
  const years = Math.max(1, Math.round(days / 365));
  return `${years} ${years === 1 ? "year" : "years"} ago`;
}

function isDuplicateSummary(summary: string, approach: string | null) {
  if (!approach) return false;
  const normalizedSummary = normalizeComparableText(summary);
  const normalizedApproach = normalizeComparableText(approach);
  if (normalizedSummary.length < 24 || normalizedApproach.length < 24) return false;
  return (
    normalizedSummary.includes(normalizedApproach) ||
    normalizedApproach.includes(normalizedSummary)
  );
}

function normalizeComparableText(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function getNonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}
