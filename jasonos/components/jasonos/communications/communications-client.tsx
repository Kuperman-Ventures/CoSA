"use client";

import { useState } from "react";
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
  Linkedin,
  List,
  Mail,
  MessageSquare,
  Phone,
  RefreshCw,
  Search,
  SlidersHorizontal,
  User,
  Video,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// ---------------------------------------------------------------------------
// Static wireframe data — real queries TBD
// ---------------------------------------------------------------------------

type Urgency = "today" | "this_week" | "next_week" | "needs_scheduling";
type Channel = "linkedin" | "email" | "phone" | "meeting" | "other";

interface CompanyPeer {
  id: string;
  name: string;
  title: string;
}

interface WireContact {
  id: string;
  name: string;
  title: string;
  company: string;
  strength: number; // 1–4 dots
  urgency: Urgency;
  group: string;
  lastTouchDate?: string;
  lastTouchChannel?: Channel;
  lastTouchSummary?: string;
  nextContact?: string;
  note?: string;
  companyPeers?: CompanyPeer[];
}

const WIRE_CONTACTS: WireContact[] = [
  {
    id: "1",
    name: "Frank Piechota",
    title: "Chief Revenue Officer",
    company: "GroundTruth",
    strength: 4,
    urgency: "today",
    group: "Strong Ties",
    lastTouchDate: "Mar 27, 2026",
    lastTouchChannel: "linkedin",
    lastTouchSummary: "Caught up on his new CRO role. He's focused on rebuilding the enterprise sales motion — seemed open to exploring advisory. Said to follow up in a month.",
    companyPeers: [
      { id: "7", name: "Rosie Omeara", title: "VP Marketing" },
    ],
  },
  {
    id: "2",
    name: "Corey Ferengui",
    title: "SVP Partnerships",
    company: "Aperiam",
    strength: 2,
    urgency: "today",
    group: "Warm Ties",
    lastTouchDate: "Mar 31, 2026",
    lastTouchChannel: "email",
    lastTouchSummary: "Brief email exchange about the AdTech landscape. He mentioned a potential new engagement but didn't give details. Worth following up.",
  },
  {
    id: "3",
    name: "Khurrum Malik",
    title: "VP Commerce Media",
    company: "Walmart",
    strength: 2,
    urgency: "today",
    group: "Strong Ties",
    lastTouchDate: "Mar 29, 2026",
    lastTouchChannel: "meeting",
    lastTouchSummary: "30-min virtual coffee. He's building out the Walmart Connect team and flagged a potential fractional CMO need for a sub-brand launch. Said he'd introduce me to the GM.",
    companyPeers: [
      { id: "4", name: "Seth Dallaire", title: "Chief Revenue Officer" },
    ],
  },
  {
    id: "4",
    name: "Seth Dallaire",
    title: "Chief Revenue Officer",
    company: "Walmart",
    strength: 2,
    urgency: "today",
    group: "Warm Ties",
    lastTouchDate: "Mar 24, 2026",
    lastTouchChannel: "linkedin",
    lastTouchSummary: "Commented on his post about retail media. He liked the comment and DM'd briefly. Mentioned he's in NYC next month.",
    companyPeers: [
      { id: "3", name: "Khurrum Malik", title: "VP Commerce Media" },
    ],
  },
  {
    id: "5",
    name: "Brent Sudduth",
    title: "SVP Strategy",
    company: "NBCU",
    strength: 1,
    urgency: "today",
    group: "Warm Ties",
    lastTouchDate: "Mar 19, 2026",
    lastTouchChannel: "email",
    lastTouchSummary: "Cold outreach follow-up. No reply yet — this would be the third touch. Consider changing the angle.",
    companyPeers: [
      { id: "12", name: "Kathy Saporito", title: "EVP Partnerships" },
    ],
  },
  {
    id: "6",
    name: "Jonathan Nelson",
    title: "CEO",
    company: "Omnicom",
    strength: 3,
    urgency: "next_week",
    group: "Inner Circle",
    lastTouchDate: "Apr 10, 2026",
    lastTouchChannel: "meeting",
    lastTouchSummary: "Dinner in NYC. Long conversation about agency evolution and AI. He's thinking about advisory structures. Promised to connect me with two people at Omnicom Digital.",
  },
  {
    id: "7",
    name: "Rosie Omeara",
    title: "VP Marketing",
    company: "GroundTruth",
    strength: 4,
    urgency: "next_week",
    group: "Strong Ties",
    lastTouchDate: "Apr 7, 2026",
    lastTouchChannel: "phone",
    lastTouchSummary: "30-min call. She's being considered for CMO. Asked for advice on how to navigate board expectations. Very engaged — strong relationship.",
    companyPeers: [
      { id: "1", name: "Frank Piechota", title: "Chief Revenue Officer" },
    ],
  },
  {
    id: "8",
    name: "Kira Rich",
    title: "Head of Agency Partnerships",
    company: "Google",
    strength: 4,
    urgency: "needs_scheduling",
    group: "Warm Ties",
    companyPeers: [
      { id: "10", name: "Simon Kahn", title: "Managing Director" },
      { id: "11", name: "Suzanne Dalcourt", title: "Director, Partnerships" },
    ],
  },
  {
    id: "9",
    name: "Conrad Tallariti",
    title: "Chief Marketing Officer",
    company: "DoubleVerify",
    strength: 4,
    urgency: "needs_scheduling",
    group: "Strong Ties",
    note: "HP",
  },
  {
    id: "10",
    name: "Simon Kahn",
    title: "Managing Director",
    company: "Google",
    strength: 4,
    urgency: "needs_scheduling",
    group: "Warm Ties",
    companyPeers: [
      { id: "8", name: "Kira Rich", title: "Head of Agency Partnerships" },
      { id: "11", name: "Suzanne Dalcourt", title: "Director, Partnerships" },
    ],
  },
  {
    id: "11",
    name: "Suzanne Dalcourt",
    title: "Director, Partnerships",
    company: "Google",
    strength: 4,
    urgency: "needs_scheduling",
    group: "Warm Ties",
    companyPeers: [
      { id: "8", name: "Kira Rich", title: "Head of Agency Partnerships" },
      { id: "10", name: "Simon Kahn", title: "Managing Director" },
    ],
  },
  {
    id: "12",
    name: "Kathy Saporito",
    title: "EVP Partnerships",
    company: "NBCU",
    strength: 4,
    urgency: "needs_scheduling",
    group: "Strong Ties",
    companyPeers: [
      { id: "5", name: "Brent Sudduth", title: "SVP Strategy" },
    ],
  },
  {
    id: "13",
    name: "Lisa Utzschneider",
    title: "Chief Executive Officer",
    company: "Integral Ad Science",
    strength: 4,
    urgency: "needs_scheduling",
    group: "Strong Ties",
  },
  {
    id: "14",
    name: "Minna Song",
    title: "Head of Growth",
    company: "EliseAI",
    strength: 4,
    urgency: "needs_scheduling",
    group: "Warm Ties",
    note: "⚠ overdue",
  },
  {
    id: "15",
    name: "Adrienne Lahens",
    title: "VP Brand Strategy",
    company: "Netflix",
    strength: 3,
    urgency: "this_week",
    group: "Strong Ties",
    lastTouchDate: "Apr 16, 2026",
    lastTouchChannel: "linkedin",
    lastTouchSummary: "Connected over her content/commerce post. She replied with interest and suggested a call.",
  },
  {
    id: "16",
    name: "Chloe Sladden",
    title: "Partner",
    company: "Andreessen Horowitz",
    strength: 3,
    urgency: "this_week",
    group: "Warm Ties",
    lastTouchDate: "Apr 14, 2026",
    lastTouchChannel: "email",
    lastTouchSummary: "Sent a note about the Refactor Sprint model. She expressed interest in a portfolio company introduction.",
  },
  {
    id: "17",
    name: "Ian Schafer",
    title: "Chief Innovation Officer",
    company: "Dentsu",
    strength: 2,
    urgency: "this_week",
    group: "Alumni",
    lastTouchDate: "Apr 18, 2026",
    lastTouchChannel: "meeting",
    lastTouchSummary: "Coffee in Midtown. Talked about the AI creative services opportunity. He's open to co-creating something together.",
  },
];

