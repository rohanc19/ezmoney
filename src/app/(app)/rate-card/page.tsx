import Link from "next/link";
import ConfirmButton from "@/components/ConfirmButton";
import { deleteRateCardItem, fixRateCardSpelling, saveRateCardItem } from "@/lib/actions";
import { suggestForRateCard } from "@/lib/spelling-rate-card";
import { formatINR } from "@/lib/format";
import { getDict } from "@/lib/i18n";
import { indexPrices, markupFor } from "@/lib/markup";
import type { PriceRow } from "@/lib/prices";
import { supabaseServer } from "@/lib/supabase/server";
import { UNITS } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function RateCardPage({
  searchParams,
}: {
  searchParams: { saved?: string; fix?: string; thin?: string };
}) {
  const t = getDict();
  const supabase = supabaseServer();
  const [{ data: items }, { data: profile }, { data: prices }] = await Promise.all([
    supabase
      .from("rate_card_items")
      .select("*")
      .order("times_used", { ascending: false })
      .order("description"),
    supabase.from("business_profile").select("gst_enabled, default_hsn_sac").maybeSingle(),
    // What he has actually paid. The price book is a by-product of the day
    // book, so this costs him no extra typing — it is already there.
    supabase
      .from("item_prices")
      .select("id, shop_id, item, item_key, unit, rate, seen_on, source")
      .order("seen_on", { ascending: false }),
  ]);

  // What looks misspelled. Proposed only — nothing changes until he taps.
  const all = items ?? [];
  const withFix = all
    .map((i) => ({ item: i, fixed: suggestForRateCard(i.description) }))
    .filter((r): r is { item: (typeof all)[number]; fixed: string } => r.fixed !== null);
  const fixing = searchParams.fix === "1";

  // ---- what each rate is actually making him ----
  // Only where the same thing, at the same unit, has a fresh price behind
  // it. Everything else shows nothing rather than a guess.
  const priceIndex = indexPrices((prices ?? []) as PriceRow[]);
  const markups = new Map<string, ReturnType<typeof markupFor>>();
  for (const i of all) {
    markups.set(i.id, markupFor(Number(i.rate), i.unit ?? "", i.description ?? "", priceIndex));
  }
  const thinOnes = all.filter((i) => markups.get(i.id)?.thin);
  const checkingThin = searchParams.thin === "1";

  const listed = fixing
    ? withFix.map((r) => r.item)
    : checkingThin
      ? thinOnes
      : all;

  return (
    <main>
      <div className="mb-4 flex items-center gap-3">
        <Link href="/settings" className="btn-secondary px-3">
          ← {t.back}
        </Link>
        <h1 className="text-2xl font-extrabold">{t.rateCard}</h1>
      </div>
      <p className="text-stone-600">{t.rateCardHint}</p>

      {/* Spelling. These print in the biggest column of his customer's
          copy, so they are worth a look — but only ever on his say-so. */}
      {withFix.length > 0 && !fixing && !checkingThin && (
        <Link
          href="/rate-card?fix=1"
          className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-amber-50 p-3 font-semibold text-amber-900 no-underline"
        >
          <span>{t.spellingToCheck.replace("{n}", String(withFix.length))}</span>
          <span className="shrink-0 underline">{t.checkSpellings} →</span>
        </Link>
      )}

      {/* What he charges against what the shop charged him. His own markups
          run from 8% to 140% on comparable material, and the thin end
          includes tape at 25% on twenty-three bills — he had no way of
          knowing. Same shape as the spelling line above: absent unless
          there is something to say, and it proposes, never changes. */}
      {thinOnes.length > 0 && !fixing && !checkingThin && (
        <Link
          href="/rate-card?thin=1"
          className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-amber-50 p-3 font-semibold text-amber-900 no-underline"
        >
          <span>{t.thinMarkupCount.replace("{n}", String(thinOnes.length))}</span>
          <span className="shrink-0 underline">{t.seeThem} →</span>
        </Link>
      )}
      {checkingThin && (
        <div className="mt-4 rounded-2xl bg-amber-50 p-3">
          <p className="font-semibold text-amber-900">
            {thinOnes.length > 0 ? t.thinMarkupHint : t.allMarkupsFine}
          </p>
          <Link href="/rate-card" className="mt-1 inline-block text-sm font-bold underline">
            ← {t.back}
          </Link>
        </div>
      )}
      {fixing && (
        <div className="mt-4 rounded-2xl bg-amber-50 p-3">
          <p className="font-semibold text-amber-900">
            {withFix.length > 0
              ? t.spellingToCheck.replace("{n}", String(withFix.length))
              : t.spellingAllGood}
          </p>
          <Link href="/rate-card" className="text-sm font-semibold text-amber-900 underline">
            ← {t.backToAll}
          </Link>
        </div>
      )}

      {searchParams.saved && (
        <p className="mt-4 rounded-2xl bg-green-100 p-3 text-center font-bold text-green-900">
          {t.saved}
        </p>
      )}

      {/* add */}
      <form
        action={saveRateCardItem}
        className={`card mt-5 space-y-4 p-4 ${fixing ? "hidden" : ""}`}
      >
        <div>
          <label className="label" htmlFor="description">
            {t.description}
          </label>
          <input id="description" name="description" required className="field" />
        </div>
        <div className="flex gap-3">
          <div className="w-28">
            <label className="label" htmlFor="unit">
              {t.unit}
            </label>
            <select id="unit" name="unit" className="field px-2">
              {UNITS.map((u) => (
                <option key={u}>{u}</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="label" htmlFor="rate">
              {t.usualRate}
            </label>
            <input id="rate" name="rate" inputMode="decimal" required className="field tnum" />
          </div>
        </div>
        {profile?.gst_enabled && (
          <div>
            <label className="label" htmlFor="hsn_sac">
              {t.hsn}
            </label>
            <input
              id="hsn_sac"
              name="hsn_sac"
              inputMode="numeric"
              defaultValue={profile?.default_hsn_sac ?? ""}
              className="field"
            />
          </div>
        )}
        <button type="submit" className="btn-primary w-full">
          + {t.addRateItem}
        </button>
      </form>

      {/* list */}
      {listed.length === 0 ? (
        <p className="card mt-5 p-6 text-center text-stone-600">
          {fixing ? t.spellingAllGood : t.noRateItems}
        </p>
      ) : (
        <ul className="mt-5 space-y-3">
          {listed.map((i) => (
            <li key={i.id} className="card p-4">
              {(() => {
                const fixed = suggestForRateCard(i.description);
                if (!fixed) return null;
                return (
                  <form action={fixRateCardSpelling} className="mb-3">
                    <input type="hidden" name="id" value={i.id} />
                    <button
                      type="submit"
                      className="w-full rounded-xl bg-amber-100 px-3 py-2 text-left text-sm font-semibold text-amber-900"
                    >
                      {t.changeTo} <span className="font-extrabold">{fixed}</span>
                    </button>
                  </form>
                );
              })()}
              <form action={saveRateCardItem} className="space-y-3">
                <input type="hidden" name="id" value={i.id} />
                <input
                  name="description"
                  defaultValue={i.description}
                  className="field font-semibold"
                />
                <div className="flex gap-2">
                  <select name="unit" defaultValue={i.unit} className="field w-28 px-2">
                    {UNITS.map((u) => (
                      <option key={u}>{u}</option>
                    ))}
                  </select>
                  <input
                    name="rate"
                    defaultValue={String(i.rate)}
                    inputMode="decimal"
                    className="field tnum flex-1"
                  />
                  {profile?.gst_enabled && (
                    <input
                      name="hsn_sac"
                      defaultValue={i.hsn_sac}
                      inputMode="numeric"
                      placeholder={t.hsn}
                      className="field w-28"
                    />
                  )}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-stone-500">
                    {formatINR(Number(i.rate), 0)} / {i.unit}
                    {i.times_used > 0 ? ` · ×${i.times_used}` : ""}
                    {(() => {
                      const m = markups.get(i.id);
                      if (!m) return null;
                      return (
                        <>
                          {" · "}
                          <span className={m.thin ? "font-bold text-amber-700" : ""}>
                            {t.youPaid.replace("{n}", formatINR(m.paid, 0))}
                            {" · "}
                            {m.rate >= 0 ? "+" : ""}
                            {Math.round(m.rate * 100)}%
                          </span>
                        </>
                      );
                    })()}
                  </span>
                  <button type="submit" className="btn-secondary px-4">
                    {t.save}
                  </button>
                </div>
              </form>
              <form action={deleteRateCardItem} className="mt-2">
                <input type="hidden" name="id" value={i.id} />
                <ConfirmButton
                  message={t.confirmDeleteRateItem}
                      confirmLabel={t.tapAgain}
                  className="min-h-[44px] rounded-xl px-3 text-sm font-semibold text-red-700 active:bg-red-50"
                >
                  × {t.delete}
                </ConfirmButton>
              </form>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
