"use server";

import {
  createPublicServiceRoleClient,
  createServiceRoleClient,
} from "@/lib/supabase/server";

export interface Firmmate {
  contact_id: string;
  name: string;
  title: string | null;
  strategic_score: number | null;
  firm_focus_rank: number | null;
  prior_communication: boolean | null;
  last_contact_date: string | null;
}

export async function getFirmmates(recruiterId: string): Promise<Firmmate[]> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return [];

  try {
    const sb = createPublicServiceRoleClient();

    const { data: self, error } = await sb
      .from("rr_recruiters")
      .select("firm_normalized")
      .eq("id", recruiterId)
      .maybeSingle();

    if (error || !self?.firm_normalized) return [];

    const { data: firmmates } = await sb
      .from("rr_recruiters")
      .select("id,name,title,strategic_score,firm_focus_rank,prior_communication,last_contact_date")
      .eq("firm_normalized", self.firm_normalized)
      .neq("id", recruiterId)
      .order("firm_focus_rank", { ascending: true, nullsFirst: false });

    return (firmmates ?? []).map((r) => ({
      contact_id: r.id as string,
      name: r.name as string,
      title: (r.title as string | null) ?? null,
      strategic_score: (r.strategic_score as number | null) ?? null,
      firm_focus_rank: (r.firm_focus_rank as number | null) ?? null,
      prior_communication: (r.prior_communication as boolean | null) ?? null,
      last_contact_date: (r.last_contact_date as string | null) ?? null,
    }));
  } catch {
    return [];
  }
}
