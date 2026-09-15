import Link from "next/link";
import { formatDate, formatINR } from "@/lib/format";
import { getDict } from "@/lib/i18n";
import {
  groupByItem,
  matchesQuery,
  quotesFor,
  type PriceRow,
  type ShopLite,
} from "@/lib/prices";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// What he has paid for a material, at each shop, cheapest first.
//
// The old price book was a screen he had to feed by hand and it held five
// prices in two years, which answers nothing. Nothing is typed here: every
// figure arrives from the evening's recording on /day, where he is already
// sitting with the shop's bill.
//
// A stale price is still shown — an old figure beats no figure — but it is
// barred from winning "cheapest", so a price from last year cannot send
// him across Bangalore for nothing. That rule lives in quotesFor.

export default async function PricesPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const t = getDict();
  const supabase = supabaseServer();
  const q = (searchParams.q ?? "").trim();

  const [{ data: shopsRaw }, { data: pricesRaw }] = await Promise.all([
    supabase.from("shops").select("id, name, area").order("name"),
    supabase
      .from("item_prices")
      .select("id, shop_id, item, item_key, unit, rate, seen_on, source")
      .order("seen_on", { ascending: false })
      .limit(1200),
  ]);

  const shops = (shopsRaw ?? []) as ShopLite[];
  const all = (pricesRaw ?? []) as PriceRow[];
  const matched = q ? all.filter((p) => matchesQuery(p.item_key, q)) : all;
  // Without a search this is the most recent things he bought, which is
  // the list he wants nine times out of ten.
  const groups = groupByItem(matched).slice(0, q ? 12 : 8);

  return (
    <main>
      <div className="mb-4 flex items-center gap-3">
        <Link href="/expenses" className="btn-secondary px-3">
          ← {t.back}
        </Link>
        <h1 className="text-2xl font-extrabold">{t.whatThingsCost}</h1>
      </div>

      <form method="get">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder={t.searchMaterial}
          className="field"
        />
      </form>

      {all.length === 0 ? (
        <p className="card mt-5 p-8 text-center leading-snug text-stone-600">{t.noPricesYet}</p>
      ) : groups.length === 0 ? (
        <p className="card mt-5 p-8 text-center text-stone-600">{t.nothingMatchedPrice}</p>
      ) : (
        <>
          {!q && <p className="eyebrow mt-5">{t.recentlyBought}</p>}
          {groups.map((g) => {
            const quotes = quotesFor(g.rows, shops);
            return (
              <div key={g.key} className="card mt-3 p-4">
                <p className="font-extrabold">{g.label}</p>
                <ul className="mt-2 divide-y divide-line">
                  {quotes.map((qt) => (
                    <li
                      key={qt.price.id}
                      className="flex items-baseline justify-between gap-3 py-2"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">
                          {qt.shop?.name ?? "—"}
                          {qt.shop?.area ? (
                            <span className="font-normal text-stone-500"> · {qt.shop.area}</span>
                          ) : null}
                        </span>
                        <span className="text-xs text-stone-500">
                          {t.lastSeen} {formatDate(qt.price.seen_on)}
                          {qt.stale ? ` · ${t.oldPrice}` : ""}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span
                          className={`tnum block font-extrabold ${
                            qt.stale ? "text-stone-400" : "text-ink"
                          }`}
                        >
                          {formatINR(Number(qt.price.rate))}
                          <span className="text-xs font-semibold text-stone-500">
                            {" "}
                            / {qt.price.unit}
                          </span>
                        </span>
                        {qt.cheapest && (
                          <span className="mt-0.5 inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs font-bold text-green-900">
                            {t.cheapest}
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </>
      )}

      <p className="mt-6 text-center text-sm leading-snug text-stone-500">
        {t.whatThingsCostHint}
      </p>
    </main>
  );
}
