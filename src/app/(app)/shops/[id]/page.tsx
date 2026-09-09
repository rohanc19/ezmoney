import Link from "next/link";
import { notFound } from "next/navigation";
import ConfirmButton from "@/components/ConfirmButton";
import { deletePrice, deleteShop, savePrice } from "@/lib/actions";
import { formatDate, formatINR, todayISO } from "@/lib/format";
import { getDict } from "@/lib/i18n";
import { isStale, latestPerShop, type PriceRow } from "@/lib/prices";
import { supabaseServer } from "@/lib/supabase/server";
import { UNITS } from "@/lib/types";

export const dynamic = "force-dynamic";

function waLink(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return null;
  return `https://wa.me/${digits.length === 10 ? "91" + digits : digits}`;
}

export default async function ShopPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { saved?: string; all?: string };
}) {
  const t = getDict();
  const supabase = supabaseServer();
  const today = todayISO();

  const [{ data: shop }, { data: pricesRaw }] = await Promise.all([
    supabase.from("shops").select("*").eq("id", params.id).maybeSingle(),
    supabase
      .from("item_prices")
      .select("id, shop_id, item, item_key, unit, rate, seen_on, source")
      .eq("shop_id", params.id)
      .order("seen_on", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(500),
  ]);
  if (!shop) notFound();

  const all = (pricesRaw ?? []) as PriceRow[];
  // Today's prices here: the newest sighting of each thing. The full
  // history is one tap away, for when he wants to see a price creeping up.
  const rows = searchParams.all ? all : latestPerShop(all);
  const wa = shop.phone ? waLink(shop.phone) : null;

  return (
    <main>
      <div className="mb-4 flex items-center gap-3">
        <Link href="/shops" className="btn-secondary px-3">
          ← {t.back}
        </Link>
        <h1 className="truncate text-2xl font-extrabold">{shop.name}</h1>
      </div>

      {searchParams.saved && (
        <p className="mb-3 rounded-2xl bg-green-100 p-3 text-center font-bold text-green-900">
          {t.saved}
        </p>
      )}

      <div className="card p-4">
        {shop.area && <p className="font-semibold text-stone-700">{shop.area}</p>}
        {shop.phone && <p className="text-stone-700">{shop.phone}</p>}
        {shop.address && <p className="text-sm text-stone-600">{shop.address}</p>}
        {shop.notes && <p className="mt-1 text-sm text-stone-500">{shop.notes}</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href={`/shops/${shop.id}/edit`} className="btn-secondary">
            {t.edit}
          </Link>
          {wa && (
            <a href={wa} target="_blank" rel="noopener noreferrer" className="btn-secondary">
              {t.sendOnWhatsApp}
            </a>
          )}
        </div>
      </div>

      {/* add a price he was quoted, without buying anything */}
      <details className="card mt-4 p-4">
        <summary className="min-h-[44px] cursor-pointer list-none font-extrabold text-accent-dark">
          ＋ {t.addPrice}
        </summary>
        <form action={savePrice} className="mt-4 space-y-4">
          <input type="hidden" name="shop_id" value={shop.id} />
          <div>
            <label className="label" htmlFor="item">
              {t.priceItem}
            </label>
            <input id="item" name="item" required className="field" />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="label" htmlFor="rate">
                {t.priceRate}
              </label>
              <input id="rate" name="rate" inputMode="decimal" required className="field tnum" />
            </div>
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
          </div>
          <div>
            <label className="label" htmlFor="seen_on">
              {t.date}
            </label>
            <input id="seen_on" type="date" name="seen_on" defaultValue={today} className="field" />
          </div>
          <button type="submit" className="btn-primary w-full">
            {t.save}
          </button>
        </form>
      </details>

      <div className="mt-7 flex items-baseline justify-between gap-3">
        <h2 className="eyebrow">{t.pricesHere}</h2>
        {all.length > rows.length && (
          <Link href={`/shops/${shop.id}?all=1`} className="text-sm font-bold text-accent">
            {t.seeAll}
          </Link>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="card mt-3 p-6 text-center text-stone-600">{t.noPricesHere}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {rows.map((p) => {
            const stale = isStale(p.seen_on);
            return (
              <li key={p.id} className="card flex items-start justify-between gap-3 p-3">
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{p.item}</span>
                  <span className="text-xs text-stone-500">
                    {t.seenOn} {formatDate(p.seen_on)}
                    {stale ? ` · ${t.oldPrice}` : ""}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span
                    className={`tnum block font-extrabold ${stale ? "text-stone-400" : "text-ink"}`}
                  >
                    {formatINR(Number(p.rate))}
                    <span className="text-xs font-semibold text-stone-500"> / {p.unit}</span>
                  </span>
                  <form action={deletePrice}>
                    <input type="hidden" name="id" value={p.id} />
                    <input type="hidden" name="shop_id" value={shop.id} />
                    <ConfirmButton
                      message={t.confirmDeletePrice}
                      className="mt-1 min-h-[36px] rounded-lg px-2 text-xs font-semibold text-red-700"
                    >
                      ✕ {t.delete}
                    </ConfirmButton>
                  </form>
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <form action={deleteShop} className="mt-8">
        <input type="hidden" name="id" value={shop.id} />
        <ConfirmButton message={t.confirmDeleteShop} className="btn-danger w-full">
          {t.delete}
        </ConfirmButton>
      </form>
    </main>
  );
}
