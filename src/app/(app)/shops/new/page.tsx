import Link from "next/link";
import ShopForm from "@/components/ShopForm";
import { getDict } from "@/lib/i18n";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function NewShopPage() {
  const t = getDict();
  const supabase = supabaseServer();
  // Offer the areas he has already used, so they stay spelled the same way.
  const { data: shops } = await supabase.from("shops").select("area");
  const areas = [...new Set((shops ?? []).map((s) => s.area).filter(Boolean))].sort();

  return (
    <main>
      <div className="mb-4 flex items-center gap-3">
        <Link href="/shops" className="btn-secondary px-3">
          ← {t.back}
        </Link>
        <h1 className="text-2xl font-extrabold">{t.addShop}</h1>
      </div>
      <datalist id="known-areas">
        {areas.map((a) => (
          <option key={a} value={a} />
        ))}
      </datalist>
      <ShopForm t={t} />
    </main>
  );
}
