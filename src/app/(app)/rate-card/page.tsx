import Link from "next/link";
import ConfirmButton from "@/components/ConfirmButton";
import { deleteRateCardItem, saveRateCardItem } from "@/lib/actions";
import { formatINR } from "@/lib/format";
import { getDict } from "@/lib/i18n";
import { supabaseServer } from "@/lib/supabase/server";
import { UNITS } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function RateCardPage({
  searchParams,
}: {
  searchParams: { saved?: string };
}) {
  const t = getDict();
  const supabase = supabaseServer();
  const [{ data: items }, { data: profile }] = await Promise.all([
    supabase
      .from("rate_card_items")
      .select("*")
      .order("times_used", { ascending: false })
      .order("description"),
    supabase.from("business_profile").select("gst_enabled, default_hsn_sac").maybeSingle(),
  ]);

  return (
    <main>
      <div className="mb-4 flex items-center gap-3">
        <Link href="/settings" className="btn-secondary px-3">
          ← {t.back}
        </Link>
        <h1 className="text-2xl font-extrabold">{t.rateCard}</h1>
      </div>
      <p className="text-stone-600">{t.rateCardHint}</p>

      {searchParams.saved && (
        <p className="mt-4 rounded-2xl bg-green-100 p-3 text-center font-bold text-green-900">
          {t.saved}
        </p>
      )}

      {/* add */}
      <form action={saveRateCardItem} className="card mt-5 space-y-4 p-4">
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
          ＋ {t.addRateItem}
        </button>
      </form>

      {/* list */}
      {(items ?? []).length === 0 ? (
        <p className="card mt-5 p-6 text-center text-stone-600">{t.noRateItems}</p>
      ) : (
        <ul className="mt-5 space-y-3">
          {(items ?? []).map((i) => (
            <li key={i.id} className="card p-4">
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
                  className="min-h-[44px] rounded-xl px-3 text-sm font-semibold text-red-700 active:bg-red-50"
                >
                  ✕ {t.delete}
                </ConfirmButton>
              </form>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
