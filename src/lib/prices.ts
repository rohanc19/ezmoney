// The shop price book.
//
// Same material, written three different ways on three shops' bills:
// "1.5 SQ MM FR WIRE", "FR Wire 1.5sqmm", "Wire — 1.5 sq.mm (FR)". These
// helpers flatten that into one key so the three prices line up. It will
// never be perfect, which is why the search screen also matches on plain
// substrings and why he always sees the original wording.

export const STALE_DAYS = 90;

const NOISE = /\b(the|and|of|for|with|no|nos|pcs|pc)\b/g;

/**
 * A forgiving key for "is this the same thing?".
 *
 * The words are sorted, because the three bills above put them in three
 * orders and none of the orders is more correct. That makes the key
 * unreadable — which is fine, the original wording is kept in `item` and
 * is what he actually sees.
 *
 * Changing this function orphans every item_key already in the database.
 * If it ever changes, backfill: update item_prices set item_key = ...
 */
export function itemKey(raw: string): string {
  const flat = raw
    .toLowerCase()
    .replace(/(\d),(\d)/g, "$1$2")        // 1,000 → 1000
    .replace(/[^a-z0-9.]+/g, " ")          // keep the dot in 1.5
    .replace(/\bsq\s*\.?\s*mm\b/g, "sqmm")
    .replace(/(\d)([a-z])/g, "$1 $2")      // 1.5sqmm → 1.5 sqmm
    .replace(/([a-z])(\d)/g, "$1 $2")      // mcb32 → mcb 32
    .replace(/\bsq\s*mm\b/g, "sqmm")      // …and put sqmm back together
    .replace(/\b(meters?|metres?|mtrs?)\b/g, "mtr")
    .replace(/\b(pieces?)\b/g, "nos")
    .replace(NOISE, " ")
    .replace(/\.(?![0-9])/g, " ")          // a trailing dot is punctuation
    .replace(/\s+/g, " ")
    .trim();

  return flat.split(" ").filter(Boolean).sort().join(" ");
}

/**
 * Does this saved item answer what he is typing? Every word he has typed
 * must start some word of the saved item — so "wir 1.5" finds
 * "1.5 sq mm FR wire" without him having to spell it the shop's way.
 */
export function matchesQuery(candidateKey: string, query: string): boolean {
  const wanted = itemKey(query).split(" ").filter(Boolean);
  if (wanted.length === 0) return false;
  const have = candidateKey.split(" ").filter(Boolean);
  return wanted.every((w) => have.some((h) => h.startsWith(w)));
}

export interface PriceRow {
  id: string;
  shop_id: string;
  item: string;
  item_key: string;
  unit: string;
  rate: number;
  seen_on: string;
  source: string;
}

export interface ShopLite {
  id: string;
  name: string;
  area: string;
}

/** True once a price is old enough that he should check it again. */
export function isStale(seenOn: string, today = new Date()): boolean {
  const seen = new Date(seenOn + "T00:00:00");
  if (isNaN(seen.getTime())) return false;
  return (today.getTime() - seen.getTime()) / 86_400_000 > STALE_DAYS;
}

/**
 * The newest sighting per shop per item. Rows are appended, never
 * overwritten, so this is what turns the history into "today's prices".
 * Expects rows already sorted newest first.
 */
export function latestPerShop(rows: PriceRow[]): PriceRow[] {
  const seen = new Set<string>();
  const out: PriceRow[] = [];
  for (const r of rows) {
    const key = `${r.shop_id}|${r.item_key}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

export interface Quote {
  price: PriceRow;
  shop: ShopLite | undefined;
  cheapest: boolean;
  stale: boolean;
}

/**
 * One item's price at every shop that sells it, cheapest first.
 * Stale prices are still shown — he may have no other figure — but they
 * never win "cheapest", so an old low price cannot send him across town.
 */
export function quotesFor(rows: PriceRow[], shops: ShopLite[]): Quote[] {
  const byId = new Map(shops.map((s) => [s.id, s]));
  const latest = latestPerShop(rows).sort((a, b) => Number(a.rate) - Number(b.rate));
  const fresh = latest.filter((r) => !isStale(r.seen_on));
  const best = fresh.length > 0 ? Number(fresh[0].rate) : null;

  return latest.map((price) => ({
    price,
    shop: byId.get(price.shop_id),
    stale: isStale(price.seen_on),
    cheapest: best !== null && Number(price.rate) === best && !isStale(price.seen_on),
  }));
}

/** Group a flat list of prices by item, for the shop and search screens. */
export function groupByItem(rows: PriceRow[]): { key: string; label: string; rows: PriceRow[] }[] {
  const groups = new Map<string, { key: string; label: string; rows: PriceRow[] }>();
  for (const r of rows) {
    const g = groups.get(r.item_key) ?? { key: r.item_key, label: r.item, rows: [] };
    g.rows.push(r);
    groups.set(r.item_key, g);
  }
  return [...groups.values()].sort((a, b) => a.label.localeCompare(b.label));
}
