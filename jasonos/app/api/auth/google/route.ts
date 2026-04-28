// GET /api/auth/google
// Redirects to Google OAuth consent screen.
// Scopes: Gmail read + Calendar read (covers both gmail.ts + google-calendar.ts).
// Requires GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET env vars.

import { NextResponse } from "next/server";

export const runtime = "nodejs";

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/calendar.readonly",
  "email",
  "profile",
].join(" ");

export async function GET(req: Request) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: "GOOGLE_CLIENT_ID env var not set" },
      { status: 500 }
    );
  }

  const { origin } = new URL(req.url);
  const redirectUri = `${origin}/api/auth/google/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",   // required for refresh_token
    prompt: "consent",        // force consent so we always get a refresh_token
  });

  return NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params}`
  );
}
