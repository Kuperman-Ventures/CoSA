export type FirstContactStage =
  | "identified"
  | "connect_sent"
  | "connect_accepted"
  | "dm_sent"
  | "dm_replied"
  | "email_sent"
  | "email_replied"
  | "meeting_scheduled"
  | "completed"
  | "closed_no_response";

export type FirstContactDraftStage =
  | "connect_request"
  | "linkedin_dm"
  | "email_followup";

export interface FirstContactStageEvent {
  stage: FirstContactStage;
  at: string;
  draft?: string;
  note?: string;
}

export interface FirstContactState {
  stage: FirstContactStage;
  history: FirstContactStageEvent[];
}
