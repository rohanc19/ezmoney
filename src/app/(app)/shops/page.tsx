import Link from "next/link";
import { getDict } from "@/lib/i18n";
import { formatDate, formatINR } from "@/lib/format";
import {
  groupByItem,
  matchesQuery,
  quotesFor,
  type PriceRow,
  type ShopLite,
} from "@/lib/prices";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ShopsPage({
  searchParams,
}: {
  searchParams: { q?: string; area?: string };
}) {
  const t = getDict();
  const supabase = supabaseServer();
  const q = (searchParams.q ?? "").trim();
  const area = (searchParams.area ?? "").trim();

  const [{ data: shopsRaw }, { data: pricesRaw }] = await Promise.all([
    supabase.from("shops").select("id, name, area, phone").order("name"),
    // Only fetch prices when he is actually asking about something.
    q
      ? supabase
          .from("item_prices")
          .select("id, shop_id, item, item_key, unit, rate, seen_on, source")
          .order("seen_on", { ascending: false })
          .limit(800)
      : Promise.resolve({ data: [] as PriceRow[] }),
  ]);

  const shops = (shopsRaw ?? []) as (ShopLite & { phone: string })[];
  const areas = [...new Set(shops.map((s) => s.area).filter(Boolean))].sort();

  // "Cheapest near this site" is just the area filter — he knows the city.
  const shopsInArea = area ? shops.filter((s) => s.area === area) : shops;
  const allowed = new Set(shopsInArea.map((s) => s.id));
  const prices = ((pricesRaw ?? []) as PriceRow[]).filter(
    (p) => allowed.has(p.shop_id) && matchesQuery(p.item_key, q)
  );
  const groups = q ? groupByItem(prices).slice(0, 12) : [];

  // How many prices he has for each shop, for the list below.
  const { data: counts } = await supabase.from("item_prices").select("shop_id");
  const priceCount = new Map<string, number>();
  for (const c of counts ?? []) {
    priceCount.set(c.shop_id, (priceCount.get(c.shop_id) ?? 0) + 1);
  }

  return (
    <main>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">{t.priceBook}</h1>
        <Link href="/shops/new" className="btn-secondary">
          + {t.addShop}
        </Link>
      </div>

      {/* the payoff: what does this cost, and where */}
      <h2 className="eyebrow mt-5">{t.whatDoesItCost}</h2>
      <form method="get" className="mt-2 space-y-2">
        <div className="flex gap-2">
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder={t.searchItemPlaceholder}
            className="field flex-1"
          />
          <button type="submit" className="btn-primary px-5">
            {t.searchBtn}
          </button>
        </div>
        {areas.length > 0 && (
          <select name="area" defaultValue={area} className="field" aria-label={t.inArea}>
            <option value="">{t.allAreas}</option>
            {areas.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        )}
      </form>

      {q && groups.length === 0 && (
        <p className="card mt-4 p-6 text-center text-stone-600">{t.noPricesFound}</p>
      )}

      {groups.map((g) => {
        const quotes = quotesFor(g.rows, shops);
        return (
          <div key={g.key} className="card mt-4 p-4">
            <p className="font-extrabold">{g.label}</p>
            <ul className="mt-2 divide-y divide-line">
              {quotes.map((qt) => (
                <li key={qt.price.id} className="flex items-baseline justify-between gap-3 py-2">
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">
                      {qt.shop?.name ?? "—"}
                      {qt.shop?.area ? (
                        <span className="font-normal text-stone-500"> · {qt.shop.area}</span>
                      ) : null}
                    </span>
                    <span className="text-xs text-stone-500">
                      {t.seenOn} {formatDate(qt.price.seen_on)}
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

      {/* the shops themselves */}
      <h2 className="eyebrow mt-7">{t.priceBook}</h2>
      {shops.length === 0 ? (
        <div className="card mt-3 p-8 text-center">
          <p className="text-lg text-stone-600">{t.noShopsYet}</p>
          <Link href="/shops/new" className="btn-primary mt-5">
            + {t.addShop}
          </Link>
        </div>
      ) : (
        <ul className="mt-3 space-y-3">
          {shops.map((s) => (
            <li key={s.id}>
              <Link href={`/shops/${s.id}`} className="card block p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate font-extrabold">{s.name}</span>
                  <span className="tnum shrink-0 text-sm font-semibold text-stone-500">
                    {priceCount.get(s.id) ?? 0}
                  </span>
                </div>
                <p className="mt-1 truncate text-sm text-stone-500">
                  {[s.area, s.phone].filter(Boolean).join(" · ") || "—"}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-6 text-center text-sm text-stone-500">{t.priceBookHint}</p>
    </main>
  );
}
