import Link from "next/link";
import { notFound } from "next/navigation";
import ConfirmButton from "@/components/ConfirmButton";
import PrintButton from "@/components/PrintButton";
import StatusPill from "@/components/StatusPill";
import {
  convertToInvoice,
  deleteDocument,
  deletePayment,
  recordPayment,
  setDocumentStatus,
} from "@/lib/actions";
import { amountInWords, formatDate, formatINR, formatIndianNumber, todayISO } from "@/lib/format";
import { computeTotals } from "@/lib/gst";
import { getDict } from "@/lib/i18n";
import { supabaseServer } from "@/lib/supabase/server";
import { buildUpiUri, upiQrSvg } from "@/lib/upi";
import { PAID_VIA, STATES, type Payment } from "@/lib/types";

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

  const [{ data: doc }, { data: items }, { data: profile }, { data: paymentsRaw }] =
    await Promise.all([
    supabase
      .from("documents")
      .select("*, clients(id, name, phone, address, gstin, state_code, state_name)")
      .eq("id", params.id)
      .maybeSingle(),
    supabase.from("line_items").select("*").eq("document_id", params.id).order("position"),
    supabase.from("business_profile").select("*").maybeSingle(),
    supabase
      .from("payments")
      .select("*")
      .eq("document_id", params.id)
      .order("paid_on", { ascending: false }),
  ]);
  if (!doc) notFound();

  // What has actually come in against this bill.
  const payments = (paymentsRaw ?? []) as Payment[];
  const received = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const balance = Math.round((Number(doc.total) - received) * 100) / 100;

  const isInvoice = doc.type === "invoice";
  const gstOn = (profile?.gst_enabled ?? false) && Number(doc.gst_amount) > 0;
  const title = isInvoice ? (gstOn ? t.taxInvoice : "INVOICE") : "ESTIMATE";

  // Recompute from the stored line items so the printed page can never
  // disagree with the numbers, even for older bills.
  const totals = computeTotals(
    (items ?? []).map((i) => ({
      description: i.description,
      qty: Number(i.qty),
      unit: i.unit,
      rate: Number(i.rate),
      amount: Number(i.amount),
      hsn_sac: i.hsn_sac ?? "",
      gst_rate: Number(i.gst_rate ?? 0),
    })),
    {
      gstEnabled: profile?.gst_enabled ?? false,
      sellerStateCode: profile?.state_code ?? "",
      placeOfSupplyCode: doc.place_of_supply ?? "",
      fallbackRate: Number(profile?.gst_rate ?? 0.18),
      serviceCharge: Number(doc.service_charge_amount ?? 0),
    }
  );

  // linked documents
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

  const client = doc.clients as {
    id: string;
    name: string;
    phone: string;
    address: string;
    gstin: string | null;
    state_code: string;
    state_name: string;
  } | null;

  // ---- UPI QR: only on invoices, only when a UPI ID is set ----
  let qrSvg: string | null = null;
  if (isInvoice && profile?.upi_id) {
    const uri = buildUpiUri({
      upiId: profile.upi_id,
      payeeName: profile.business_name || profile.proprietor_name || "Payee",
      amount: Number(doc.total),
      note: doc.serial_no,
    });
    if (uri) qrSvg = await upiQrSvg(uri);
  }

  const placeOfSupplyName =
    STATES.find((s) => s.code === doc.place_of_supply)?.name ||
    client?.state_name ||
    profile?.state_name ||
    "";

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
          <p className="mb-3 rounded-2xl bg-green-100 p-3 text-center font-bold text-green-900">
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
            {t.edit}
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
          {isInvoice && balance > 0 && (
            <form action={recordPayment}>
              <input type="hidden" name="document_id" value={doc.id} />
              <input type="hidden" name="full" value="1" />
              <button className="btn-secondary">{t.markFullyPaid}</button>
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
          <p className="mb-4 rounded-2xl bg-accent-wash p-3 text-center">
            {t.finalInvoice}:{" "}
            <Link
              href={`/documents/${linkedInvoice.id}`}
              className="font-extrabold text-accent underline"
            >
              {linkedInvoice.serial_no}
            </Link>
          </p>
        )}
      </div>

      {/* ---------- what has come in ---------- */}
      {isInvoice && (
        <div className="no-print mb-6">
          <div className="card p-4">
            <div className="grid grid-cols-3 gap-2">
              <div>
                <p className="text-xs font-semibold text-stone-500">{t.total}</p>
                <p className="tnum mt-0.5 font-extrabold">{formatINR(Number(doc.total), 0)}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-stone-500">{t.amountReceived}</p>
                <p className="tnum mt-0.5 font-extrabold text-green-800">
                  {formatINR(received, 0)}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-stone-500">{t.balanceDue}</p>
                <p
                  className={`tnum mt-0.5 font-extrabold ${
                    balance > 0 ? "text-amber-700" : "text-stone-800"
                  }`}
                >
                  {formatINR(balance, 0)}
                </p>
              </div>
            </div>

            {balance > 0 && (
              <details className="mt-4 border-t border-line pt-3">
                <summary className="min-h-[44px] cursor-pointer list-none font-extrabold text-accent-dark">
                  ＋ {t.recordPayment}
                </summary>
                <form action={recordPayment} className="mt-3 space-y-4">
                  <input type="hidden" name="document_id" value={doc.id} />
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="label" htmlFor="pay_amount">
                        {t.amount} (₹)
                      </label>
                      <input
                        id="pay_amount"
                        name="amount"
                        inputMode="decimal"
                        required
                        placeholder={String(balance)}
                        className="field tnum"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="label" htmlFor="pay_date">
                        {t.paymentDate}
                      </label>
                      <input
                        id="pay_date"
                        type="date"
                        name="paid_on"
                        defaultValue={todayISO()}
                        className="field"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="label" htmlFor="pay_method">
                      {t.paymentMethod}
                    </label>
                    <select id="pay_method" name="method" className="field">
                      {PAID_VIA.map((m) => (
                        <option key={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label" htmlFor="pay_notes">
                      {t.notes}
                    </label>
                    <input id="pay_notes" name="notes" className="field" />
                  </div>
                  <button type="submit" className="btn-primary w-full">
                    {t.save}
                  </button>
                </form>
              </details>
            )}

            {payments.length > 0 && (
              <ul className="mt-3 divide-y divide-line border-t border-line">
                {payments.map((p) => (
                  <li key={p.id} className="flex items-start justify-between gap-3 py-2">
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold">
                        {formatDate(p.paid_on)} · {p.method}
                      </span>
                      {p.notes && (
                        <span className="block text-xs text-stone-500">{p.notes}</span>
                      )}
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="tnum block font-extrabold text-green-800">
                        {formatINR(Number(p.amount), 0)}
                      </span>
                      <form action={deletePayment}>
                        <input type="hidden" name="id" value={p.id} />
                        <input type="hidden" name="document_id" value={doc.id} />
                        <ConfirmButton
                          message={t.confirmDeletePayment}
                          className="mt-0.5 min-h-[36px] rounded-lg px-2 text-xs font-semibold text-red-700"
                        >
                          ✕ {t.delete}
                        </ConfirmButton>
                      </form>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {payments.length === 0 && (
              <p className="mt-3 border-t border-line pt-3 text-sm text-stone-500">
                {t.noPaymentsYet}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ---------- the printable document ----------
           One ruled sheet. Labels here stay in English: this is the
           piece of paper his client, and their accountant, will read. */}
      <div className="doc">
        <p className="doc-title">{title}</p>

        {/* who is billing · the bill's own numbers */}
        <div className="doc-head">
          <div className="doc-cell">
            <p className="text-lg font-extrabold leading-tight">{profile?.business_name}</p>
            {profile?.proprietor_name && (
              <p className="text-[0.8rem] text-stone-600">{profile.proprietor_name}</p>
            )}
            <p className="mt-1 text-[0.8rem] leading-snug text-stone-600">
              {profile?.address}
              {profile?.city_pin ? `, ${profile.city_pin}` : ""}
            </p>
            <p className="text-[0.8rem] text-stone-600">
              {profile?.phone}
              {profile?.email ? ` · ${profile.email}` : ""}
            </p>
            {profile?.gst_enabled && profile?.gstin && (
              <p className="mt-1 text-[0.8rem] font-bold">GSTIN: {profile.gstin}</p>
            )}
          </div>

          <div className="doc-cell">
            <p className="doc-kv">
              <span>{isInvoice ? "Invoice No." : "Estimate No."}</span>
              <span className="tnum">{doc.serial_no}</span>
            </p>
            <p className="doc-kv">
              <span>Date</span>
              <span className="tnum">{formatDate(doc.doc_date)}</span>
            </p>
            {gstOn && placeOfSupplyName && (
              <p className="doc-kv">
                <span>Place of supply</span>
                <span>
                  {placeOfSupplyName}
                  {doc.place_of_supply ? ` (${doc.place_of_supply})` : ""}
                </span>
              </p>
            )}
            {isInvoice && linkedEstimateSerial && (
              <p className="doc-kv">
                <span>Ref. estimate</span>
                <span className="tnum">{linkedEstimateSerial}</span>
              </p>
            )}
            <p className="doc-kv">
              <span>Status</span>
              <span>{t.statusLabels[doc.status]}</span>
            </p>
          </div>
        </div>

        {/* who it is for · what the job was */}
        <div className="doc-head">
          <div className="doc-cell">
            <p className="doc-eyebrow">Bill To</p>
            <p className="mt-1 font-extrabold">{client?.name ?? "—"}</p>
            {client?.address && (
              <p className="text-[0.8rem] leading-snug text-stone-600">{client.address}</p>
            )}
            {client?.phone && <p className="text-[0.8rem] text-stone-600">{client.phone}</p>}
            {gstOn && client?.gstin && (
              <p className="text-[0.8rem] font-semibold">GSTIN: {client.gstin}</p>
            )}
          </div>
          <div className="doc-cell">
            <p className="doc-eyebrow">Site / Job</p>
            <p className="mt-1 text-[0.85rem] leading-snug">{doc.site_job || "—"}</p>
          </div>
        </div>

        {/* the items */}
        <div className="overflow-x-auto">
          <table className="doc-table">
            <thead>
              <tr>
                <th className="w-9">Sr</th>
                <th>Description</th>
                {gstOn && <th>{t.hsn}</th>}
                <th className="doc-num">Qty</th>
                <th>Unit</th>
                <th className="doc-num">Rate (₹)</th>
                <th className="doc-num">Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              {(items ?? []).map((i, idx) => (
                <tr key={i.id}>
                  <td className="tnum">{idx + 1}</td>
                  <td>{i.description}</td>
                  {gstOn && <td className="tnum">{i.hsn_sac || "—"}</td>}
                  <td className="doc-num">{formatIndianNumber(Number(i.qty), 0)}</td>
                  <td>{i.unit}</td>
                  <td className="doc-num">{formatIndianNumber(Number(i.rate))}</td>
                  <td className="doc-num">{formatIndianNumber(Number(i.amount))}</td>
                </tr>
              ))}
              {(items ?? []).length === 0 && (
                <tr>
                  <td colSpan={gstOn ? 7 : 6} className="text-center text-stone-500">
                    —
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* amount in words · the money */}
        <div className="doc-summary print-avoid-break">
          <div className="doc-cell">
            <p className="doc-eyebrow">Amount in words</p>
            <p className="mt-1 text-[0.85rem] font-semibold leading-snug">
              {amountInWords(Number(doc.total))}
            </p>
            {doc.notes && (
              <>
                <p className="doc-eyebrow mt-3">Notes</p>
                <p className="mt-1 text-[0.8rem] leading-snug text-stone-700">{doc.notes}</p>
              </>
            )}
          </div>

          <div className="doc-cell">
            {totals.serviceCharge > 0 ? (
              <>
                <p className="doc-line">
                  <span>Subtotal</span>
                  <span className="tnum">{formatINR(totals.subtotal)}</span>
                </p>
                <p className="doc-line">
                  <span>
                    {doc.service_charge_label || "Service Charge"}
                    {doc.service_charge_mode === "percent"
                      ? ` (${formatIndianNumber(Number(doc.service_charge_value), 0)}%)`
                      : ""}
                  </span>
                  <span className="tnum">{formatINR(totals.serviceCharge)}</span>
                </p>
                {gstOn && (
                  <p className="doc-line font-semibold">
                    <span>{t.taxableValue}</span>
                    <span className="tnum">{formatINR(totals.taxableValue)}</span>
                  </p>
                )}
              </>
            ) : (
              <p className="doc-line">
                <span>{gstOn ? t.taxableValue : t.subtotal}</span>
                <span className="tnum">{formatINR(totals.taxableValue)}</span>
              </p>
            )}

            {gstOn &&
              (totals.interState ? (
                <p className="doc-line">
                  <span>{t.igst}</span>
                  <span className="tnum">{formatINR(totals.igst)}</span>
                </p>
              ) : (
                <>
                  <p className="doc-line">
                    <span>{t.cgst}</span>
                    <span className="tnum">{formatINR(totals.cgst)}</span>
                  </p>
                  <p className="doc-line">
                    <span>{t.sgst}</span>
                    <span className="tnum">{formatINR(totals.sgst)}</span>
                  </p>
                </>
              ))}

            <p className="doc-line doc-line-total">
              <span>{t.total}</span>
              <span className="tnum">{formatINR(Number(doc.total))}</span>
            </p>

            {isInvoice && received > 0 && (
              <>
                <p className="doc-line">
                  <span>{t.amountReceived}</span>
                  <span className="tnum">− {formatINR(received)}</span>
                </p>
                <p className="doc-line font-extrabold">
                  <span>{balance > 0 ? t.balanceDue : t.fullySettled}</span>
                  <span className="tnum">{formatINR(balance)}</span>
                </p>
              </>
            )}
          </div>
        </div>

        {/* tax summary by slab — required on a proper tax invoice */}
        {gstOn && totals.slabs.length > 0 && (
          <div className="print-avoid-break border-t border-[color:var(--doc-rule)]">
            <p className="doc-eyebrow px-[0.9rem] pt-2">{t.taxSummary}</p>
            <div className="overflow-x-auto pt-1">
              <table className="doc-table doc-table-fixed">
                <thead>
                  <tr>
                    <th>Rate</th>
                    <th className="doc-num">{t.taxableValue} (₹)</th>
                    {totals.interState ? (
                      <th className="doc-num">{t.igst} (₹)</th>
                    ) : (
                      <>
                        <th className="doc-num">{t.cgst} (₹)</th>
                        <th className="doc-num">{t.sgst} (₹)</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {totals.slabs.map((sl) => (
                    <tr key={sl.rate}>
                      <td className="tnum">{(sl.rate * 100).toFixed(0)}%</td>
                      <td className="doc-num">{formatIndianNumber(sl.taxable)}</td>
                      {totals.interState ? (
                        <td className="doc-num">{formatIndianNumber(sl.igst)}</td>
                      ) : (
                        <>
                          <td className="doc-num">{formatIndianNumber(sl.cgst)}</td>
                          <td className="doc-num">{formatIndianNumber(sl.sgst)}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* how to pay · who signed */}
        <div className="doc-foot print-avoid-break">
          <div className="doc-cell">
            {(profile?.bank_name || profile?.upi_id) && (
              <>
                <p className="doc-eyebrow">How to pay</p>
                <div className="mt-1 flex flex-wrap items-start gap-4">
                  <div className="min-w-[9rem] flex-1 text-[0.8rem] leading-snug text-stone-700">
                    {profile?.bank_name && (
                      <>
                        <p className="font-semibold">{profile.bank_name}</p>
                        {profile.account_no && <p className="tnum">A/c {profile.account_no}</p>}
                        {profile.ifsc && <p className="tnum">IFSC {profile.ifsc}</p>}
                      </>
                    )}
                    {profile?.upi_id && <p className="mt-1">UPI: {profile.upi_id}</p>}
                  </div>

                  {qrSvg && (
                    <div className="text-center">
                      <div
                        className="mx-auto h-[112px] w-[112px]"
                        // The QR is generated on the server; nothing here is user input.
                        dangerouslySetInnerHTML={{ __html: qrSvg }}
                      />
                      <p className="mt-1 text-[0.68rem] font-bold text-stone-700">{t.scanToPay}</p>
                    </div>
                  )}
                </div>
              </>
            )}
            <p className="mt-2 text-[0.7rem] leading-snug text-stone-500">
              {isInvoice ? profile?.payment_terms : profile?.estimate_validity_note}
            </p>
            {isInvoice && profile?.invoice_footer_note && (
              <p className="mt-1 text-[0.7rem] leading-snug text-stone-500">
                {profile.invoice_footer_note}
              </p>
            )}
          </div>

          <div className="doc-cell text-right">
            <p className="text-[0.75rem] text-stone-600">
              {t.signFor} <span className="font-extrabold text-ink">{profile?.business_name}</span>
            </p>
            <p className="doc-sign-line ml-auto inline-block px-8">Authorised Signature</p>
            {!isInvoice && (
              <p className="mt-4 text-left text-[0.7rem] text-stone-600">
                {t.approvedBy}: ____________________ &nbsp; Date: __________
              </p>
            )}
          </div>
        </div>
      </div>

      <form action={deleteDocument} className="no-print mt-6">
        <input type="hidden" name="id" value={doc.id} />
        <ConfirmButton message={t.confirmDeleteDoc} className="btn-danger w-full">
          {t.delete}
        </ConfirmButton>
      </form>
    </main>
  );
}
