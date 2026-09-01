import { supabaseServer } from "@/lib/supabase/server";
import { todayISO } from "@/lib/format";
import type { BusinessProfile } from "@/lib/types";

export async function getFormData() {
  const supabase = supabaseServer();
  const [{ data: clients }, { data: profile }, { data: recentItems }] = await Promise.all([
    supabase.from("clients").select("id, name").order("name"),
    supabase.from("business_profile").select("*").maybeSingle(),
    supabase
      .from("line_items")
      .select("description")
      .order("id", { ascending: false })
      .limit(100),
  ]);
  const seen = new Set<string>();
  const recentDescriptions: string[] = [];
  for (const r of recentItems ?? []) {
    const d = (r.description ?? "").trim();
    if (d && !seen.has(d.toLowerCase())) {
      seen.add(d.toLowerCase());
      recentDescriptions.push(d);
    }
    if (recentDescriptions.length >= 25) break;
  }
  return {
    clients: clients ?? [],
    profile: (profile as BusinessProfile | null) ?? null,
    recentDescriptions,
    today: todayISO(),
  };
}
