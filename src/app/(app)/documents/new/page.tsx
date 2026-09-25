import Link from "next/link";
import DocumentForm from "@/components/DocumentForm";
import { saveDocument } from "@/lib/actions";
import { getDict } from "@/lib/i18n";
import { getFormData } from "@/lib/queries";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function NewDocumentPage({
  searchParams,
}: {
  searchParams: { type?: string; points?: string };
}) {
  const t = getDict();
  const type = searchParams.type === "invoice" ? "invoice" : "estimate";
  const { clients, profile, rateCard, recentDescriptions, priceHints, ownRates, today } = await getFormData();

  // Priced by points: the shape his 2017 and 2020 whole-house sheets took.
  // Every point rate is laid out with the count left blank, so the job is
  // counting rooms rather than hunting 25 items out of 273. A row he
  // leaves empty is not part of the bill and never reaches it.
  //
  // Queried directly rather than filtered out of `rateCard`, which stops
  // at 200 of his items and would silently drop some of the points.
  const byPoints = searchParams.points === "1";
  let pointRows: {
    description: string;
    qty: string;
    unit: string;
    rate: string;
    hsn: string;
    section: string;
  }[] = [];
  if (byPoints) {
    const { data: points } = await supabaseServer()
      .from("rate_card_items")
      .select("description, unit, rate, hsn_sac")
      .eq("category", "Point")
      .order("rate", { ascending: false });
    pointRows = (points ?? []).map((r) => ({
      description: r.description,
      qty: "",
      unit: r.unit,
      rate: String(r.rate),
      hsn: r.hsn_sac || (profile?.default_hsn_sac ?? ""),
      section: "",
    }));
  }

  // Start a new bill with his usual service charge already filled in.
  const usualPercent = Number(profile?.default_service_charge_percent ?? 0);

  return (
    <main>
      <div className="mb-4 flex items-center gap-3">
        <Link href="/" className="btn-secondary px-3">
          ← {t.back}
        </Link>
        <h1 className="text-2xl font-extrabold">
          {byPoints ? t.byPoints : type === "invoice" ? t.newInvoice : t.newEstimate}
        </h1>
      </div>
      <DocumentForm
        action={saveDocument}
        type={type}
        initial={{
          doc_date: today,
          due_date: "",
          client_id: "",
          site_job: "",
          notes: "",
          status: "draft",
          service_charge_mode: usualPercent > 0 ? "percent" : "none",
          service_charge_value: usualPercent > 0 ? String(usualPercent) : "",
          service_charge_label: profile?.service_charge_label || "Service Charge",
        }}
        initialItems={pointRows}
        variant={byPoints ? "points" : undefined}
        clients={clients}
        rateCard={rateCard}
        gstEnabled={profile?.gst_enabled ?? false}
        gstRate={Number(profile?.gst_rate ?? 0.18)}
        defaultHsn={profile?.default_hsn_sac ?? ""}
        recentDescriptions={recentDescriptions}
        priceHints={priceHints}
        ownRates={ownRates}
        t={t}
      />
    </main>
  );
}
