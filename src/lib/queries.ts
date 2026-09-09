import { supabaseServer } from "@/lib/supabase/server";
import { todayISO } from "@/lib/format";
import { isStale, latestPerShop, type PriceRow } from "@/lib/prices";
import type { BusinessProfile, PriceHint, RateCardItem } from "@/lib/types";

/**
 * What he has paid for materials, folded down small enough to hand to the
 * bill form: one row per material, the two cheapest shops for it. This is
 * data, not code — it costs the old PC nothing to receive.
 */
export async function getPriceHints(limit = 120): Promise<PriceHint[]> {
  const supabase = supabaseServer();
  const [{ data: pricesRaw }, { data: shopsRaw }] = await Promise.all([
    supabase
      .from("item_prices")
      .select("id, shop_id, item, item_key, unit, rate, seen_on, source")
      .order("seen_on", { ascending: false })
      .limit(600),
    supabase.from("shops").select("id, name, area"),
  ]);

  const shops = new Map(
    (shopsRaw ?? []).map((s) => [s.id, s as { id: string; name: string; area: string }])
  );
  const latest = latestPerShop((pricesRaw ?? []) as PriceRow[]);

  const byItem = new Map<string, PriceHint>();
  for (const p of latest) {
    const hint = byItem.get(p.item_key) ?? {
      key: p.item_key,
      item: p.item,
      unit: p.unit,
      quotes: [],
    };
    const shop = shops.get(p.shop_id);
    hint.quotes.push({
      shop: shop?.name ?? "",
      area: shop?.area ?? "",
      rate: Number(p.rate),
      stale: isStale(p.seen_on),
    });
    byItem.set(p.item_key, hint);
  }

  return [...byItem.values()]
    .map((h) => ({
      ...h,
      // Cheapest first, and never more than two — this is a whisper under
      // an input, not a table.
      quotes: h.quotes.sort((a, b) => a.rate - b.rate).slice(0, 2),
    }))
    .slice(0, limit);
}

export async function getFormData() {
  const supabase = supabaseServer();
  const [
    { data: clients },
    { data: profile },
    { data: rateCard },
    { data: recentItems },
    priceHints,
  ] = await Promise.all([
      supabase.from("clients").select("id, name").order("name"),
      supabase.from("business_profile").select("*").maybeSingle(),
      supabase
        .from("rate_card_items")
        .select("id, description, unit, rate, hsn_sac, category, times_used")
        .order("times_used", { ascending: false })
        .order("description")
        .limit(200),
      supabase.from("line_items").select("description").order("id", { ascending: false }).limit(100),
      getPriceHints(),
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
    rateCard: (rateCard as RateCardItem[] | null) ?? [],
    recentDescriptions,
    priceHints,
    today: todayISO(),
  };
}

/** A short-lived link to a receipt photo in private storage. */
export async function receiptUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const supabase = supabaseServer();
  const { data } = await supabase.storage.from("receipts").createSignedUrl(path, 60 * 30);
  return data?.signedUrl ?? null;
}
