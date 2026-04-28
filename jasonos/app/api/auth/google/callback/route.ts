// GET /api/auth/google/callback
// Exchanges the OAuth code for tokens and stores them in jasonos.user_integrations.
// Single-user app: uses auth.admin.listUsers() to find the owner_id.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
  error?: string;
  error_description?: string;
}

export async function GET(req: Request) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(`${origin}/settings?google_error=${encodeURIComponent(error)}`);
  }
  if (!code) {
    return NextResponse.json({ error: "No code returned from Google" }, { status: 400 });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: "Google OAuth env vars not configured" }, { status: 500 });
  }

  // Exchange code for tokens
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: `${origin}/api/auth/google/callback`,
      grant_type: "authorization_code",
    }),
  });

  const tokens = (await tokenRes.json()) as TokenResponse;

  if (!tokenRes.ok || tokens.error) {
    console.error("[google/callback] token exchange failed:", tokens);
    return NextResponse.json(
      { error: tokens.error_description ?? "Token exchange failed" },
      { status: 500 }
    );
  }

  // Fetch user email from Google to store as metadata
  const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const userInfo = userInfoRes.ok
    ? ((await userInfoRes.json()) as { email?: string; name?: string })
    : {};

  // Store in jasonos.user_integrations using service role (no session required)
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { db: { schema: "jasonos" }, auth: { persistSession: false } }
  );

  // Single-user app: resolve owner_id from auth.users
  const { data: users } = await sb.auth.admin.listUsers({ perPage: 1 });
  const ownerId = users?.users?.[0]?.id ?? null;
  if (!ownerId) {
    return NextResponse.json(
      { error: "No user found in Supabase Auth. Create a user first." },
      { status: 500 }
    );
  }

  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  const { error: upsertError } = await sb.from("user_integrations").upsert(
    {
      user_id: ownerId,
      provider: "google",
      scopes: tokens.scope.split(" "),
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? null,
      expires_at: expiresAt,
      metadata: { email: userInfo.email ?? null, name: userInfo.name ?? null },
    },
    { onConflict: "user_id,provider" }
  );

  if (upsertError) {
    console.error("[google/callback] upsert failed:", upsertError);
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  // Redirect back to Communications page with success flag
  return NextResponse.redirect(`${origin}/communications?google_connected=1`);
}
