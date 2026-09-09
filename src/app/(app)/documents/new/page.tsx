import Link from "next/link";
import DocumentForm from "@/components/DocumentForm";
import { saveDocument } from "@/lib/actions";
import { getDict } from "@/lib/i18n";
import { getFormData } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function NewDocumentPage({
  searchParams,
}: {
  searchParams: { type?: string };
}) {
  const t = getDict();
  const type = searchParams.type === "invoice" ? "invoice" : "estimate";
  const { clients, profile, rateCard, recentDescriptions, priceHints, today } = await getFormData();

  // Start a new bill with his usual service charge already filled in.
  const usualPercent = Number(profile?.default_service_charge_percent ?? 0);

  return (
    <main>
      <div className="mb-4 flex items-center gap-3">
        <Link href="/" className="btn-secondary px-3">
          ← {t.back}
        </Link>
        <h1 className="text-2xl font-extrabold">
          {type === "invoice" ? t.newInvoice : t.newEstimate}
        </h1>
      </div>
      <DocumentForm
        action={saveDocument}
        type={type}
        initial={{
          doc_date: today,
          client_id: "",
          site_job: "",
          notes: "",
          status: "draft",
          service_charge_mode: usualPercent > 0 ? "percent" : "none",
          service_charge_value: usualPercent > 0 ? String(usualPercent) : "",
          service_charge_label: profile?.service_charge_label || "Service Charge",
        }}
        initialItems={[]}
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
