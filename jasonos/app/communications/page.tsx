import { Suspense } from "react";
import { getCommunicationsData } from "@/lib/server-actions/communications";
import { isGmailConnected } from "@/lib/integrations/gmail";
import { CommunicationsClient } from "@/components/jasonos/communications/communications-client";

export const metadata = { title: "Communications · JasonOS" };

export default async function CommunicationsPage() {
  const [contacts, gmailConnected] = await Promise.all([
    getCommunicationsData(),
    isGmailConnected(),
  ]);
  return (
    <Suspense>
      <CommunicationsClient contacts={contacts} gmailConnected={gmailConnected} />
    </Suspense>
  );
}
