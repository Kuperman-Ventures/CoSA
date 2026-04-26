import { NextResponse } from "next/server";
import { SaveConnectionSchema, saveServiceConnection } from "@/lib/settings/actions";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const parsed = SaveConnectionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "invalid_payload", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const result = await saveServiceConnection(parsed.data);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "save_failed" },
      { status: error instanceof Error && error.message === "not_authenticated" ? 401 : 500 }
    );
  }
}
