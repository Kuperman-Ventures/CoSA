import { Suspense } from "react";
import { getCommunicationsData } from "@/lib/server-actions/communications";
import { CommunicationsClient } from "@/components/jasonos/communications/communications-client";

export const metadata = { title: "Communications · JasonOS" };

export default async function CommunicationsPage() {
  const contacts = await getCommunicationsData();
  return (
    <Suspense>
      <CommunicationsClient contacts={contacts} />
    </Suspense>
  );
}