const URGENCY_CONFIG: Record<Urgency, {
  label: string;
  helper: string;
  icon: React.ReactNode;
  color: string;
  headerBg: string;
}> = {
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

const CHANNEL_ICONS: Record<Channel, React.ReactNode> = {
  linkedin: <Linkedin className="h-3.5 w-3.5" />,
  email: <Mail className="h-3.5 w-3.5" />,
  phone: <Phone className="h-3.5 w-3.5" />,
  meeting: <Video className="h-3.5 w-3.5" />,
  other: <MessageSquare className="h-3.5 w-3.5" />,
};

const CHANNEL_LABELS: Record<Channel, string> = {
  linkedin: "LinkedIn",
  email: "Email",
  phone: "Phone",
  meeting: "Meeting",
  other: "Other",
};

const NEXT_CONTACT_OPTIONS = [
  { label: "ASAP", value: "asap" },
  { label: "Next week", value: "next_week" },
  { label: "2 weeks", value: "2_weeks" },
  { label: "1 month", value: "1_month" },
  { label: "3 months", value: "3_months" },
  { label: "Custom…", value: "custom" },
];

const CADENCE_OPTIONS = [
  { label: "No repeat", value: "none" },
  { label: "Monthly", value: "monthly" },
  { label: "Quarterly", value: "quarterly" },
  { label: "Every 6 months", value: "6_months" },
  { label: "Annually", value: "annually" },
];

// ---------------------------------------------------------------------------
// Main layout — 3 columns
// ---------------------------------------------------------------------------

export function CommunicationsClient() {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [listView, setListView] = useState<"list" | "grid">("list");
  const [sort, setSort] = useState("Last contact");

  const selectedContact = selectedId
    ? WIRE_CONTACTS.find((c) => c.id === selectedId) ?? null
    : null;

  const filteredForList = WIRE_CONTACTS.filter((c) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.company.toLowerCase().includes(q)
    );
  });

  const handleSelect = (id: string) => {
    setSelectedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="flex h-[calc(100vh-3rem)] overflow-hidden">
      {/* ------------------------------------------------------------------ */}
      {/* LEFT COLUMN — Contact list                                          */}
      {/* ------------------------------------------------------------------ */}
      <aside className="flex w-72 shrink-0 flex-col border-r bg-card/50">
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
            const isSelected = selectedId === contact.id;
            return (
              <button
                key={contact.id}
                type="button"
                onClick={() => handleSelect(contact.id)}
                className={`w-full px-3 py-2.5 text-left transition-colors hover:bg-muted/40 ${
                  isSelected ? "bg-muted/60 border-l-2 border-foreground/60" : "border-l-2 border-transparent"
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
                    {contact.lastTouchDate ? (
                      <span className="text-[10px] text-muted-foreground">
                        {contact.lastTouchChannel ? CHANNEL_LABELS[contact.lastTouchChannel] : ""} · {contact.lastTouchDate}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="mt-0.5">
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
      {/* MIDDLE COLUMN — Outreach Grid                                       */}
      {/* ------------------------------------------------------------------ */}
      <div className={`flex flex-col overflow-hidden border-r transition-all ${selectedContact ? "flex-1" : "flex-1"}`}>
        <div className="flex items-center justify-between border-b bg-muted/20 px-4 py-2 shrink-0">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold tracking-tight">Outreach Grid</span>
          </div>
          <Badge variant="secondary" className="text-[10px]">Wireframe · static data</Badge>
        </div>

        <div className="flex-1 overflow-y-auto">
          {URGENCY_ORDER.map((urgency) => {
            const contacts = WIRE_CONTACTS.filter((c) => c.urgency === urgency);
            return (
              <UrgencySection
                key={urgency}
                urgency={urgency}
                contacts={contacts}
                selectedId={selectedId}
                onSelect={handleSelect}
              />
            );
          })}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* RIGHT COLUMN — Contact detail                                       */}
      {/* ------------------------------------------------------------------ */}
      {selectedContact ? (
        <ContactDetailPanel
          contact={selectedContact}
          onSelectPeer={handleSelect}
        />
      ) : (
        <div className="hidden w-80 shrink-0 items-center justify-center border-l bg-muted/10 text-xs text-muted-foreground lg:flex">
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
}: {
  contact: WireContact;
  onSelectPeer: (id: string) => void;
}) {
  const [nextContact, setNextContact] = useState("next_week");
  const [cadence, setCadence] = useState("quarterly");

  return (
    <aside className="flex w-80 shrink-0 flex-col border-l bg-card/60 overflow-y-auto">
      {/* Header */}
      <div className="border-b p-4 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold tracking-tight leading-tight">{contact.name}</h2>
            {contact.title ? (
              <div className="text-xs text-muted-foreground mt-0.5">{contact.title}</div>
            ) : null}
          </div>
          <StrengthDots strength={contact.strength} />
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Building2 className="h-3.5 w-3.5 shrink-0" />
          <span className="font-medium text-foreground/80">{contact.company}</span>
        </div>
      </div>

      <div className="flex flex-col gap-4 p-4">

        {/* Last contact */}
        <section className="space-y-1.5">
          <SectionLabel>Last Contact</SectionLabel>
          {contact.lastTouchDate ? (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-sm">
                {contact.lastTouchChannel ? (
                  <span className="text-muted-foreground">
                    {CHANNEL_ICONS[contact.lastTouchChannel]}
                  </span>
                ) : null}
                <span className="font-medium">
                  {contact.lastTouchChannel
                    ? CHANNEL_LABELS[contact.lastTouchChannel]
                    : "Unknown"}
                </span>
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground text-xs">{contact.lastTouchDate}</span>
              </div>
              {contact.lastTouchSummary ? (
                <p className="text-xs leading-relaxed text-foreground/80 rounded-md border bg-muted/30 p-2.5">
                  {contact.lastTouchSummary}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">No contact recorded yet.</p>
          )}
        </section>

        {/* Next contact scheduler */}
        <section className="space-y-2">
          <SectionLabel>Schedule Next Touch</SectionLabel>
          <div className="grid grid-cols-3 gap-1">
            {NEXT_CONTACT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setNextContact(opt.value)}
                className={`rounded-md border px-2 py-1.5 text-[11px] font-medium transition-colors ${
                  nextContact === opt.value
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
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <Button size="sm" className="w-full">
            <Calendar className="h-3.5 w-3.5 mr-1.5" />
            Set Schedule
          </Button>
        </section>

        {/* Others at company */}
        {contact.companyPeers?.length ? (
          <section className="space-y-2">
            <SectionLabel>
              Others at {contact.company} ({contact.companyPeers.length})
            </SectionLabel>
            <div className="space-y-1">
              {contact.companyPeers.map((peer) => (
                <button
                  key={peer.id}
                  type="button"
                  onClick={() => onSelectPeer(peer.id)}
                  className="w-full flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2 text-left transition-colors hover:bg-muted/60 hover:border-foreground/30"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-medium truncate">{peer.name}</div>
                    <div className="text-[10px] text-muted-foreground truncate">{peer.title}</div>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {/* Placeholder: more coming */}
        <section className="rounded-md border border-dashed border-border/50 p-3 text-center text-[11px] text-muted-foreground space-y-0.5">
          <div className="font-medium text-foreground/50">More coming here</div>
          <div>Message composer · Activity log · AI draft</div>
        </section>
      </div>
    </aside>
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
            Array.from({ length: 6 }).map((_, i) => (
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
      className={`h-[88px] w-[130px] shrink-0 rounded-lg border bg-card p-2.5 text-left transition-colors hover:border-foreground/40 hover:bg-card/90 ${
        selected
          ? "border-foreground/70 ring-1 ring-foreground/30"
          : "border-border/60"
      }`}
    >
      <div className="text-xs font-medium leading-tight line-clamp-2">{contact.name}</div>
      <div className="mt-0.5 text-[10px] text-muted-foreground truncate">{contact.company}</div>
      {contact.note ? (
        <div className="mt-1 text-[10px] text-amber-400">{contact.note}</div>
      ) : null}
      {contact.lastTouchChannel ? (
        <div className="mt-1 flex items-center gap-1 text-muted-foreground">
          {CHANNEL_ICONS[contact.lastTouchChannel]}
        </div>
      ) : null}
      <div className="mt-1">
        <StrengthDots strength={contact.strength} />
      </div>
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
