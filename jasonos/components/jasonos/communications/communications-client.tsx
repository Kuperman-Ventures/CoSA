"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Building2,
  Calendar,
  CalendarClock,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  HelpCircle,
  LayoutGrid,
  Link2,
  List,
  Mail,
  MessageSquare,
  Phone,
  RefreshCw,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Trash2,
  User,
  Video,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  CommunicationsContact,
  CommChannel,
  CommUrgency,
} from "@/lib/server-actions/communications";
import {
  dismissCommunicationContact,
  postDispatchRequest,
  scheduleNextTouch,
} from "@/lib/server-actions/communications";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const URGENCY_ORDER: CommUrgency[] = [
  "sent_today",
  "due_today",
  "this_week",
  "scheduled",
  "needs_scheduling",
];

const URGENCY_CONFIG: Record<
  CommUrgency,
  {
    label: string;
    helper: string;
    icon: React.ReactNode;
    textColor: string;
    headerBg: string;
  }
> = {
  sent_today: {
    label: "Sent Today",
    helper: "Outbound touches recorded today from your accounts",
    icon: <Mail className="h-4 w-4" />,
    textColor: "text-emerald-300",
    headerBg: "bg-emerald-700/70",
  },
  due_today: {
    label: "Due Now",
    helper: "Past their scheduled next-touch date — reach out today",
    icon: <AlertCircle className="h-4 w-4" />,
    textColor: "text-red-300",
    headerBg: "bg-red-700/80",
  },
  this_week: {
    label: "This Week",
    helper: "Scheduled for outreach in the next 7 days",
    icon: <Clock className="h-4 w-4" />,
    textColor: "text-amber-300",
    headerBg: "bg-amber-600/70",
  },
  scheduled: {
    label: "Scheduled",
    helper: "Next touch set — coming up after this week",
    icon: <Calendar className="h-4 w-4" />,
    textColor: "text-sky-300",
    headerBg: "bg-sky-800/50",
  },
  needs_scheduling: {
    label: "Needs Scheduling",
    helper: "No next-touch date set — set a cadence to activate",
    icon: <HelpCircle className="h-4 w-4" />,
    textColor: "text-muted-foreground",
    headerBg: "bg-muted/60",
  },
};

const CHANNEL_ICONS: Record<CommChannel, React.ReactNode> = {
  email: <Mail className="h-3.5 w-3.5" />,
  linkedin: <Link2 className="h-3.5 w-3.5" />,
  phone: <Phone className="h-3.5 w-3.5" />,
  meeting: <Video className="h-3.5 w-3.5" />,
  other: <MessageSquare className="h-3.5 w-3.5" />,
};

const CHANNEL_LABELS: Record<CommChannel, string> = {
  email: "Email",
  linkedin: "LinkedIn",
  phone: "Phone",
  meeting: "Meeting",
  other: "Other",
};

const NEXT_CONTACT_OPTIONS = [
  { label: "ASAP", value: "asap" as const },
  { label: "Next week", value: "next_week" as const },
  { label: "2 weeks", value: "2_weeks" as const },
  { label: "1 month", value: "1_month" as const },
  { label: "3 months", value: "3_months" as const },
];

const CADENCE_OPTIONS = [
  { label: "No repeat", value: "none" },
  { label: "Monthly", value: "monthly" },
  { label: "Quarterly", value: "quarterly" },
  { label: "Every 6 months", value: "6_months" },
  { label: "Annually", value: "annually" },
];

const SORT_OPTIONS = [
  "Priority score",
  "Last contact",
  "Name",
  "Company",
] as const;

type SortOption = (typeof SORT_OPTIONS)[number];

// ---------------------------------------------------------------------------
// Main layout
// ---------------------------------------------------------------------------

