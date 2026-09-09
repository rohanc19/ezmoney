import Link from "next/link";
import { notFound } from "next/navigation";
import ShopForm from "@/components/ShopForm";
import { getDict } from "@/lib/i18n";
import { supabaseServer } from "@/lib/supabase/server";
import type { Shop } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function EditShopPage({ params }: { params: { id: string } }) {
  const t = getDict();
  const supabase = supabaseServer();
  const [{ data: shop }, { data: shops }] = await Promise.all([
    supabase.from("shops").select("*").eq("id", params.id).maybeSingle(),
    supabase.from("shops").select("area"),
  ]);
  if (!shop) notFound();
  const areas = [...new Set((shops ?? []).map((s) => s.area).filter(Boolean))].sort();

  return (
    <main>
      <div className="mb-4 flex items-center gap-3">
        <Link href={`/shops/${shop.id}`} className="btn-secondary px-3">
          ← {t.back}
        </Link>
        <h1 className="truncate text-2xl font-extrabold">{t.edit}</h1>
      </div>
      <datalist id="known-areas">
        {areas.map((a) => (
          <option key={a} value={a} />
        ))}
      </datalist>
      <ShopForm t={t} shop={shop as Shop} />
    </main>
  );
}
