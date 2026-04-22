// Universal "Tell Claude" override (spec §7)
// Streams a short response back to the UI. Context is whatever object the
// user is focused on (card, project, todo) plus the natural-language ask.

import { streamText } from "ai";
import { fastModel } from "./models";

export interface TellClaudeContext {
  scope: "global" | "card" | "todo" | "project" | "tile";
  payload?: unknown;
}

const SYSTEM = `You are Claude, Jason's chief of staff inside JasonOS. Be terse,
specific, and action-oriented. When the user asks you to change something
(reorder, draft, snooze, replan, etc.) respond with:
1) one short confirmation sentence,
2) the proposed change as a fenced JSON block named \`change\`,
3) optional caveats.
Never invent contacts, deals, or numbers. If the context is missing the data
you need, ask for it in one short clarifying question.`;

export async function tellClaude(opts: {
  instruction: string;
  context: TellClaudeContext;
}) {
  return streamText({
    model: fastModel,
    system: SYSTEM,
    prompt: `Context (${opts.context.scope}):
${JSON.stringify(opts.context.payload ?? null, null, 2)}

Instruction:
${opts.instruction}`,
  });
}
