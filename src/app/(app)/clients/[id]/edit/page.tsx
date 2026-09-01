import Link from "next/link";
import { notFound } from "next/navigation";
import ClientForm from "@/components/ClientForm";
import { getDict } from "@/lib/i18n";
import { supabaseServer } from "@/lib/supabase/server";
import type { Client } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function EditClientPage({ params }: { params: { id: string } }) {
  const t = getDict();
  const supabase = supabaseServer();
  const [{ data: client }, { data: profile }] = await Promise.all([
    supabase.from("clients").select("*").eq("id", params.id).maybeSingle(),
    supabase.from("business_profile").select("gst_enabled, state_code").maybeSingle(),
  ]);
  if (!client) notFound();

  return (
    <main>
      <div className="mb-4 flex items-center gap-3">
        <Link href={`/clients/${client.id}`} className="btn-secondary px-3">
          ← {t.back}
        </Link>
        <h1 className="truncate text-2xl font-extrabold">{t.edit}</h1>
      </div>
      <ClientForm
        t={t}
        client={client as Client}
        gstEnabled={profile?.gst_enabled ?? false}
        defaultStateCode={profile?.state_code ?? "29"}
      />
    </main>
  );
}
