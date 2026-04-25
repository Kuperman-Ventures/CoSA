import { getReconnectDashboardData } from "@/lib/reconnect/data";
import type {
  RecruiterSource,
  RecruiterStatus,
  RecruiterTier,
} from "@/lib/reconnect/types";
import { ReconnectContactsClient } from "@/components/jasonos/reconnect/contacts-client";

export const metadata = { title: "Reconnect Contacts · JasonOS" };
export const dynamic = "force-dynamic";

const TIERS: RecruiterTier[] = ["TIER 1", "TIER 2", "TIER 3", "TIER 4"];
const STATUSES: RecruiterStatus[] = [
  "queue",
  "sent",
  "replied",
  "in_conversation",
  "live_role",
  "closed",
  "snoozed",
  "archived",
];
const SOURCES: RecruiterSource[] = ["LeadDelta", "Outlook (new)", "HubSpot (new)", "Both"];

export default async function ReconnectContactsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const data = await getReconnectDashboardData();

  return (
    <ReconnectContactsClient
      contacts={data.contacts}
      initialTier={pick(params.tier, TIERS)}
      initialStatus={pick(params.status, STATUSES)}
      initialSource={pick(params.source, SOURCES)}
      initialQ={typeof params.q === "string" ? params.q : ""}
    />
  );
}

function pick<T extends string>(value: string | string[] | undefined, allowed: T[]): T[] {
  const raw = Array.isArray(value) ? value.join(",") : value ?? "";
  return raw
    .split(",")
    .map((v) => v.trim())
    .filter((v): v is T => allowed.includes(v as T));
}
