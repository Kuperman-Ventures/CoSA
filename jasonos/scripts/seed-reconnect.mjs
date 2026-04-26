import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

await loadEnvLocal();

const DEFAULT_SEED_PATH =
  "/Users/thor/Documents/Claude/Projects/Job Search 4.0/cursor-app-kickoff/seed_recruiters.json";

const seedPath = process.env.SEED_RECRUITERS_PATH || DEFAULT_SEED_PATH;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRole) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
}

const supabase = createClient(url, serviceRole, {
  db: { schema: "public" },
  auth: { persistSession: false },
});

const raw = await readFile(seedPath, "utf8");
const seed = JSON.parse(raw);

if (!Array.isArray(seed)) {
  throw new Error(`Expected ${seedPath} to contain a JSON array.`);
}

let inserted = 0;
let updated = 0;
let failed = 0;

for (const row of seed) {
  const normalized = normalizeRecruiter(row);
  const result = normalized.linkedin_url
    ? await upsertByLinkedIn(normalized)
    : await upsertByNameFirm(normalized);

  if (result === "inserted") inserted += 1;
  else if (result === "updated") updated += 1;
  else failed += 1;
}

console.log(
  `Reconnect seed complete: ${inserted} inserted, ${updated} updated, ${failed} failed.`
);

async function upsertByLinkedIn(row) {
  const { data: existing, error: findError } = await supabase
    .from("rr_recruiters")
    .select("id")
    .eq("linkedin_url", row.linkedin_url)
    .maybeSingle();

  if (findError) {
    console.error("Find by linkedin failed:", row.name, findError.message);
    return "failed";
  }

  const { error } = existing
    ? await supabase.from("rr_recruiters").update(row).eq("id", existing.id)
    : await supabase.from("rr_recruiters").insert(row);

  if (error) {
    console.error("Upsert by linkedin failed:", row.name, error.message);
    return "failed";
  }

  return existing ? "updated" : "inserted";
}

async function upsertByNameFirm(row) {
  const query = supabase
    .from("rr_recruiters")
    .select("id")
    .eq("name", row.name);

  const { data: existing, error: findError } = row.firm_normalized
    ? await query.eq("firm_normalized", row.firm_normalized).maybeSingle()
    : await query.is("firm_normalized", null).maybeSingle();

  if (findError) {
    console.error("Find by name/firm failed:", row.name, findError.message);
    return "failed";
  }

  const { error } = existing
    ? await supabase.from("rr_recruiters").update(row).eq("id", existing.id)
    : await supabase.from("rr_recruiters").insert(row);

  if (error) {
    console.error("Upsert by name/firm failed:", row.name, error.message);
    return "failed";
  }

  return existing ? "updated" : "inserted";
}

function normalizeRecruiter(row) {
  const firm = nullableString(row.firm);
  const firmNormalized =
    nullableString(row.firm_normalized) || (firm ? firm.toLowerCase().trim() : null);

  return {
    name: requiredString(row.name, "name"),
    linkedin_url: nullableString(row.linkedin_url),
    public_identifier: nullableString(row.public_identifier),
    firm,
    firm_normalized: firmNormalized,
    title: nullableString(row.title),
    specialty: nullableString(row.specialty),
    firm_fit_score: numberOrNull(row.firm_fit_score),
    practice_match_score: numberOrNull(row.practice_match_score),
    recency_score: numberOrNull(row.recency_score),
    signal_score: numberOrNull(row.signal_score),
    strategic_score: numberOrNull(row.strategic_score),
    strategic_priority: nullableString(row.strategic_priority),
    prior_communication: Boolean(row.prior_communication),
    last_contact_date: nullableString(row.last_contact_date),
    summary_of_prior_comms: nullableString(row.summary_of_prior_comms),
    outlook_history: nullableString(row.outlook_history),
    other_contacts_at_firm: nullableString(row.other_contacts_at_firm),
    inboxes_searched: nullableString(row.inboxes_searched),
    source: nullableString(row.source),
    hubspot_url: nullableString(row.hubspot_url),
    hubspot_contact_id: nullableString(row.hubspot_contact_id),
    strategic_recommended_approach: nullableString(row.strategic_recommended_approach),
    review_flag: Boolean(row.review_flag),
  };
}

function nullableString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function requiredString(value, field) {
  const normalized = nullableString(value);
  if (!normalized) throw new Error(`Missing required field: ${field}`);
  return normalized;
}

function numberOrNull(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

async function loadEnvLocal() {
  const path = join(dirname(fileURLToPath(import.meta.url)), "../.env.local");
  if (!existsSync(path)) return;

  const raw = await readFile(path, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [key, ...valueParts] = trimmed.split("=");
    if (process.env[key]) continue;
    const value = valueParts.join("=").trim().replace(/^['"]|['"]$/g, "");
    process.env[key] = value;
  }
}
