import type { ReconnectContact } from "./types";

export type FunnelStage = "not_contacted" | "contacted" | "replied" | "meeting" | "closed";

export const FUNNEL_LABELS: Record<FunnelStage, string> = {
  not_contacted: "Not contacted",
  contacted: "Sent",
  replied: "Replied",
  meeting: "Meeting booked",
  closed: "Closed / no response",
};

const ACTIVE_INTENTS = ["door", "pipeline", "role_inquiry"];

export function isPriorityContact(contact: ReconnectContact): boolean {
  return (
    (contact.strategic_score ?? 0) >= 80 ||
    ACTIVE_INTENTS.includes(contact.intent ?? "")
  );
}

export function getFunnelStage(contact: ReconnectContact): FunnelStage {
  const firstContactStage = contact.first_contact?.stage;
  if (firstContactStage) {
    if (firstContactStage === "identified") return "not_contacted";
    if (["connect_sent", "dm_sent", "email_sent"].includes(firstContactStage)) {
      return "contacted";
    }
    if (["connect_accepted", "dm_replied", "email_replied"].includes(firstContactStage)) {
      return "replied";
    }
    if (["meeting_scheduled", "completed"].includes(firstContactStage)) return "meeting";
    if (firstContactStage === "closed_no_response") return "closed";
  }

  const status = contact.state?.status;
  if (status === "queue") return "not_contacted";
  if (status === "sent") return "contacted";
  if (status === "replied") return "replied";
  if (status === "in_conversation" || status === "live_role") return "meeting";
  return "closed";
}

export interface PriorityFunnelStats {
  total: number;
  byStage: Record<FunnelStage, number>;
  notContactedContacts: ReconnectContact[];
  awaitingReplyContacts: ReconnectContact[];
}

export function computePriorityFunnel(contacts: ReconnectContact[]): PriorityFunnelStats {
  const priority = contacts.filter(isPriorityContact);
  const byStage: Record<FunnelStage, number> = {
    not_contacted: 0,
    contacted: 0,
    replied: 0,
    meeting: 0,
    closed: 0,
  };

  for (const contact of priority) {
    byStage[getFunnelStage(contact)] += 1;
  }

  const notContactedContacts = priority
    .filter((contact) => getFunnelStage(contact) === "not_contacted")
    .sort(comparePriorityContacts)
    .slice(0, 10);

  const awaitingReplyContacts = priority
    .filter((contact) => {
      if (getFunnelStage(contact) !== "contacted") return false;
      const updatedAt = contact.state?.updated_at;
      if (!updatedAt) return false;
      const daysSince = (Date.now() - new Date(updatedAt).getTime()) / (1000 * 60 * 60 * 24);
      return daysSince >= 5;
    })
    .sort(comparePriorityContacts)
    .slice(0, 10);

  return { total: priority.length, byStage, notContactedContacts, awaitingReplyContacts };
}

function comparePriorityContacts(a: ReconnectContact, b: ReconnectContact) {
  const byScore = (b.strategic_score ?? 0) - (a.strategic_score ?? 0);
  if (byScore) return byScore;
  return a.name.localeCompare(b.name);
}
