// GET/POST/PATCH /api/dispatch/requests
// Public-schema bridge for async requests handled by the external Dispatch worker.

import { NextResponse } from "next/server";
import { z } from "zod";
import { createPublicClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DispatchRequestSchema = z.object({
  requestType: z.string().min(1).max(120),
  context: z.record(z.string(), z.unknown()).default({}),
  sourcePage: z.string().min(1).max(240),
});

const MarkViewedSchema = z.object({
  ids: z.array(z.uuid()).default([]),
});

interface DispatchRequestRow {
  id: string;
  status: "pending" | "processing" | "completed" | "failed";
  request_type: string;
  context: Record<string, unknown>;
  response: string | null;
  response_metadata: Record<string, unknown> | null;
  source_page: string | null;
  created_at: string;
  completed_at: string | null;
  viewed_at: string | null;
}

function isConfigured() {
  return !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}

async function getAuthedClient() {
  if (!isConfigured()) {
    return { error: NextResponse.json({ ok: false, error: "supabase_not_configured" }, { status: 503 }) };
  }

  const supabase = await createPublicClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return { error: NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 }) };
  }

  return { supabase, user: data.user };
}

export async function GET() {
  const auth = await getAuthedClient();
  if ("error" in auth) return auth.error;

  const { data, error } = await auth.supabase
    .from("dispatch_requests")
    .select(
      "id,status,request_type,context,response,response_metadata,source_page,created_at,completed_at,viewed_at"
    )
    .eq("owner_id", auth.user.id)
    .eq("status", "completed")
    .is("viewed_at", null)
    .order("completed_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(25);

  if (error) {
    console.error("[/api/dispatch/requests] query failed:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, requests: (data ?? []) as DispatchRequestRow[] });
}

export async function POST(req: Request) {
  const auth = await getAuthedClient();
  if ("error" in auth) return auth.error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const parsed = DispatchRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "invalid_payload", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const { data, error } = await auth.supabase
    .from("dispatch_requests")
    .insert({
      owner_id: auth.user.id,
      request_type: parsed.data.requestType,
      context: parsed.data.context,
      source_page: parsed.data.sourcePage,
    })
    .select("id,status,request_type,created_at")
    .single();

  if (error) {
    console.error("[/api/dispatch/requests] insert failed:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, request: data }, { status: 201 });
}

export async function PATCH(req: Request) {
  const auth = await getAuthedClient();
  if ("error" in auth) return auth.error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const parsed = MarkViewedSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "invalid_payload", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  if (parsed.data.ids.length === 0) {
    return NextResponse.json({ ok: true, updated: 0 });
  }

  const { data, error } = await auth.supabase
    .from("dispatch_requests")
    .update({ viewed_at: new Date().toISOString() })
    .eq("owner_id", auth.user.id)
    .in("id", parsed.data.ids)
    .select("id");

  if (error) {
    console.error("[/api/dispatch/requests] mark viewed failed:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, updated: data?.length ?? 0 });
}
