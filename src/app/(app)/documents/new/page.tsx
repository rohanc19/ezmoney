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
  const { clients, profile, rateCard, recentDescriptions, today } = await getFormData();

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
        initial={{ doc_date: today, client_id: "", site_job: "", notes: "", status: "draft" }}
        initialItems={[]}
        clients={clients}
        rateCard={rateCard}
        gstEnabled={profile?.gst_enabled ?? false}
        gstRate={Number(profile?.gst_rate ?? 0.18)}
        defaultHsn={profile?.default_hsn_sac ?? ""}
        recentDescriptions={recentDescriptions}
        t={t}
      />
    </main>
  );
}
