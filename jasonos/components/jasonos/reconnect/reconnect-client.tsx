"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, Radar } from "lucide-react";
import { Button } from "@/components/ui/button";
import type {
  ReconnectContact,
  ReconnectDashboardData,
  ReconnectStats,
  RecruiterStatus,
} from "@/lib/reconnect/types";
import { ReconnectStatsStrip } from "./stats-strip";
import { ReconnectQueueCard } from "./queue-card";
import { ReconnectDetailDrawer } from "./detail-drawer";

export function ReconnectClient({ data }: { data: ReconnectDashboardData }) {
  const [contacts, setContacts] = useState(data.contacts);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [includeTier3, setIncludeTier3] = useState(false);

  const stats = useMemo(() => computeStats(contacts), [contacts]);
  const queue = useMemo(
    () => getQueue(contacts, includeTier3),
    [contacts, includeTier3]
  );
  const selected = selectedId ? contacts.find((c) => c.id === selectedId) ?? null : null;

  const setStatus = (id: string, status: RecruiterStatus, note?: string) => {
    setContacts((current) =>
      current.map((contact) => {
        if (contact.id !== id) return contact;
        const now = new Date().toISOString();
        return {
          ...contact,
          last_contact_date:
            status === "sent" || status === "replied" ? now : contact.last_contact_date,
          state: {
            ...contact.state,
            status,
            updated_at: now,
            next_action_due_date:
              status === "snoozed"
                ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
                : contact.state.next_action_due_date,
          },
          notes: note
            ? [
                {
                  id: `local-note-${Date.now()}`,
                  recruiter_id: id,
                  body: note,
                  created_at: now,
                },
                ...contact.notes,
              ]
            : contact.notes,
          touches:
            status === "sent" || status === "replied"
              ? [
                  {
                    id: `local-touch-${Date.now()}`,
                    recruiter_id: id,
                    channel: "linkedin",
                    direction: status === "sent" ? "outbound" : "inbound",
                    body:
                      status === "sent"
                        ? "Marked sent from Reconnect queue."
                        : "Marked reply received from Reconnect queue.",
                    created_at: now,
                  },
                  ...contact.touches,
                ]
              : contact.touches,
        };
      })
    );
  };

  const addLocalNote = (id: string, body: string) => {
    setContacts((current) =>
      current.map((contact) =>
        contact.id === id
          ? {
              ...contact,
              notes: [
                {
                  id: `local-note-${Date.now()}`,
                  recruiter_id: id,
                  body,
                  created_at: new Date().toISOString(),
                },
                ...contact.notes,
              ],
            }
          : contact
      )
    );
  };

  return (
    <div className="mx-auto max-w-[1500px] space-y-4 px-4 py-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-orange-300">
            <Radar className="h-4 w-4" />
            Reconnect
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            Recruiter Pipeline
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Daily outreach queue for executive search relationships. Not a CRM:
            this is the action surface for the next best recruiter touch.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" render={<Link href="/reconnect/contacts" />}>
            Full pipeline
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <ReconnectStatsStrip stats={stats} />

      <section className="rounded-xl border bg-card">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold tracking-tight">Today&rsquo;s Queue</h2>
            <p className="text-xs text-muted-foreground">
              Tier 1 + 2 contacts in queue, ordered by strategic score and stale touch date.
            </p>
          </div>
          <Button
            variant={includeTier3 ? "default" : "outline"}
            size="sm"
            onClick={() => setIncludeTier3((v) => !v)}
          >
            Surface Tier 3
          </Button>
        </header>

        {queue.length ? (
          <div className="space-y-3 p-3">
            {queue.map((contact) => (
              <ReconnectQueueCard
                key={contact.id}
                contact={contact}
                onOpen={(c) => setSelectedId(c.id)}
                onStatus={setStatus}
              />
            ))}
          </div>
        ) : (
          <div className="grid place-items-center px-4 py-16 text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-400" />
            <h3 className="mt-3 text-lg font-semibold tracking-tight">
              You&rsquo;re caught up.
            </h3>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              No Tier 1 or Tier 2 recruiter touches are due today. Pull Tier 3
              forward if you want to widen the field.
            </p>
            <Button className="mt-4" onClick={() => setIncludeTier3(true)}>
              Surface TIER 3 contacts
            </Button>
          </div>
        )}
      </section>

      <ReconnectDetailDrawer
        contact={selected}
        contacts={contacts}
        onClose={() => setSelectedId(null)}
        onLocalStatus={setStatus}
        onLocalNote={addLocalNote}
      />
    </div>
  );
}

function computeStats(contacts: ReconnectContact[]): ReconnectStats {
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const touches = contacts.flatMap((c) => c.touches);
  return {
    toActOn: contacts.filter(
      (c) => ["TIER 1", "TIER 2"].includes(c.tier) && c.state.status === "queue"
    ).length,
    outreachThisWeek: touches.filter(
      (t) => t.direction === "outbound" && new Date(t.created_at).getTime() >= sevenDaysAgo
    ).length,
    repliesThisWeek: touches.filter(
      (t) => t.direction === "inbound" && new Date(t.created_at).getTime() >= sevenDaysAgo
    ).length,
    awaitingResponse: contacts.filter(
      (c) =>
        c.state.status === "sent" &&
        Date.now() - new Date(c.state.updated_at).getTime() >
          7 * 24 * 60 * 60 * 1000
    ).length,
  };
}

function getQueue(contacts: ReconnectContact[], includeTier3: boolean) {
  return contacts
    .filter((contact) => {
      const tierMatch =
        contact.tier === "TIER 1" ||
        contact.tier === "TIER 2" ||
        (includeTier3 && contact.tier === "TIER 3");
      return tierMatch && contact.state.status === "queue";
    })
    .sort((a, b) => {
      const byScore = b.strategic_score - a.strategic_score;
      if (byScore) return byScore;
      return (
        lastContactMs(a.last_contact_date) - lastContactMs(b.last_contact_date)
      );
    });
}

function lastContactMs(date?: string) {
  return date ? new Date(date).getTime() : 0;
}
