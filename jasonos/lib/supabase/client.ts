import { createBrowserClient } from "@supabase/ssr";

// Browser-side Supabase client, scoped to the `jasonos` Postgres schema.
// Add `jasonos` to Supabase Dashboard → API → Exposed schemas for this to work.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { db: { schema: "jasonos" } }
  );
}
