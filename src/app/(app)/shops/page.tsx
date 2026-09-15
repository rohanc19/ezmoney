import Link from "next/link";
import { getDict } from "@/lib/i18n";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Just the names. He buys from five shops and the occasional other one,
// and this list is what fills the shop box on the Today page.
//
// It used to be a price book he fed by hand — add a shop, open it, type a
// price — which is why it held five prices in two years. The prices come
// from recording the day now, and they are read on /prices. Nothing on
// this screen enters one.

export default async function ShopsPage() {
  const t = getDict();
  const supabase = supabaseServer();
  const { data: shops } = await supabase
    .from("shops")
    .select("id, name, area, phone")
    .order("name");

  return (
    <main>
      <div className="mb-4 flex items-center gap-3">
        <Link href="/settings" className="btn-secondary px-3">
          ← {t.back}
        </Link>
        <h1 className="text-2xl font-extrabold">{t.myShops}</h1>
      </div>
      <p className="text-stone-600">{t.myShopsHint}</p>

      <Link href="/shops/new" className="btn-secondary mt-4 w-full">
        + {t.addShop}
      </Link>

      {(shops ?? []).length === 0 ? (
        <p className="card mt-4 p-8 text-center text-stone-600">{t.noShopsYet}</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {(shops ?? []).map((s) => (
            <li key={s.id}>
              <Link href={`/shops/${s.id}/edit`} className="card block p-4">
                <span className="block truncate font-extrabold">{s.name}</span>
                <span className="mt-0.5 block truncate text-sm text-stone-500">
                  {[s.area, s.phone].filter(Boolean).join(" · ") || "—"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
