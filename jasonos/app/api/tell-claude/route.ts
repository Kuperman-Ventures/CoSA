import { tellClaude, type TellClaudeContext } from "@/lib/ai/tell-claude";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const body = (await req.json()) as {
    instruction: string;
    context: TellClaudeContext;
  };
  const result = await tellClaude(body);
  return result.toTextStreamResponse();
}
