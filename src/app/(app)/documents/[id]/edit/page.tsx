import Link from "next/link";
import { notFound } from "next/navigation";
import DocumentForm from "@/components/DocumentForm";
import { saveDocument } from "@/lib/actions";
import { getDict } from "@/lib/i18n";
import { getFormData } from "@/lib/queries";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function EditDocumentPage({ params }: { params: { id: string } }) {
  const t = getDict();
  const supabase = supabaseServer();
  const [{ data: doc }, { data: items }, formData] = await Promise.all([
    supabase.from("documents").select("*").eq("id", params.id).maybeSingle(),
    supabase.from("line_items").select("*").eq("document_id", params.id).order("position"),
    getFormData(),
  ]);
  if (!doc) notFound();

  const { clients, profile, rateCard, recentDescriptions, priceHints } = formData;

  return (
    <main>
      <div className="mb-4 flex items-center gap-3">
        <Link href={`/documents/${doc.id}`} className="btn-secondary px-3">
          ← {t.back}
        </Link>
        <h1 className="text-2xl font-extrabold">
          {t.edit} · {doc.serial_no}
        </h1>
      </div>
      <DocumentForm
        action={saveDocument}
        id={doc.id}
        type={doc.type}
        initial={{
          doc_date: doc.doc_date,
          client_id: doc.client_id ?? "",
          site_job: doc.site_job,
          notes: doc.notes,
          status: doc.status,
          service_charge_mode: doc.service_charge_mode ?? "none",
          service_charge_value:
            Number(doc.service_charge_value) > 0 ? String(doc.service_charge_value) : "",
          service_charge_label:
            doc.service_charge_label || profile?.service_charge_label || "Service Charge",
        }}
        initialItems={(items ?? []).map((i) => ({
          description: i.description,
          qty: String(i.qty),
          unit: i.unit,
          rate: String(i.rate),
          hsn: i.hsn_sac ?? "",
        }))}
        clients={clients}
        rateCard={rateCard}
        gstEnabled={profile?.gst_enabled ?? false}
        gstRate={Number(profile?.gst_rate ?? 0.18)}
        defaultHsn={profile?.default_hsn_sac ?? ""}
        recentDescriptions={recentDescriptions}
        priceHints={priceHints}
        t={t}
      />
    </main>
  );
}
