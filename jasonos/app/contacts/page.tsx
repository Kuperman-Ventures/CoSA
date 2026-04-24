import {
  isContactsConfigured,
  listContactsWithScores,
  getRunnerState,
  getExistingTier1Cards,
} from "@/lib/data/contacts";
import { RUNNER_ID, TASK_ID } from "@/lib/contacts/runner";
import { Tier1RankerPage } from "@/components/jasonos/tier1-ranker-page";

export const metadata = { title: "Contacts · JasonOS" };
export const dynamic = "force-dynamic";

export default async function ContactsPage() {
  const configured = isContactsConfigured();

  const [contacts, runnerState, existingPicks] = await Promise.all([
    listContactsWithScores(),
    getRunnerState(RUNNER_ID, TASK_ID),
    getExistingTier1Cards(),
  ]);

  return (
    <Tier1RankerPage
      contacts={contacts}
      initialState={runnerState}
      existingPicks={existingPicks}
      configured={configured}
    />
  );
}
