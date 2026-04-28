"use client";

import { useState } from "react";
import {
  AlertCircle,
  Calendar,
  CalendarClock,
  ChevronDown,
  ChevronUp,
  Clock,
  HelpCircle,
  LayoutGrid,
  List,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// ---------------------------------------------------------------------------
// Static wireframe data — real queries TBD
// ---------------------------------------------------------------------------

const RELATIONSHIP_GROUPS = [
  "Inner Circle",
  "Strong Ties",
  "Warm Ties",
  "Weak Ties",
  "Dormant",
  "Personal",
  "Alumni",
  "Recruiters",
  "Aspirational",
  "Content / Vis.",
];

type Urgency = "today" | "this_week" | "next_week" | "needs_scheduling";

interface WireContact {
  id: string;
  name: string;
  company: string;
  strength: number; // 1–4 dots
  urgency: Urgency;
  group: string;
  lastTouch?: string;
  note?: string;
}

const WIRE_CONTACTS: WireContact[] = [
  { id: "1", name: "Frank Piechota", company: "GroundTruth", strength: 4, urgency: "today", group: "Strong Ties", lastTouch: "32d ago" },
  { id: "2", name: "Corey Ferengui", company: "Aperiam", strength: 2, urgency: "today", group: "Warm Ties", lastTouch: "28d ago" },
  { id: "3", name: "Khurrum Malik", company: "Walmart", strength: 2, urgency: "today", group: "Strong Ties", lastTouch: "30d ago" },
  { id: "4", name: "Seth Dallaire", company: "Walmart", strength: 2, urgency: "today", group: "Warm Ties", lastTouch: "35d ago" },
  { id: "5", name: "Brent Sudduth", company: "NBCU", strength: 1, urgency: "today", group: "Warm Ties", lastTouch: "40d ago" },
  { id: "6", name: "Jonathan Nelson", company: "Omnicom", strength: 3, urgency: "next_week", group: "Inner Circle", lastTouch: "18d ago" },
  { id: "7", name: "Rosie Omeara", company: "GroundTruth", strength: 4, urgency: "next_week", group: "Strong Ties", lastTouch: "22d ago" },
  { id: "8", name: "Kira Rich", company: "Google", strength: 4, urgency: "needs_scheduling", group: "Warm Ties" },
  { id: "9", name: "Conrad Tallariti", company: "DoubleVerify", strength: 4, urgency: "needs_scheduling", group: "Strong Ties" },
  { id: "10", name: "Simon Kahn", company: "Google", strength: 4, urgency: "needs_scheduling", group: "Warm Ties" },
  { id: "11", name: "Suzanne Dalcourt", company: "Google", strength: 4, urgency: "needs_scheduling", group: "Warm Ties" },
  { id: "12", name: "Kathy Saporito", company: "NBCU", strength: 4, urgency: "needs_scheduling", group: "Strong Ties" },
  { id: "13", name: "Lisa Utzschneider", company: "Integral Ad Science", strength: 4, urgency: "needs_scheduling", group: "Strong Ties" },
  { id: "14", name: "Minna Song", company: "EliseAI", strength: 4, urgency: "needs_scheduling", group: "Warm Ties", note: "⚠ overdue" },
  { id: "15", name: "Adrienne Lahens", company: "Netflix", strength: 3, urgency: "this_week", group: "Strong Ties", lastTouch: "12d ago" },
  { id: "16", name: "Chloe Sladden", company: "Andreessen", strength: 3, urgency: "this_week", group: "Warm Ties", lastTouch: "14d ago" },
  { id: "17", name: "Ian Schafer", company: "Dentsu", strength: 2, urgency: "this_week", group: "Alumni", lastTouch: "10d ago" },
];

const URGENCY_CONFIG: Record<Urgency, { label: string; helper: string; icon: React.ReactNode; color: string; headerBg: string }> = {
  today: {
    label: "Urgent — Reach Out Today",
    helper: "Past their scheduled next touch",
    icon: <AlertCircle className="h-4 w-4" />,
    color: "text-red-300",
    headerBg: "bg-red-700/80",
  },
  this_week: {
    label: "This Week",
    helper: "Due for outreach in the next 7 days",
    icon: <Clock className="h-4 w-4" />,
    color: "text-amber-300",
    headerBg: "bg-amber-600/70",
  },
  next_week: {
    label: "Next Week",
    helper: "Coming up in 8–14 days — plan ahead",
    icon: <Calendar className="h-4 w-4" />,
    color: "text-blue-300",
    headerBg: "bg-blue-700/70",
  },
  needs_scheduling: {
    label: "Needs Scheduling",
    helper: "No next touch date set — set a cadence to activate",
    icon: <HelpCircle className="h-4 w-4" />,
    color: "text-muted-foreground",
    headerBg: "bg-muted/60",
  },
};

const URGENCY_ORDER: Urgency[] = ["today", "this_week", "next_week", "needs_scheduling"];

const SORT_OPTIONS = ["Last contact", "Relationship tier", "Company", "Priority score"];

// ---------------------------------------------------------------------------
// Main layout
// ---------------------------------------------------------------------------

export function CommunicationsClient() {
  const [activeGroup, setActiveGroup] = useState("All");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [listView, setListView] = useState<"list" | "grid">("list");
  const [sort, setSort] = useState("Last contact");

  const groups = ["All", ...RELATIONSHIP_GROUPS];

  const filteredForGrid = WIRE_CONTACTS.filter((c) => {
    if (activeGroup !== "All" && c.group !== activeGroup) return false;
    return true;
  });

  const filteredForList = WIRE_CONTACTS.filter((c) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.company.toLowerCase().includes(q);
  });

  return (
    <div className="flex h-[calc(100vh-3rem)] overflow-hidden">
      {/* ------------------------------------------------------------------ */}
      {/* LEFT COLUMN — Contact list                                          */}
      {/* ------------------------------------------------------------------ */}
      <aside className="flex w-80 shrink-0 flex-col border-r bg-card/50">
        <div className="border-b p-3 space-y-2">
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
              placeholder="Search name or company..."
              className="pl-7 h-8 text-xs"
            />
          </div>

          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="flex-1 bg-transparent text-xs text-muted-foreground border border-border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>

          {/* Wireframe placeholder filters */}
          <div className="flex flex-wrap gap-1">
            {["Urgent", "This week", "Needs cadence"].map((chip) => (
              <button
                key={chip}
                type="button"
                className="rounded-full border px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                {chip}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-border/50">
          {filteredForList.map((contact) => {
            const urgency = URGENCY_CONFIG[contact.urgency];
            return (
              <button
                key={contact.id}
                type="button"
                onClick={() => setSelectedId(contact.id === selectedId ? null : contact.id)}
                className={`w-full px-3 py-2.5 text-left transition-colors hover:bg-muted/40 ${
                  selectedId === contact.id ? "bg-muted/60" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium truncate">{contact.name}</span>
                      {contact.note ? (
                        <span className="text-[10px] text-amber-400">{contact.note}</span>
                      ) : null}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{contact.company}</div>
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-1">
                    <StrengthDots strength={contact.strength} />
                    {contact.lastTouch ? (
                      <span className="text-[10px] text-muted-foreground">{contact.lastTouch}</span>
                    ) : (
                      <span className={`text-[10px] ${urgency.color}`}>No cadence</span>
                    )}
                  </div>
                </div>
                <div className="mt-1">
                  <span className={`text-[10px] font-medium ${urgency.color}`}>
                    {urgency.label}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        <div className="border-t p-2 text-center text-[11px] text-muted-foreground">
          {filteredForList.length} contacts · more intelligence coming soon
        </div>
      </aside>

      {/* ------------------------------------------------------------------ */}
      {/* RIGHT COLUMN — Working modules                                      */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Module 1: Outreach Grid */}
        <section className="flex flex-col overflow-hidden border-b">
          <div className="flex items-center justify-between border-b bg-muted/20 px-4 py-2">
            <div className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold tracking-tight">Outreach Grid</span>
              <Badge variant="outline" className="text-[10px]">Who to reach out to, by relationship group</Badge>
            </div>
            <Badge variant="secondary" className="text-[10px]">Wireframe · static data</Badge>
          </div>

          {/* Group tabs */}
          <div className="flex overflow-x-auto border-b bg-card/40 px-2 py-1 gap-1 scrollbar-none">
            {groups.map((group) => (
              <button
                key={group}
                type="button"
                onClick={() => setActiveGroup(group)}
                className={`shrink-0 rounded px-2.5 py-1 text-xs transition-colors whitespace-nowrap ${
                  activeGroup === group
                    ? "bg-foreground text-background font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {group}
              </button>
            ))}
          </div>

          {/* Urgency sections */}
          <div className="flex-1 overflow-y-auto">
            {URGENCY_ORDER.map((urgency) => {
              const contacts = filteredForGrid.filter((c) => c.urgency === urgency);
              return (
                <UrgencySection
                  key={urgency}
                  urgency={urgency}
                  contacts={contacts}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                />
              );
            })}
          </div>
        </section>

        {/* Module 2: Placeholder */}
        <section className="flex flex-1 items-center justify-center bg-muted/10 text-sm text-muted-foreground">
          <div className="text-center space-y-1">
            <div className="text-base font-medium text-foreground/50">More modules coming here</div>
            <div className="text-xs">Message composer · Activity feed · Notes · Analytics</div>
          </div>
        </section>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Urgency section
// ---------------------------------------------------------------------------

function UrgencySection({
  urgency,
  contacts,
  selectedId,
  onSelect,
}: {
  urgency: Urgency;
  contacts: WireContact[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const config = URGENCY_CONFIG[urgency];

  return (
    <div>
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left ${config.headerBg}`}
      >
        <div className="flex items-center gap-2">
          <span className={config.color}>{config.icon}</span>
          <div>
            <div className={`text-sm font-semibold ${config.color}`}>{config.label}</div>
            <div className="text-[11px] text-white/60">{config.helper}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {contacts.length > 0 ? (
            <span className="text-xs font-medium text-white/80">{contacts.length} contacts</span>
          ) : null}
          {collapsed ? (
            <ChevronDown className="h-4 w-4 text-white/60" />
          ) : (
            <ChevronUp className="h-4 w-4 text-white/60" />
          )}
        </div>
      </button>

      {!collapsed ? (
        <div className="flex gap-3 overflow-x-auto px-4 py-3 scrollbar-none bg-card/20">
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
            // Empty slots
            Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="h-[80px] w-[130px] shrink-0 rounded-lg border border-dashed border-border/30"
              />
            ))
          )}
        </div>
      ) : null}
    </div>
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
  contact: WireContact;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(contact.id)}
      className={`h-[80px] w-[130px] shrink-0 rounded-lg border bg-card p-2.5 text-left transition-colors hover:border-foreground/40 hover:bg-card/90 ${
        selected ? "border-foreground/70 ring-1 ring-foreground/30" : "border-border/60"
      }`}
    >
      <div className="text-xs font-medium leading-tight line-clamp-2">{contact.name}</div>
      <div className="mt-0.5 text-[10px] text-muted-foreground truncate">{contact.company}</div>
      {contact.note ? (
        <div className="mt-1 text-[10px] text-amber-400">{contact.note}</div>
      ) : null}
      <div className="mt-1.5">
        <StrengthDots strength={contact.strength} />
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Strength dots
// ---------------------------------------------------------------------------

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
