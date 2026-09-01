import Link from "next/link";
import ClientForm from "@/components/ClientForm";
import { getDict } from "@/lib/i18n";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function NewClientPage() {
  const t = getDict();
  const supabase = supabaseServer();
  const { data: profile } = await supabase
    .from("business_profile")
    .select("gst_enabled, state_code")
    .maybeSingle();

  return (
    <main>
      <div className="mb-4 flex items-center gap-3">
        <Link href="/clients" className="btn-secondary px-3">
          ← {t.back}
        </Link>
        <h1 className="text-2xl font-extrabold">{t.clientName}</h1>
      </div>
      <ClientForm
        t={t}
        gstEnabled={profile?.gst_enabled ?? false}
        defaultStateCode={profile?.state_code ?? "29"}
      />
    </main>
  );
}