export function CommunicationsClient({
  contacts,
}: {
  contacts: CommunicationsContact[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [listView, setListView] = useState<"list" | "grid">("list");
  const [sort, setSort] = useState<SortOption>("Priority score");
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [isSyncing, setIsSyncing] = useState(false);

  const today = new Date().toISOString().split("T")[0];

  const requestEmailSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      const result = await postDispatchRequest({
        requestType: "sync_today_emails",
        sourcePage: "/communications",
        context: {
          date: today,
          instruction:
            "Fetch all emails sent today from Gmail (Sent folder, after midnight local time). Also pull any HubSpot engagement activity logged today (emails sent, meetings, calls). For each interaction: (1) identify the contact by email address or name, (2) find their row in the rr_recruiters table by matching email address or full name, (3) upsert a new row into rr_touches with columns: contact_id (rr_recruiters.id), channel ('email'|'linkedin'|'phone'|'meeting'), direction ('outbound'), touched_at (ISO timestamp of the send), brief (1-sentence summary of the interaction). Skip contacts not found in rr_recruiters. Return a markdown summary: how many interactions found, how many matched to rr_recruiters contacts, how many rr_touches rows written.",
          sources: ["gmail_sent", "hubspot_engagements"],
        },
      });
      if (!result.ok) throw new Error(result.error ?? "Dispatch request failed");
      toast.success("Email sync requested", {
        description:
          "Claude Cowork is fetching Gmail + HubSpot. Check the Dispatch inbox for a summary — then hit Refresh to update the grid.",
      });
    } catch (err) {
      toast.error("Sync request failed", {
        description: err instanceof Error ? err.message : "Unknown error. Check the server logs.",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const activeContacts = useMemo(
    () => contacts.filter((c) => !dismissed.has(c.id)),
    [contacts, dismissed]
  );

  const filteredForList = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? activeContacts.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            (c.firm ?? "").toLowerCase().includes(q)
        )
      : activeContacts;

    return [...list].sort((a, b) => {
      if (sort === "Last contact") {
        const at = (c: CommunicationsContact) =>
          c.lastTouch?.touched_at ?? "";
        return at(b).localeCompare(at(a));
      }
      if (sort === "Name") return a.name.localeCompare(b.name);
      if (sort === "Company")
        return (a.firm ?? "").localeCompare(b.firm ?? "");
      return b.strength - a.strength;
    });
  }, [activeContacts, query, sort]);

  const selectedContact = selectedId
    ? activeContacts.find((c) => c.id === selectedId) ?? null
    : null;

  const handleSelect = (id: string) =>
    setSelectedId((prev) => (prev === id ? null : id));

  const handleDismiss = (id: string) => {
    setDismissed((prev) => new Set([...prev, id]));
    if (selectedId === id) setSelectedId(null);
    void dismissCommunicationContact(id);
  };

  return (
    <div className="grid grid-cols-3 h-[calc(100vh-3rem)] overflow-hidden">
      {/* ---------------------------------------------------------------- */}
      {/* LEFT — Contact list                                              */}
      {/* ---------------------------------------------------------------- */}
      <aside className="flex flex-col border-r bg-card/50 min-h-0">
        <div className="border-b p-3 space-y-2 shrink-0">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold tracking-tight">Contacts</h2>
            <div className="flex items-center gap-1">
              <Button
                size="icon-xs"
                variant={listView === "list" ? "secondary" : "ghost"}
                onClick={() => setListView("list")}
                aria-label="List view"
              >
                <List className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon-xs"
                variant={listView === "grid" ? "secondary" : "ghost"}
                onClick={() => setListView("grid")}
                aria-label="Grid view"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name or company…"
              className="pl-7 h-8 text-xs"
            />
          </div>

          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortOption)}
              className="flex-1 bg-transparent text-xs text-muted-foreground border border-border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap gap-1">
            {URGENCY_ORDER.map((u) => {
              const count = activeContacts.filter(
                (c) => c.urgency === u
              ).length;
              if (!count) return null;
              const cfg = URGENCY_CONFIG[u];
              return (
                <button
                  key={u}
                  type="button"
                  className="rounded-full border px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  {cfg.label} · {count}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-border/50 min-h-0">
          {filteredForList.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              No contacts found
            </div>
          ) : (
            filteredForList.map((contact) => {
              const urgency = URGENCY_CONFIG[contact.urgency];
              const isSelected = selectedId === contact.id;
              return (
                <button
                  key={contact.id}
                  type="button"
                  onClick={() => handleSelect(contact.id)}
                  className={`w-full px-3 py-2.5 text-left transition-colors hover:bg-muted/40 border-l-2 ${
                    isSelected
                      ? "bg-muted/60 border-foreground/60"
                      : "border-transparent"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">
                        {contact.name}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {contact.firm ?? "—"}
                      </div>
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-1">
                      <StrengthDots strength={contact.strength} />
                      {contact.lastTouch ? (
                        <span className="text-[10px] text-muted-foreground">
                          {CHANNEL_LABELS[contact.lastTouch.channel]} ·{" "}
                          {fmtDate(contact.lastTouch.touched_at)}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-0.5">
                    <span
                      className={`text-[10px] font-medium ${urgency.textColor}`}
                    >
                      {urgency.label}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="border-t p-2 text-center text-[11px] text-muted-foreground shrink-0">
          {activeContacts.length} contacts ·{" "}
          <span className="italic">Gmail + HubSpot sync coming</span>
        </div>
      </aside>

      {/* ---------------------------------------------------------------- */}
      {/* MIDDLE — Outreach Grid                                           */}
      {/* ---------------------------------------------------------------- */}
      <div className="flex flex-col border-r min-h-0 overflow-hidden">
        <div className="flex items-center justify-between border-b bg-muted/20 px-4 py-2 shrink-0">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold tracking-tight">
              Outreach Grid
            </span>
            <Badge variant="secondary" className="text-[10px]">
              {activeContacts.length}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => router.refresh()}
            >
              <RotateCcw className="h-3 w-3" />
              Refresh
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1.5 text-xs border-violet-400/40 bg-violet-500/10 text-violet-200 hover:bg-violet-500/20 hover:border-violet-300/60"
              onClick={() => void requestEmailSync()}
              disabled={isSyncing}
            >
              <Mail className="h-3 w-3" />
              {isSyncing ? "Requesting…" : `Sync ${today}`}
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0">
          {URGENCY_ORDER.map((urgency) => {
            const bucket = activeContacts.filter(
              (c) => c.urgency === urgency
            );
            return (
              <UrgencySection
                key={urgency}
                urgency={urgency}
                contacts={bucket}
                selectedId={selectedId}
                onSelect={handleSelect}
              />
            );
          })}
        </div>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* RIGHT — Contact detail                                           */}
      {/* ---------------------------------------------------------------- */}
      {selectedContact ? (
        <ContactDetailPanel
          contact={selectedContact}
          onSelectPeer={handleSelect}
          onDismiss={handleDismiss}
        />
      ) : (
        <div className="flex items-center justify-center bg-muted/10 text-xs text-muted-foreground">
          <div className="text-center space-y-1 px-6">
            <User className="mx-auto h-6 w-6 text-muted-foreground/30" />
            <div>Select a contact to view details</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Contact detail panel
// ---------------------------------------------------------------------------

function ContactDetailPanel({
  contact,
  onSelectPeer,
  onDismiss,
}: {
  contact: CommunicationsContact;
  onSelectPeer: (id: string) => void;
  onDismiss: (id: string) => void;
}) {
  const [nextContactOption, setNextContactOption] = useState<
    (typeof NEXT_CONTACT_OPTIONS)[number]["value"]
  >("next_week");
  const [cadence, setCadence] = useState("quarterly");
  const [isPending, startTransition] = useTransition();
  const [isDismissPending, startDismissTransition] = useTransition();
  const [scheduled, setScheduled] = useState(false);

  const handleSchedule = () => {
    startTransition(async () => {
      await scheduleNextTouch(contact.id, nextContactOption);
      setScheduled(true);
    });
  };

  const handleDismiss = () => {
    startDismissTransition(() => {
      onDismiss(contact.id);
    });
  };

  return (
    <aside className="flex flex-col bg-card/60 min-h-0 overflow-y-auto">
      {/* Header */}
      <div className="border-b p-4 space-y-2 shrink-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-base font-semibold tracking-tight leading-tight">
              {contact.name}
            </h2>
            {contact.title ? (
              <div className="text-xs text-muted-foreground mt-0.5 truncate">
                {contact.title}
              </div>
            ) : null}
          </div>
          <StrengthDots strength={contact.strength} />
        </div>
        {contact.firm ? (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Building2 className="h-3.5 w-3.5 shrink-0" />
            <span className="font-medium text-foreground/80">{contact.firm}</span>
          </div>
        ) : null}
        {contact.hubspot_url ? (
          <a
            href={contact.hubspot_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <Link2 className="h-3 w-3" />
            HubSpot record
          </a>
        ) : null}
      </div>

      <div className="flex flex-col gap-5 p-4">
        {/* Last contact */}
        <section className="space-y-1.5">
          <SectionLabel>Last Contact</SectionLabel>
          {contact.lastTouch ? (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">
                  {CHANNEL_ICONS[contact.lastTouch.channel]}
                </span>
                <span className="font-medium">
                  {CHANNEL_LABELS[contact.lastTouch.channel]}
                </span>
                <span className="text-muted-foreground">·</span>
                <span className="text-xs text-muted-foreground">
                  {fmtDate(contact.lastTouch.touched_at)}
                </span>
                <span
                  className={`ml-auto text-[10px] px-1.5 py-0.5 rounded border ${
                    contact.lastTouch.direction === "inbound"
                      ? "border-blue-500/40 text-blue-400"
                      : "border-emerald-500/40 text-emerald-400"
                  }`}
                >
                  {contact.lastTouch.direction === "inbound" ? "Inbound" : "Outbound"}
                </span>
              </div>
              {contact.lastTouch.brief ? (
                <p className="text-xs leading-relaxed text-foreground/80 rounded-md border bg-muted/30 p-2.5">
                  {contact.lastTouch.brief}
                </p>
              ) : contact.summaryOfPriorComms ? (
                <p className="text-xs leading-relaxed text-foreground/80 rounded-md border bg-muted/30 p-2.5 italic">
                  {contact.summaryOfPriorComms}
                </p>
              ) : null}
            </div>
          ) : contact.summaryOfPriorComms ? (
            <p className="text-xs leading-relaxed text-foreground/80 rounded-md border bg-muted/30 p-2.5 italic">
              {contact.summaryOfPriorComms}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground italic">
              No contact recorded yet.
            </p>
          )}
        </section>

        {/* Next touch scheduler */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <SectionLabel>Schedule Next Touch</SectionLabel>
            {contact.nextActionDueDate ? (
              <span className="text-[10px] text-muted-foreground">
                Due {fmtDate(contact.nextActionDueDate)}
              </span>
            ) : null}
          </div>
          <div className="grid grid-cols-3 gap-1">
            {NEXT_CONTACT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  setNextContactOption(opt.value);
                  setScheduled(false);
                }}
                className={`rounded-md border px-2 py-1.5 text-[11px] font-medium transition-colors ${
                  nextContactOption === opt.value
                    ? "border-foreground/60 bg-foreground text-background"
                    : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <RefreshCw className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <select
              value={cadence}
              onChange={(e) => setCadence(e.target.value)}
              className="flex-1 bg-transparent text-xs text-muted-foreground border border-border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {CADENCE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {scheduled ? (
            <div className="w-full rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-center text-xs text-emerald-400">
              Scheduled ✓
            </div>
          ) : (
            <Button
              size="sm"
              className="w-full"
              onClick={handleSchedule}
              disabled={isPending}
            >
              <Calendar className="h-3.5 w-3.5 mr-1.5" />
              {isPending ? "Saving…" : "Set Schedule"}
            </Button>
          )}
        </section>

        {/* Peers at company */}
        {contact.peers.length > 0 ? (
          <section className="space-y-2">
            <SectionLabel>
              Others at {contact.firm} ({contact.peers.length})
            </SectionLabel>
            <div className="space-y-1">
              {contact.peers.map((peer) => (
                <button
                  key={peer.id}
                  type="button"
                  onClick={() => onSelectPeer(peer.id)}
                  className="w-full flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2 text-left transition-colors hover:bg-muted/60 hover:border-foreground/30"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-medium truncate">
                      {peer.name}
                    </div>
                    {peer.title ? (
                      <div className="text-[10px] text-muted-foreground truncate">
                        {peer.title}
                      </div>
                    ) : null}
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {/* Dismiss */}
        <section className="pt-2 border-t border-border/40">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            onClick={handleDismiss}
            disabled={isDismissPending}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
            {isDismissPending ? "Removing…" : "Dismiss contact"}
          </Button>
          <p className="mt-1 text-center text-[10px] text-muted-foreground/60">
            Removes from Communications view. Useful for personal contacts.
          </p>
        </section>
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Urgency section
// ---------------------------------------------------------------------------

const ROW_URGENCIES: CommUrgency[] = ["scheduled", "needs_scheduling"];

function UrgencySection({
  urgency,
  contacts,
  selectedId,
  onSelect,
}: {
  urgency: CommUrgency;
  contacts: CommunicationsContact[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const cfg = URGENCY_CONFIG[urgency];
  const useRows = ROW_URGENCIES.includes(urgency);

  return (
    <div>
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left ${cfg.headerBg}`}
      >
        <div className="flex items-center gap-2">
          <span className={cfg.textColor}>{cfg.icon}</span>
          <div>
            <div className={`text-sm font-semibold ${cfg.textColor}`}>
              {cfg.label}
            </div>
            <div className="text-[11px] text-white/60">{cfg.helper}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {contacts.length > 0 ? (
            <span className="text-xs font-medium text-white/80">
              {contacts.length}
            </span>
          ) : null}
          {collapsed ? (
            <ChevronDown className="h-4 w-4 text-white/60" />
          ) : (
            <ChevronUp className="h-4 w-4 text-white/60" />
          )}
        </div>
      </button>

      {!collapsed ? (
        useRows ? (
          <div className="max-h-48 overflow-y-auto bg-card/10 divide-y divide-border/30">
            {contacts.length ? (
              contacts.map((contact) => (
                <ContactRow
                  key={contact.id}
                  contact={contact}
                  selected={selectedId === contact.id}
                  onSelect={onSelect}
                />
              ))
            ) : (
              <div className="px-4 py-3 text-xs text-muted-foreground italic">
                No contacts in this bucket
              </div>
            )}
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto px-4 py-3 bg-card/20">
            {contacts.length ? (
              contacts.map((contact) => (
                <ContactCard
                  key={contact.id}
                  contact={contact}
                  selected={selectedId === contact.id}
                  onSelect={onSelect}
                />
              ))
            ) : (
              <div className="text-xs text-muted-foreground py-2 italic">
                No contacts in this bucket
              </div>
            )}
          </div>
        )
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Compact contact row (used for Scheduled + Needs Scheduling)
// ---------------------------------------------------------------------------

function ContactRow({
  contact,
  selected,
  onSelect,
}: {
  contact: CommunicationsContact;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(contact.id)}
      className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-muted/30 ${
        selected ? "bg-muted/40 border-l-2 border-foreground/50" : "border-l-2 border-transparent"
      }`}
    >
      <div className="flex-1 min-w-0">
        <span className="text-xs font-medium truncate">{contact.name}</span>
        {contact.firm ? (
          <span className="text-[10px] text-muted-foreground ml-1.5">· {contact.firm}</span>
        ) : null}
      </div>
      <div className="shrink-0 flex items-center gap-2">
        {contact.nextActionDueDate ? (
          <span className="text-[10px] text-sky-400">{fmtDate(contact.nextActionDueDate)}</span>
        ) : contact.lastTouch ? (
          <span className="text-[10px] text-muted-foreground">
            {CHANNEL_LABELS[contact.lastTouch.channel]} · {fmtDate(contact.lastTouch.touched_at)}
          </span>
        ) : null}
        <StrengthDots strength={contact.strength} />
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Mini contact card
// ---------------------------------------------------------------------------

function ContactCard({
  contact,
  selected,
  onSelect,
}: {
  contact: CommunicationsContact;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(contact.id)}
      className={`h-[90px] w-[130px] shrink-0 rounded-lg border bg-card p-2.5 text-left transition-colors hover:border-foreground/40 ${
        selected
          ? "border-foreground/70 ring-1 ring-foreground/30"
          : "border-border/60"
      }`}
    >
      <div className="text-xs font-medium leading-tight line-clamp-2">
        {contact.name}
      </div>
      <div className="mt-0.5 text-[10px] text-muted-foreground truncate">
        {contact.firm ?? "—"}
      </div>
      <div className="mt-1.5 flex items-center gap-1.5">
        {contact.lastTouch ? (
          <span className="text-muted-foreground">
            {CHANNEL_ICONS[contact.lastTouch.channel]}
          </span>
        ) : null}
        <StrengthDots strength={contact.strength} />
      </div>
      {contact.lastTouch ? (
        <div className="mt-0.5 text-[9px] text-muted-foreground/60">
          {fmtDate(contact.lastTouch.touched_at)}
        </div>
      ) : null}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </div>
  );
}

function StrengthDots({ strength }: { strength: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className={`h-1.5 w-1.5 rounded-full ${
            i < strength ? "bg-foreground/70" : "bg-muted-foreground/20"
          }`}
        />
      ))}
    </div>
  );
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}
