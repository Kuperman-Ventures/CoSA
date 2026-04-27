import type { Intent } from "@/lib/triage/types";

export interface DraftContext {
  firstName: string;
  firm?: string;
  specialty?: string;
  personalGoal?: string;
  channel: "linkedin" | "email";
}

export function generateDraft(intent: Intent, ctx: DraftContext): string {
  const firmText = ctx.firm ? ` at ${ctx.firm}` : "";
  const specialtyText = ctx.specialty ? ` in ${ctx.specialty}` : "";
  const goalText = ctx.personalGoal
    ? ctx.personalGoal.trim().replace(/\.$/, "")
    : null;

  switch (intent) {
    case "door":
      return [
        `Hi ${ctx.firstName} - hope you're well.`,
        "",
        goalText
          ? `I've been focused on ${goalText} and your work${firmText}${specialtyText} keeps coming up.`
          : `I've been focused on a few specific things lately and your work${firmText}${specialtyText} keeps coming up.`,
        "",
        "Would you be open to a 20-min call to swap notes? Happy to bring something useful from my end.",
        "",
        "- Jason",
      ].join("\n");

    case "pipeline":
      return [
        `Hi ${ctx.firstName} - hope you're well.`,
        "",
        `I'm running fractional CMO engagements and 72-hour GTM diagnostics ("Refactor Sprints") with B2B SaaS scale-ups${specialtyText ? ` - heavy in ${ctx.specialty} lately` : ""}.`,
        goalText
          ? `Specifically: ${goalText}.`
          : `Given the work you do${firmText}, I thought there might be overlap.`,
        "",
        "Worth 15 min to compare notes?",
        "",
        "- Jason",
      ].join("\n");

    case "role_inquiry":
      return [
        `Hi ${ctx.firstName} - long time.`,
        "",
        `I'm exploring CMO and Fractional roles${specialtyText ? ` in ${ctx.specialty}` : ""}, and given your visibility${firmText}, I wanted to ask:`,
        goalText
          ? `${goalText.charAt(0).toUpperCase()}${goalText.slice(1)}?`
          : "Who should I be talking to right now?",
        "",
        "Open to a quick call in the next two weeks?",
        "",
        "- Jason",
      ].join("\n");

    case "intel":
      return [
        `Hi ${ctx.firstName} - Jason here.`,
        "",
        goalText
          ? `I'm trying to get smarter about ${goalText} and your perspective${firmText} would be invaluable.`
          : `I'm trying to get smarter about a few specific market questions and your perspective${firmText} would be invaluable.`,
        "",
        "15 min on the phone in the next two weeks?",
        "",
        "- Jason",
      ].join("\n");

    case "warm":
      return [
        `Hi ${ctx.firstName} - wanted to reach out and check in.`,
        "",
        `It's been a while. How are things${firmText}? Would love to grab a coffee or call when convenient.`,
        "",
        "- Jason",
      ].join("\n");
  }
}

export function extractFirstName(fullName: string): string {
  const trimmed = fullName.trim();
  const space = trimmed.indexOf(" ");
  return space > 0 ? trimmed.slice(0, space) : trimmed;
}
