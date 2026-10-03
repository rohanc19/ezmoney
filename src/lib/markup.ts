// What he charges against what he paid.
//
// Materials are about half of what he bills, and until October the app
// knew both halves and never put them next to each other. His markups run
// from 8% to 97% on the same kind of material — his most-billed line, tape
// at ₹25 against ₹20 paid, is near the bottom — and nothing told him.
//
// This module lives apart from `src/lib/prices.ts` on purpose: that file is
// imported by DocumentForm, which is a client component sitting at the
// 106 kB ceiling. Nothing here ever reaches the browser.

import { isStale, itemKey, type PriceRow } from "@/lib/prices";

/**
 * Below this a markup is worth a second look.
 *
 * Not a round number picked out of the air: across the 22 rate card lines
 * that could be compared at the same unit in Oct 2026 his markups ran
 * 8, 9, 18, 22, 25, 25, 26, 26, 28, 34, 35, 40, 41, 41, 50, 70, 82, 82,
 * 97, 100, 100, 140 per cent — a median of 40% and a lower quartile around
 * 26%. 30% is therefore "meaningfully under what he normally charges",
 * measured against himself rather than against any outside idea of a fair
 * margin. It flags 9 of those 22, among them tape at 25% on 23 bills.
 */
export const LOW_MARKUP = 0.3;

export interface Markup {
  /** The dearest fresh price he has actually paid, same unit. */
  paid: number;
  /** (charged − paid) / paid. 0.25 is a 25% markup. */
  rate: number;
  /** Below LOW_MARKUP — worth a second look, not an error. */
  thin: boolean;
  /** How many price sightings stand behind `paid`. One is a weak signal. */
  seen: number;
}

/**
 * Index the price book once, by item *and unit together*.
 *
 * The unit is half the key and not a detail. Comparing a rate card row to a
 * purchase without it reports nonsense with total confidence: "Gatta" is
 * bought by the dozen at ₹10 and sold by the piece at ₹2, which reads as
 * losing ₹8 on every one and is really a 140% markup. Anything that cannot
 * be compared at the same unit is not compared at all.
 */
export function indexPrices(rows: PriceRow[], today = new Date()): Map<string, PriceRow[]> {
  const byKey = new Map<string, PriceRow[]>();
  for (const r of rows) {
    const unit = (r.unit ?? "").trim().toLowerCase();
    if (!unit) continue; // no unit, nothing to compare against
    if (isStale(r.seen_on, today)) continue; // an old price must not raise an alarm
    const k = `${r.item_key}|${unit}`;
    const list = byKey.get(k);
    if (list) list.push(r);
    else byKey.set(k, [r]);
  }
  return byKey;
}

/**
 * What a rate card line is really making him, or null when the app cannot
 * say — no matching purchase, no unit on either side, or every sighting
 * stale. Null means say nothing: a blank is honest where a guess is not.
 *
 * `paid` is the *dearest* fresh sighting, not the cheapest. He has bought
 * the thing at that price, so it is the markup he can actually defend;
 * taking the cheapest would flatter every line and quietly hide the ones
 * this exists to find.
 */
export function markupFor(
  charged: number,
  unit: string,
  description: string,
  index: Map<string, PriceRow[]>
): Markup | null {
  const sell = Number(charged);
  const u = (unit ?? "").trim().toLowerCase();
  if (!(sell > 0) || !u) return null;

  const rows = index.get(`${itemKey(description)}|${u}`);
  if (!rows || rows.length === 0) return null;

  let paid = 0;
  for (const r of rows) paid = Math.max(paid, Number(r.rate));
  if (!(paid > 0)) return null;

  const rate = (sell - paid) / paid;
  return {
    paid,
    rate,
    thin: rate < LOW_MARKUP,
    seen: rows.length,
  };
}
