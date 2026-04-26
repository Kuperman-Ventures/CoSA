import { NextResponse } from "next/server";
import { healthCheckAll } from "@/lib/settings/actions";

export const runtime = "nodejs";

export async function POST() {
  try {
    const summary = await healthCheckAll();
    return NextResponse.json({ ok: true, summary });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "health_check_failed" },
      { status: error instanceof Error && error.message === "not_authenticated" ? 401 : 500 }
    );
  }
}
