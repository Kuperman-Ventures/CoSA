import type { RecruiterStatus } from "./types";

export const RECRUITER_STATUS_LABELS: Record<RecruiterStatus, string> = {
  queue: "Queue",
  sent: "Sent",
  replied: "Replied",
  in_conversation: "In conversation",
  live_role: "Live role",
  closed: "Closed",
  snoozed: "Snoozed",
  archived: "Archived",
};
