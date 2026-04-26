"use client";

import { useState, useTransition } from "react";
import { ExternalLink, Inbox, MessageSquareText, XCircle } from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { AskDispatchButton } from "@/components/dispatch/AskDispatchButton";
import { addReconnectNote, setReconnectStatus } from "@/app/actions/reconnect";
import { sendContactToTriage, setContactTriage } from "@/lib/server-actions/triage";
import { INTENTS, INTENT_LABELS, type Intent } from "@/lib/triage/types";
import type { ReconnectContact, RecruiterStatus } from "@/lib/reconnect/types";
import { RECRUITER_STATUS_LABELS } from "@/lib/reconnect/constants";
import { TierBadge } from "./tier-badge";
import { ScoreChip } from "./score-chip";
import { NotesTimeline } from "./notes-timeline";

export function ReconnectDetailDrawer({
  contact,
  contacts,
  onClose,
  onLocalStatus,
  onLocalNote,
  onLocalTriage,
  onLocalReconnectCardSent,
}: {
  contact: ReconnectContact | null;
  contacts: ReconnectContact[];
  onClose: () => void;
  onLocalStatus: (id: string, status: RecruiterStatus, note?: string) => void;
  onLocalNote: (id: string, body: string) => void;
  onLocalTriage: (id: string, intent: Intent | null, personalGoal: string | null) => void;
  onLocalReconnectCardSent?: (id: string) => void;
}) {
  const [note, setNote] = useState("");
  const [isPending, startTransition] = useTransition();

  if (!contact) return null;

  const firmMatches = contacts
    .filter(
      (c) =>
        c.id !== contact.id &&
        firmKey(c) === firmKey(contact)
    )
    .sort((a, b) => b.strategic_score - a.strategic_score);

  const updateStatus = (status: RecruiterStatus, prompt?: string) => {
    const context = prompt ? window.prompt(prompt) ?? undefined : undefined;
    onLocalStatus(contact.id, status, context);
    startTransition(async () => {
      const result = await setReconnectStatus(contact.id, status, context);
      toast[result.ok ? "success" : "error"](
        result.ok
          ? `${RECRUITER_STATUS_LABELS[status]} updated`
          : result.message
      );
    });
  };

  const updateTriage = (nextIntent: Intent | null) => {
    const goal =
      nextIntent === null
        ? null
        : window.prompt("One-line goal for this contact", contact.personal_goal ?? "") ??
          contact.personal_goal ??
          null;

    onLocalTriage(contact.id, nextIntent, goal);
    startTransition(async () => {
      const result = await setContactTriage({
        contactId: contact.id,
        intent: nextIntent,
        personalGoal: goal,
      });
      toast[result.ok ? "success" : "error"](
        result.ok ? "Intent updated" : result.error
      );
    });
  };

  const sendToTriage = () => {
    startTransition(async () => {
      const result = await sendContactToTriage({ contactId: contact.id });
      if (!result.ok) {
        toast.error(result.error);
      } else if (result.alreadyExists) {
        toast.info("Already in your triage queue");
      } else {
        onLocalReconnectCardSent?.(contact.id);
        toast.success("Sent to Triage queue");
      }
    });
  };

  const submitNote = () => {
    if (!note.trim()) return;
    const body = note.trim();
    setNote("");
    onLocalNote(contact.id, body);
    startTransition(async () => {
      const result = await addReconnectNote(contact.id, body);
      toast[result.ok ? "success" : "error"](result.ok ? "Note added" : result.message);
    });
  };

  return (
    <Sheet open={!!contact} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-none lg:w-1/2">
        <SheetHeader className="border-b p-5">
          <div className="flex flex-wrap items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <TierBadge tier={contact.tier} />
                <ScoreChip score={contact.strategic_score} />
              </div>
              <SheetTitle className="mt-3 text-2xl">{contact.name}</SheetTitle>
              <SheetDescription>
                {contact.title ? `${contact.title} · ` : ""}
                {contact.firm}
              </SheetDescription>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge variant={contact.intent ? "secondary" : "outline"}>
                  Intent: {contact.intent ? INTENT_LABELS[contact.intent] : "not set"}
                </Badge>
                {contact.personal_goal ? (
                  <span className="text-xs text-muted-foreground">
                    Goal: {contact.personal_goal}
                  </span>
                ) : null}
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-2 pr-8">
              <AskDispatchButton
                requestType="contact_strategy"
                sourcePage="/reconnect/contacts"
                context={{
                  contact_id: contact.id,
                  name: contact.name,
                  company: contact.firm,
                  relationship_tier: contact.tier,
                  last_touch: contact.last_contact_date ?? null,
                }}
                label="Contact strategy"
              />
              <AskDispatchButton
                requestType="recruiter_strategy"
                sourcePage="/reconnect"
                context={{
                  recruiter_id: contact.id,
                  firm_name: contact.firm,
                  practice_area: contact.specialty ?? contact.title ?? null,
                  relationship_status: contact.state.status,
                }}
                label="Recruiter strategy"
              />
              {!contact.has_open_reconnect_card ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={sendToTriage}
                  disabled={isPending}
                >
                  <Inbox className="h-3.5 w-3.5" />
                  Send to Triage
                </Button>
              ) : null}
              {contact.linkedin_url ? (
                <Button variant="outline" size="sm" render={<a href={contact.linkedin_url} target="_blank" />} >
                  LinkedIn <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              ) : null}
              {contact.hubspot_url ? (
                <Button variant="outline" size="sm" render={<a href={contact.hubspot_url} target="_blank" />} >
                  HubSpot <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              ) : null}
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-5 p-5">
          <section className="rounded-xl border border-orange-400/20 bg-orange-400/5 p-4">
            <h3 className="text-sm font-semibold tracking-tight text-orange-200">
              Strategic Recommendation
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-foreground/90">
              {contact.strategic_recommended_approach}
            </p>
          </section>

          <section>
            <h3 className="mb-2 text-sm font-semibold tracking-tight">Quick Actions</h3>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => updateStatus("sent")} disabled={isPending}>
                Mark Sent
              </Button>
              <Button size="sm" variant="outline" onClick={() => updateStatus("replied")} disabled={isPending}>
                Mark Replied
              </Button>
              <Button size="sm" variant="outline" onClick={() => updateStatus("snoozed")} disabled={isPending}>
                Snooze
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => updateStatus("live_role", "One-line live role context")}
                disabled={isPending}
              >
                Mark Live Role
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => updateStatus("closed", "Outcome / close-out note")}
                disabled={isPending}
              >
                Close Out
              </Button>
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-sm font-semibold tracking-tight">Intent</h3>
            <div className="flex flex-wrap gap-2">
              {INTENTS.map((intent) => (
                <Button
                  key={intent}
                  size="sm"
                  variant={contact.intent === intent ? "default" : "outline"}
                  onClick={() => updateTriage(intent)}
                  disabled={isPending}
                >
                  {INTENT_LABELS[intent]}
                </Button>
              ))}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => updateTriage(null)}
                disabled={isPending}
              >
                Clear
              </Button>
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-sm font-semibold tracking-tight">Score Breakdown</h3>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              {[
                ["Firm Fit", contact.firm_fit_score],
                ["Practice Match", contact.practice_match_score],
                ["Recency", contact.recency_score],
                ["Signal", contact.signal_score],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border bg-background/40 p-3">
                  <div className="text-[11px] text-muted-foreground">{label}</div>
                  <div className="num-mono mt-1 text-lg font-semibold">{value}</div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-orange-400" style={{ width: `${value}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold tracking-tight">Communication Context</h3>
            <ContextBlock label="Prior comms" body={contact.summary_of_prior_comms} />
            <ContextBlock label="Outlook history" body={contact.outlook_history} />
          </section>

          <Separator />

          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <MessageSquareText className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold tracking-tight">Notes Timeline</h3>
            </div>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submitNote();
              }}
              placeholder="Add note... Cmd+Enter to save"
            />
            <Button size="sm" onClick={submitNote} disabled={isPending || !note.trim()}>
              Add note
            </Button>
            <NotesTimeline notes={contact.notes} touches={contact.touches} />
          </section>

          <section className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold tracking-tight">
                Who Else You Know At {contact.firm}
              </h3>
              <span className="num-mono text-xs text-muted-foreground">
                {firmMatches.length}
              </span>
            </div>
            {firmMatches.length ? (
              <div className="space-y-2">
                {firmMatches.map((match) => (
                  <div key={match.id} className="rounded-lg border bg-background/40 p-3 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium">{match.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {match.title || match.specialty || "No title captured"}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <TierBadge tier={match.tier} />
                        <span className="num-mono text-xs text-muted-foreground">
                          {match.strategic_score}
                        </span>
                      </div>
                    </div>
                    {match.summary_of_prior_comms ? (
                      <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                        {match.summary_of_prior_comms}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border p-3 text-xs text-muted-foreground">
                No other seeded contacts found at this firm.
                {contact.other_contacts_at_firm ? (
                  <div className="mt-2">{contact.other_contacts_at_firm}</div>
                ) : null}
              </div>
            )}
          </section>

          <Button variant="ghost" size="sm" onClick={onClose} className="gap-2">
            <XCircle className="h-4 w-4" />
            Close drawer
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ContextBlock({ label, body }: { label: string; body?: string }) {
  return (
    <div className="rounded-lg border bg-background/40 p-3">
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <p className="mt-1 text-sm leading-relaxed text-foreground/85">
        {body || "No context captured yet."}
      </p>
    </div>
  );
}

function firmKey(contact: ReconnectContact) {
  return (contact.firm_normalized || contact.firm).trim().toLowerCase();
}
