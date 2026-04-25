"use client";

import { useState, useTransition } from "react";
import { ExternalLink, Link2, MessageSquareText, XCircle } from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { addReconnectNote, setReconnectStatus } from "@/app/actions/reconnect";
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
}: {
  contact: ReconnectContact | null;
  contacts: ReconnectContact[];
  onClose: () => void;
  onLocalStatus: (id: string, status: RecruiterStatus, note?: string) => void;
  onLocalNote: (id: string, body: string) => void;
}) {
  const [note, setNote] = useState("");
  const [isPending, startTransition] = useTransition();

  if (!contact) return null;

  const firmNames = parseOtherFirmNames(contact.other_contacts_at_firm);
  const firmMatches = firmNames
    .map((name) => contacts.find((c) => c.name.toLowerCase() === name.toLowerCase()))
    .filter(Boolean) as ReconnectContact[];

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
            </div>
            <div className="flex gap-2 pr-8">
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
            <h3 className="text-sm font-semibold tracking-tight">Other Contacts At Firm</h3>
            {firmMatches.length ? (
              <div className="space-y-1">
                {firmMatches.map((match) => (
                  <div key={match.id} className="flex items-center justify-between rounded-lg border p-2 text-sm">
                    <span>{match.name}</span>
                    <span className="text-xs text-muted-foreground">{match.tier}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-start gap-2 rounded-lg border p-3 text-xs text-muted-foreground">
                <Link2 className="mt-0.5 h-3.5 w-3.5" />
                {contact.other_contacts_at_firm || "No other contacts listed."}
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

function parseOtherFirmNames(text?: string) {
  if (!text || !text.includes(":")) return [];
  return text
    .split(":")
    .slice(1)
    .join(":")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
}
