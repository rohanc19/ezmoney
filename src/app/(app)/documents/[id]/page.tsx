import Link from "next/link";
import { notFound } from "next/navigation";
import ConfirmButton from "@/components/ConfirmButton";
import PrintButton from "@/components/PrintButton";
import StatusPill from "@/components/StatusPill";
import { convertToInvoice, deleteDocument, setDocumentStatus } from "@/lib/actions";
import { amountInWords, formatDate, formatINR, formatIndianNumber } from "@/lib/format";
import { getDict } from "@/lib/i18n";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function waLink(phone: string, text: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return null;
  const full = digits.length === 10 ? "91" + digits : digits;
  return `https://wa.me/${full}?text=${encodeURIComponent(text)}`;
}

export default async function DocumentViewPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { saved?: string };
}) {
  const t = getDict();
  const supabase = supabaseServer();

  const [{ data: doc }, { data: items }, { data: profile }] = await Promise.all([
    supabase
      .from("documents")
      .select("*, clients(name, phone, address)")
      .eq("id", params.id)
      .maybeSingle(),
    supabase.from("line_items").select("*").eq("document_id", params.id).order("position"),
    supabase.from("business_profile").select("*").maybeSingle(),
  ]);
  if (!doc) notFound();

  const isInvoice = doc.type === "invoice";
  const gstOn = (profile?.gst_enabled ?? false) && Number(doc.gst_amount) > 0;
  const title = isInvoice ? (gstOn ? t.taxInvoice : "INVOICE") : "ESTIMATE";

  // linked docs
  let linkedEstimateSerial: string | null = null;
  if (doc.linked_estimate_id) {
    const { data: est } = await supabase
      .from("documents")
      .select("serial_no")
      .eq("id", doc.linked_estimate_id)
      .maybeSingle();
    linkedEstimateSerial = est?.serial_no ?? null;
  }
  let linkedInvoice: { id: string; serial_no: string } | null = null;
  if (!isInvoice) {
    const { data: inv } = await supabase
      .from("documents")
      .select("id, serial_no")
      .eq("linked_estimate_id", doc.id)
      .maybeSingle();
    linkedInvoice = inv ?? null;
  }

  const client = doc.clients as { name: string; phone: string; address: string } | null;
  const waText = `${title} ${doc.serial_no} — ${profile?.business_name ?? ""}\n${doc.site_job}\n${t.total}: ${formatINR(Number(doc.total))}${isInvoice && profile?.upi_id ? `\nUPI: ${profile.upi_id}` : ""}`;
  const wa = client?.phone ? waLink(client.phone, waText) : null;

  return (
    <main>
      {/* ---------- app controls (hidden in print) ---------- */}
      <div className="no-print">
        <div className="mb-4 flex items-center justify-between gap-3">
          <Link href="/" className="btn-secondary px-3">
            ← {t.back}
          </Link>
          <StatusPill status={doc.status} label={t.statusLabels[doc.status]} />
        </div>

        {searchParams.saved && (
          <p className="mb-3 rounded-xl bg-green-100 p-3 text-center font-semibold text-green-900">
            {t.saved}
          </p>
        )}

        <div className="mb-4 flex gap-2">
          <PrintButton label={t.saveAsPdf} />
          {wa && (
            <a href={wa} target="_blank" rel="noopener noreferrer" className="btn-secondary flex-1">
              {t.sendOnWhatsApp}
            </a>
          )}
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          <Link href={`/documents/${doc.id}/edit`} className="btn-secondary">
            ✏️ {t.edit}
          </Link>

          {!isInvoice && doc.status === "draft" && (
            <form action={setDocumentStatus}>
              <input type="hidden" name="id" value={doc.id} />
              <input type="hidden" name="status" value="sent" />
              <button className="btn-secondary">{t.markSent}</button>
            </form>
          )}
          {!isInvoice && (doc.status === "draft" || doc.status === "sent") && (
            <>
              <form action={setDocumentStatus}>
                <input type="hidden" name="id" value={doc.id} />
                <input type="hidden" name="status" value="approved" />
                <button className="btn-secondary">{t.markApproved}</button>
              </form>
              <form action={setDocumentStatus}>
                <input type="hidden" name="id" value={doc.id} />
                <input type="hidden" name="status" value="rejected" />
                <button className="btn-secondary">{t.markRejected}</button>
              </form>
            </>
          )}
          {isInvoice && doc.status === "draft" && (
            <form action={setDocumentStatus}>
              <input type="hidden" name="id" value={doc.id} />
              <input type="hidden" name="status" value="sent" />
              <button className="btn-secondary">{t.markSent}</button>
            </form>
          )}
          {isInvoice && doc.status !== "paid" && (
            <form action={setDocumentStatus}>
              <input type="hidden" name="id" value={doc.id} />
              <input type="hidden" name="status" value="paid" />
              <button className="btn-secondary">✓ {t.markPaid}</button>
            </form>
          )}
        </div>

        {!isInvoice && doc.status === "approved" && !linkedInvoice && (
          <form action={convertToInvoice} className="mb-4">
            <input type="hidden" name="id" value={doc.id} />
            <button className="btn-primary w-full text-xl">→ {t.makeFinalInvoice}</button>
          </form>
        )}
        {linkedInvoice && (
          <p className="mb-4 rounded-xl bg-teal-50 p-3 text-center">
            {t.finalInvoice}:{" "}
            <Link href={`/documents/${linkedInvoice.id}`} className="font-bold text-accent underline">
              {linkedInvoice.serial_no}
            </Link>
          </p>
        )}
      </div>

      {/* ---------- the printable document ---------- */}
      <div className="print-page rounded-2xl bg-white p-6 shadow-sm sm:p-8">
        {/* header */}
        <div className="flex items-start justify-between gap-4 border-b-2 border-stone-800 pb-4">
          <div>
            <h1 className="text-2xl font-extrabold leading-tight">{profile?.business_name}</h1>
            <p className="mt-1 text-sm text-stone-600">
              {profile?.address}
              {profile?.city_pin ? `, ${profile.city_pin}` : ""}
            </p>
            <p className="text-sm text-stone-600">
              {profile?.phone}
              {profile?.email ? ` · ${profile.email}` : ""}
            </p>
            {profile?.gst_enabled && profile?.gstin && (
              <p className="text-sm text-stone-600">GSTIN: {profile.gstin}</p>
            )}
          </div>
          <div className="text-right">
            <p className="text-xl font-extrabold tracking-wide">{title}</p>
            <p className="mt-1 font-semibold">{doc.serial_no}</p>
            <p className="text-sm text-stone-600">{formatDate(doc.doc_date)}</p>
            <p className="mt-1 text-sm">
              <StatusPill status={doc.status} label={t.statusLabels[doc.status]} />
            </p>
          </div>
        </div>

        {/* bill to */}
        <div className="mt-4">
          <p className="text-xs font-bold uppercase tracking-wide text-stone-500">{t.billTo}</p>
          <p className="mt-0.5 font-semibold">{client?.name ?? "—"}</p>
          {client?.address && <p className="text-sm text-stone-600">{client.address}</p>}
          {client?.phone && <p className="text-sm text-stone-600">{client.phone}</p>}
          {doc.site_job && <p className="mt-1 text-sm text-stone-700">{doc.site_job}</p>}
          {isInvoice && linkedEstimateSerial && (
            <p className="mt-1 text-xs text-stone-500">
              {t.refEstimate}: {linkedEstimateSerial}
            </p>
          )}
        </div>

        {/* items table */}
        <table className="mt-5 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-stone-800 text-left">
              <th className="py-2 pr-2">Sr</th>
              <th className="py-2 pr-2">Description</th>
              <th className="py-2 pr-2 text-right">Qty</th>
              <th className="py-2 pr-2">Unit</th>
              <th className="py-2 pr-2 text-right">Rate</th>
              <th className="py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {(items ?? []).map((i, idx) => (
              <tr key={i.id} className="border-b border-stone-200 align-top">
                <td className="py-2 pr-2">{idx + 1}</td>
                <td className="py-2 pr-2">{i.description}</td>
                <td className="py-2 pr-2 text-right">{formatIndianNumber(Number(i.qty), 0)}</td>
                <td className="py-2 pr-2">{i.unit}</td>
                <td className="py-2 pr-2 text-right">{formatIndianNumber(Number(i.rate))}</td>
                <td className="py-2 text-right">{formatIndianNumber(Number(i.amount))}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* totals */}
        <div className="mt-3 ml-auto w-full max-w-xs text-sm">
          <div className="flex justify-between py-1">
            <span>{t.subtotal}</span>
            <span>{formatINR(Number(doc.subtotal))}</span>
          </div>
          {gstOn && (
            <div className="flex justify-between py-1">
              <span>
                {t.gst} ({((profile?.gst_rate ?? 0.18) * 100).toFixed(0)}%)
              </span>
              <span>{formatINR(Number(doc.gst_amount))}</span>
            </div>
          )}
          <div className="mt-1 flex justify-between border-t-2 border-stone-800 py-2 text-lg font-extrabold">
            <span>{t.total}</span>
            <span>{formatINR(Number(doc.total))}</span>
          </div>
        </div>
        <p className="mt-1 text-right text-xs italic text-stone-600">
          {t.inWords}: {amountInWords(Number(doc.total))}
        </p>

        {doc.notes && <p className="mt-4 text-sm text-stone-700">{doc.notes}</p>}

        {/* footer */}
        <div className="mt-6 border-t border-stone-300 pt-4 text-sm">
          {(profile?.bank_name || profile?.upi_id) && (
            <div className="text-stone-700">
              {profile?.bank_name && (
                <p>
                  {profile.bank_name}
                  {profile.account_no ? ` · A/c ${profile.account_no}` : ""}
                  {profile.ifsc ? ` · IFSC ${profile.ifsc}` : ""}
                </p>
              )}
              {profile?.upi_id && <p>UPI: {profile.upi_id}</p>}
            </div>
          )}
          <p className="mt-2 text-xs text-stone-500">
            {isInvoice ? profile?.payment_terms : profile?.estimate_validity_note}
          </p>

          <div className="mt-10 flex items-end justify-between gap-6">
            {!isInvoice ? (
              <p className="text-xs text-stone-600">
                {t.approvedBy}: ____________________ &nbsp; Date: __________
              </p>
            ) : (
              <span />
            )}
            <div className="text-center">
              <p className="mb-10 text-xs text-stone-500">
                {t.signFor} <span className="font-semibold text-stone-800">{profile?.business_name}</span>
              </p>
              <p className="border-t border-stone-400 px-6 pt-1 text-xs text-stone-600">Signature</p>
            </div>
          </div>
        </div>
      </div>

      {/* delete (hidden in print) */}
      <form action={deleteDocument} className="no-print mt-6">
        <input type="hidden" name="id" value={doc.id} />
        <ConfirmButton message={t.confirmDeleteDoc} className="btn-danger w-full">
          🗑 {t.delete}
        </ConfirmButton>
      </form>
    </main>
  );
}
