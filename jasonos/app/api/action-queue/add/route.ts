// POST /api/action-queue/add
// Pushes a card into jasonos.cards. Used by Morning Brief "Add to Queue"
// (Crunchbase ICP hits) and any future surface that wants to enqueue work.

import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const TRACKS = ["venture", "advisors", "job_search", "personal"] as const;

const PayloadSchema = z.object({
  source: z.string().min(1),                   // 'crunchbase', 'morning_brief', ...
  track: z.enum(TRACKS).default("advisors"),
  title: z.string().min(1).max(240),
  subtitle: z.string().max(280).optional(),
  template: z.string().max(4000).optional(),
  whyNow: z.string().max(280).optional(),
  module: z.string().min(1).default("morning_brief"),
  externalRefs: z.record(z.string(), z.string()).optional(),
  vip: z.boolean().optional(),
  priorityScore: z.number().min(0).max(1).optional(),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  const parsed = PayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "invalid_payload", issues: parsed.error.issues },
      { status: 400 }
    );
  }
  const p = parsed.data;

  const sbConfigured =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!sbConfigured) {
    return NextResponse.json({
      ok: false,
      persisted: false,
      error: "Supabase service role missing. Configure SUPABASE_SERVICE_ROLE_KEY to persist action cards.",
    }, { status: 503 });
  }

  try {
    const sb = createServiceRoleClient();
    const insertable = {
      track: p.track,
      module: p.module,
      object_type: "outreach",
      title: p.title,
      subtitle: p.subtitle,
      body: p.template ? { draft: p.template } : null,
      linked_object_ids: p.externalRefs ?? {},
      priority_score: p.priorityScore ?? null,
      state: "open" as const,
      vip: p.vip ?? false,
      why_now: p.whyNow,
      verbs: ["send", "edit_send", "snooze", "dismiss", "tell_claude"],
    };
    const { data, error } = await sb.from("cards").insert(insertable).select("*").single();
    if (error) throw error;
    return NextResponse.json({ ok: true, persisted: true, card: data });
  } catch (err) {
    console.error("[/api/action-queue/add] insert failed:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
