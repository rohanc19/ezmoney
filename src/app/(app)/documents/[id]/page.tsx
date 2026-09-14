import { Fragment } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import ConfirmButton from "@/components/ConfirmButton";
import ShareActions from "@/components/ShareActions";
import StatusPill from "@/components/StatusPill";
import {
  convertToInvoice,
  deleteDocument,
  deletePayment,
  recordPayment,
  setDocumentStatus,
} from "@/lib/actions";
import { amountInWords, formatDate, formatINR, formatIndianNumber, todayISO } from "@/lib/format";
import { computeLineTaxes, computeTotals } from "@/lib/gst";
import { docLabels, getDict } from "@/lib/i18n";
import { buildBillEmail } from "@/lib/share";
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
      .select("*, clients(*)")
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
  // English only: this title is printed on the customer's copy.
  const title = isInvoice
    ? gstOn
      ? docLabels.taxInvoice
      : docLabels.invoice
    : docLabels.estimate;

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
    email: string;
    address: string;
    gstin: string | null;
    pan: string | null;
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

  // The grid rows, with the tax split out per line and every column
  // reconciled against `totals` — so what the customer adds up on the
  // page is what the foot of the page says.
  const rows = computeLineTaxes(
    (items ?? []).map((i) => ({
      description: i.description,
      qty: Number(i.qty),
      unit: i.unit,
      rate: Number(i.rate),
      amount: Number(i.amount),
      hsn_sac: i.hsn_sac ?? "",
      gst_rate: Number(i.gst_rate ?? 0),
      section: ((i.section as string) ?? "").trim(),
    })),
    totals,
    {
      fallbackRate: Number(profile?.gst_rate ?? 0.18),
      serviceChargeLabel: doc.service_charge_label || "Service Charge",
    }
  );

  // His big estimates are named parts, each with its own subtotal — and he
  // writes a separate summary sheet listing just those figures. An empty
  // section means a plain bill, which is most of them.
  const rowGroups: { name: string; rows: typeof rows; taxable: number }[] = [];
  for (const r of rows) {
    const name = (r.section ?? "").trim();
    let group = rowGroups.find((g) => g.name === name);
    if (!group) {
      group = { name, rows: [], taxable: 0 };
      rowGroups.push(group);
    }
    group.rows.push(r);
    group.taxable = Math.round((group.taxable + r.taxable) * 100) / 100;
  }
  const hasParts = rowGroups.filter((g) => g.name).length > 1;

  // What the sheet prints. The stored total is what the app's own money
  // screens work from, but the sheet recomputes from the line items — see
  // "Line items are the source of truth" — so every figure printed below
  // is taken from `totals`, and the grid, the words and the ladder can
  // never disagree with each other on the page.
  const printedTotal = totals.total;
  const printedBalance = Math.round((printedTotal - received) * 100) / 100;

  // He totals the quantity column the way his accountant's sheet does.
  const totalQty = rows.reduce((s2, r) => s2 + r.qty, 0);
  // Sr · Description · [HSN] · Qty · Rate · Taxable · [tax columns] · [Total]
  const gridCols = gstOn ? (totals.interState ? 9 : 11) : 5;

  // A lockup file already carries the business name, so printing the name
  // as text beside it would say it twice.
  const logoUrl = (profile?.logo_url ?? "").trim();
  const logoHasName = logoUrl.includes("lockup");

  const clientStateName =
    client?.state_name || STATES.find((st) => st.code === client?.state_code)?.name || "";

  // The standing wording at the foot. Falls back to the older single-line
  // terms field so a profile that has never had the block filled in still
  // prints something.
  const termsText = (
    profile?.terms ||
    (isInvoice ? profile?.payment_terms : profile?.estimate_validity_note) ||
    ""
  ).trim();

  const placeOfSupplyName =
    STATES.find((s) => s.code === doc.place_of_supply)?.name ||
    client?.state_name ||
    profile?.state_name ||
    "";

  const waText = `${title} ${doc.serial_no} — ${profile?.business_name ?? ""}\n${doc.site_job}\n${t.total}: ${formatINR(Number(doc.total))}${isInvoice && profile?.upi_id ? `\nUPI: ${profile.upi_id}` : ""}`;
  const wa = client?.phone ? waLink(client.phone, waText) : null;

  // mailto: cannot attach the PDF, so the body carries the numbers and he
  // attaches the file he saved from the print view.
  const mail = client?.email
    ? buildBillEmail({
        type: isInvoice ? "invoice" : "estimate",
        serial: doc.serial_no,
        date: formatDate(doc.doc_date),
        siteJob: doc.site_job,
        total: formatINR(Number(doc.total)),
        received: isInvoice && received > 0 ? formatINR(received) : undefined,
        balance: isInvoice && received > 0 ? formatINR(balance) : undefined,
        clientName: client.name,
        clientEmail: client.email,
        businessName: profile?.business_name ?? "",
        proprietorName: profile?.proprietor_name ?? "",
        phone: profile?.phone ?? "",
        upiId: profile?.upi_id ?? "",
        terms: (isInvoice ? profile?.payment_terms : profile?.estimate_validity_note) ?? "",
      })
    : null;

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

        <ShareActions
          documentId={doc.id}
          isDraft={doc.status === "draft"}
          pdfLabel={t.saveAsPdf}
          waHref={wa}
          waLabel={t.sendOnWhatsApp}
          mailHref={mail?.gmailHref ?? null}
          mailLabel={t.sendByEmail}
        />

        {mail && (
          <p className="mb-4 text-sm text-stone-500">
            {t.attachPdfHint}{" "}
            <a href={mail.href} className="font-semibold text-accent underline">
              {t.otherMailApp}
            </a>
          </p>
        )}
        {!mail && client && (
          <p className="mb-4 text-sm text-stone-500">
            <Link
              href={`/clients/${client.id}/edit`}
              className="font-semibold text-accent underline"
            >
              {t.addClientEmail}
            </Link>
          </p>
        )}

        {!isInvoice && doc.status === "approved" && !linkedInvoice && (
          <form action={convertToInvoice} className="mb-4">
            <input type="hidden" name="id" value={doc.id} />
            <button className="btn-primary w-full text-xl">→ {t.makeFinalInvoice}</button>
          </form>
        )}
        {/* Everything he needs rarely. One primary action above; these
            stay reachable without competing with it. */}
        <details className="card mb-4 p-3">
          <summary className="min-h-[44px] cursor-pointer list-none px-1 font-bold text-stone-600">
            {t.more}
          </summary>
          <div className="mt-2 flex flex-wrap gap-2">
            <Link href={`/documents/${doc.id}/edit`} className="btn-secondary">
              {t.edit}
            </Link>

            {doc.status === "draft" && (
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

            <form action={deleteDocument}>
              <input type="hidden" name="id" value={doc.id} />
              <ConfirmButton message={t.confirmDeleteDoc}
                      confirmLabel={t.tapAgain} className="btn-danger">
                {t.delete}
              </ConfirmButton>
            </form>
          </div>
        </details>

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
                  + {t.recordPayment}
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
                      confirmLabel={t.tapAgain}
                          className="mt-0.5 min-h-[36px] rounded-lg px-2 text-xs font-semibold text-red-700"
                        >
                          × {t.delete}
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
           Modelled on the GST tax invoice his accountant already issues:
           letterhead, a ruled grid that carries the tax per line, and a
           foot that puts the bank, the terms and the signature where a
           clerk expects to find them.

           Every label comes from docLabels, which is English only: this
           is the piece of paper his client, and their accountant, will
           read. Do not reach for `t` below this line. */}
      <div className="doc">
        {/* letterhead: who is billing, and how to reach him */}
        <div className="doc-letterhead">
          <div className="doc-cell">
            <div className="doc-brand">
              {logoUrl && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={logoUrl} alt="" className="doc-logo" />
              )}
              {!logoHasName && (
                <p className="doc-business">{profile?.business_name}</p>
              )}
            </div>
            <p className="doc-address">
              {profile?.address}
              {profile?.city_pin ? `, ${profile.city_pin}` : ""}
            </p>
          </div>

          <div className="doc-cell doc-contact">
            {profile?.proprietor_name && (
              <p>
                <span>Name</span> : {profile.proprietor_name}
              </p>
            )}
            {profile?.phone && (
              <p>
                <span>{docLabels.phone}</span> : {profile.phone}
              </p>
            )}
            {profile?.email && (
              <p>
                <span>Email</span> : {profile.email}
              </p>
            )}
          </div>
        </div>

        {/* the banner: GSTIN · what this paper is · which copy */}
        <div className="doc-banner">
          <div className="doc-banner-side">
            {gstOn && profile?.gstin ? `GSTIN : ${profile.gstin}` : ""}
          </div>
          <p className="doc-banner-title">{title}</p>
          <div className="doc-banner-side doc-banner-right">
            {isInvoice ? docLabels.originalFor : ""}
          </div>
        </div>

        {/* who it is for · the bill's own numbers */}
        <div className="doc-parties">
          <div className="doc-cell">
            <p className="doc-eyebrow">{docLabels.customerDetail}</p>
            <dl className="doc-dl mt-1">
              <dt>{docLabels.ms}</dt>
              <dd className="font-bold">{client?.name ?? "—"}</dd>
              {client?.address && (
                <>
                  <dt>{docLabels.address}</dt>
                  <dd>{client.address}</dd>
                </>
              )}
              {client?.phone && (
                <>
                  <dt>{docLabels.phone}</dt>
                  <dd className="tnum">{client.phone}</dd>
                </>
              )}
              {gstOn && client?.gstin && (
                <>
                  <dt>GSTIN</dt>
                  <dd className="tnum font-semibold">{client.gstin}</dd>
                </>
              )}
              {client?.pan && (
                <>
                  <dt>{docLabels.pan}</dt>
                  <dd className="tnum">{client.pan}</dd>
                </>
              )}
              {clientStateName && (
                <>
                  <dt>{docLabels.state}</dt>
                  <dd>
                    {clientStateName}
                    {client?.state_code ? ` ( ${client.state_code} )` : ""}
                  </dd>
                </>
              )}
              {gstOn && placeOfSupplyName && (
                <>
                  <dt>{docLabels.placeOfSupply}</dt>
                  <dd>
                    {placeOfSupplyName}
                    {doc.place_of_supply ? ` ( ${doc.place_of_supply} )` : ""}
                  </dd>
                </>
              )}
            </dl>
            {doc.site_job && (
              <>
                <p className="doc-eyebrow mt-3">Site / Job</p>
                <p className="mt-0.5 text-[0.82rem] leading-snug">{doc.site_job}</p>
              </>
            )}
          </div>

          <div className="doc-cell">
            <dl className="doc-dl">
              <dt>{isInvoice ? docLabels.invoiceNo : docLabels.estimateNo}</dt>
              <dd className="tnum font-bold">{doc.serial_no}</dd>
              <dt>{isInvoice ? docLabels.invoiceDate : docLabels.estimateDate}</dt>
              <dd className="tnum">{formatDate(doc.doc_date)}</dd>
              {doc.due_date && (
                <>
                  <dt>{docLabels.dueDate}</dt>
                  <dd className="tnum">{formatDate(doc.due_date)}</dd>
                </>
              )}
              {isInvoice && linkedEstimateSerial && (
                <>
                  <dt>{docLabels.refEstimate}</dt>
                  <dd className="tnum">{linkedEstimateSerial}</dd>
                </>
              )}
            </dl>
            {/* A customer copy must never read "Draft". The only status
                worth printing is that the money arrived. */}
            {isInvoice && received > 0 && (
              <p className="doc-stamp">
                {printedBalance <= 0.005 ? docLabels.paid : docLabels.partPaid}
              </p>
            )}
          </div>
        </div>

        {/* The four-line summary he writes on a separate sheet. Printed
            here so the customer sees the shape of the job before the
            detail — and so he stops having to make that sheet himself. */}
        {hasParts && (
          <div className="doc-summary-parts print-avoid-break">
            <p className="doc-eyebrow">{docLabels.partsSummary}</p>
            <table className="doc-table doc-table-fixed mt-1">
              <tbody>
                {rowGroups
                  .filter((g) => g.name)
                  .map((g, i) => (
                    <tr key={g.name}>
                      <td className="tnum" style={{ width: "2.5rem" }}>
                        {i + 1}
                      </td>
                      <td>{g.name}</td>
                      <td className="doc-num">{formatIndianNumber(g.taxable)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}

        {/* the items — on a phone as blocks, because the ruled grid pushes
            the amount off the right edge; on paper always the grid */}
        <div className="doc-lines">
          {rowGroups.map((group) => (
            <div key={group.name || "_"}>
              {hasParts && group.name && (
                <p className="doc-part-row">
                  <span>{group.name}</span>
                  <span className="tnum">{formatINR(group.taxable)}</span>
                </p>
              )}
              {group.rows.map((r, idx) => (
                <div key={`${group.name}-${idx}`} className="doc-line-row">
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-[0.9rem] font-semibold leading-snug">
                      {idx + 1}. {r.description}
                    </span>
                    <span className="tnum shrink-0 font-extrabold">
                      {formatINR(gstOn ? r.total : r.taxable)}
                    </span>
                  </div>
                  <p className="tnum mt-0.5 text-[0.78rem] text-stone-600">
                    {formatIndianNumber(r.qty, 0)} {r.unit} × {formatINR(r.rate)}
                    {gstOn ? ` · +${(r.gstRate * 100).toFixed(0)}% GST` : ""}
                    {gstOn && r.hsn_sac ? ` · ${docLabels.hsn} ${r.hsn_sac}` : ""}
                  </p>
                </div>
              ))}
            </div>
          ))}
          {rows.length === 0 && (
            <p className="doc-line-row text-center text-stone-500">—</p>
          )}
        </div>

        <div className="doc-table-wrap">
          <table className="doc-table doc-grid">
            <thead>
              <tr>
                <th rowSpan={2} className="doc-grid-sr">
                  {docLabels.srNo}
                </th>
                <th rowSpan={2}>{docLabels.productService}</th>
                {gstOn && <th rowSpan={2}>{docLabels.hsn}</th>}
                <th rowSpan={2} className="doc-num">
                  {docLabels.qty}
                </th>
                <th rowSpan={2} className="doc-num">
                  {docLabels.rate}
                </th>
                <th rowSpan={2} className="doc-num">
                  {gstOn ? docLabels.taxableValue : docLabels.amount}
                </th>
                {gstOn &&
                  (totals.interState ? (
                    <th colSpan={2} className="doc-grid-group">
                      {docLabels.igst}
                    </th>
                  ) : (
                    <>
                      <th colSpan={2} className="doc-grid-group">
                        {docLabels.cgst}
                      </th>
                      <th colSpan={2} className="doc-grid-group">
                        {docLabels.sgst}
                      </th>
                    </>
                  ))}
                {gstOn && (
                  <th rowSpan={2} className="doc-num">
                    {docLabels.total}
                  </th>
                )}
              </tr>
              <tr>
                {gstOn && (
                  <>
                    <th className="doc-num doc-grid-pct">{docLabels.percent}</th>
                    <th className="doc-num">{docLabels.amount}</th>
                    {!totals.interState && (
                      <>
                        <th className="doc-num doc-grid-pct">{docLabels.percent}</th>
                        <th className="doc-num">{docLabels.amount}</th>
                      </>
                    )}
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {rowGroups.map((group) => (
                <Fragment key={group.name || "_"}>
                  {hasParts && group.name && (
                    <tr className="doc-part">
                      <th colSpan={gridCols - 1} scope="colgroup">
                        {group.name}
                      </th>
                      <th className="doc-num">{formatIndianNumber(group.taxable)}</th>
                    </tr>
                  )}
                  {group.rows.map((r, idx) => (
                    <tr key={`${group.name}-${idx}`}>
                      <td className="tnum">{idx + 1}</td>
                      <td>{r.description}</td>
                      {gstOn && <td className="tnum">{r.hsn_sac || "—"}</td>}
                      <td className="doc-num">
                        {formatIndianNumber(r.qty, 0)} {r.unit}
                      </td>
                      <td className="doc-num">{formatIndianNumber(r.rate)}</td>
                      <td className="doc-num">{formatIndianNumber(r.taxable)}</td>
                      {gstOn &&
                        (totals.interState ? (
                          <>
                            <td className="doc-num doc-grid-pct">
                              {(r.gstRate * 100).toFixed(2)}
                            </td>
                            <td className="doc-num">{formatIndianNumber(r.igst)}</td>
                          </>
                        ) : (
                          <>
                            <td className="doc-num doc-grid-pct">
                              {((r.gstRate * 100) / 2).toFixed(2)}
                            </td>
                            <td className="doc-num">{formatIndianNumber(r.cgst)}</td>
                            <td className="doc-num doc-grid-pct">
                              {((r.gstRate * 100) / 2).toFixed(2)}
                            </td>
                            <td className="doc-num">{formatIndianNumber(r.sgst)}</td>
                          </>
                        ))}
                      {gstOn && (
                        <td className="doc-num font-semibold">
                          {formatIndianNumber(r.total)}
                        </td>
                      )}
                    </tr>
                  ))}
                </Fragment>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={gridCols} className="text-center text-stone-500">
                    —
                  </td>
                </tr>
              )}
              {/* Runs the grid down the page the way a printed form does,
                  so a four-line bill still reads as a document. */}
              <tr className="doc-grid-filler" aria-hidden>
                <td colSpan={gridCols} />
              </tr>
            </tbody>
            <tfoot>
              <tr className="doc-grid-total">
                <td colSpan={gstOn ? 3 : 2}>{docLabels.total}</td>
                <td className="doc-num">{formatIndianNumber(totalQty, 2)}</td>
                <td />
                <td className="doc-num">{formatIndianNumber(totals.taxableValue)}</td>
                {gstOn &&
                  (totals.interState ? (
                    <>
                      <td />
                      <td className="doc-num">{formatIndianNumber(totals.igst)}</td>
                    </>
                  ) : (
                    <>
                      <td />
                      <td className="doc-num">{formatIndianNumber(totals.cgst)}</td>
                      <td />
                      <td className="doc-num">{formatIndianNumber(totals.sgst)}</td>
                    </>
                  ))}
                {gstOn && (
                  <td className="doc-num">{formatIndianNumber(totals.total)}</td>
                )}
              </tr>
            </tfoot>
          </table>
        </div>

        {/* the foot: what it says in words, how to pay, the terms —
            against the money ladder and the signature */}
        <div className="doc-foot">
          <div className="doc-foot-left">
            <div className="doc-cell">
              <p className="doc-eyebrow">{docLabels.totalInWords}</p>
              <p className="mt-1 text-[0.84rem] font-semibold uppercase leading-snug">
                {amountInWords(printedTotal)}
              </p>
            </div>

            {(profile?.bank_name || profile?.upi_id) && (
              <div className="doc-cell doc-foot-rule">
                <p className="doc-eyebrow">{docLabels.bankDetails}</p>
                <div className="mt-1 flex flex-wrap items-start gap-4">
                  <dl className="doc-dl min-w-[11rem] flex-1">
                    {profile?.bank_name && (
                      <>
                        <dt>{docLabels.bankName}</dt>
                        <dd>{profile.bank_name}</dd>
                      </>
                    )}
                    {profile?.bank_branch && (
                      <>
                        <dt>{docLabels.branch}</dt>
                        <dd>{profile.bank_branch}</dd>
                      </>
                    )}
                    {profile?.account_no && (
                      <>
                        <dt>{docLabels.accountNo}</dt>
                        <dd className="tnum">{profile.account_no}</dd>
                      </>
                    )}
                    {profile?.ifsc && (
                      <>
                        <dt>{docLabels.ifsc}</dt>
                        <dd className="tnum">{profile.ifsc}</dd>
                      </>
                    )}
                    {profile?.upi_id && (
                      <>
                        <dt>UPI</dt>
                        <dd className="tnum">{profile.upi_id}</dd>
                      </>
                    )}
                  </dl>

                  {qrSvg && (
                    <div className="text-center">
                      <div
                        className="doc-qr mx-auto"
                        // The QR is generated on the server; nothing here is user input.
                        dangerouslySetInnerHTML={{ __html: qrSvg }}
                      />
                      <p className="mt-1 text-[0.66rem] font-bold text-stone-700">
                        {docLabels.scanToPay}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {(termsText || doc.notes) && (
              <div className="doc-cell doc-foot-rule">
                {termsText && (
                  <>
                    <p className="doc-eyebrow">{docLabels.terms}</p>
                    <p className="mt-1 whitespace-pre-line text-[0.74rem] leading-snug text-stone-700">
                      {termsText}
                    </p>
                  </>
                )}
                {doc.notes && (
                  <>
                    <p className={`doc-eyebrow ${termsText ? "mt-2" : ""}`}>
                      {docLabels.notes}
                    </p>
                    <p className="mt-1 text-[0.76rem] leading-snug text-stone-700">
                      {doc.notes}
                    </p>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="doc-foot-right">
            <div className="doc-ladder">
              <p className="doc-line">
                <span>{gstOn ? docLabels.taxableAmount : docLabels.subtotal}</span>
                <span className="tnum">{formatIndianNumber(totals.subtotal)}</span>
              </p>
              {totals.serviceCharge > 0 && (
                <p className="doc-line">
                  <span>
                    {doc.service_charge_label || "Service Charge"}
                    {doc.service_charge_mode === "percent"
                      ? ` (${formatIndianNumber(Number(doc.service_charge_value), 0)}%)`
                      : ""}
                  </span>
                  <span className="tnum">{formatIndianNumber(totals.serviceCharge)}</span>
                </p>
              )}
              {gstOn && (
                <>
                  {totals.interState ? (
                    <p className="doc-line">
                      <span>{docLabels.addIgst}</span>
                      <span className="tnum">{formatIndianNumber(totals.igst)}</span>
                    </p>
                  ) : (
                    <>
                      <p className="doc-line">
                        <span>{docLabels.addCgst}</span>
                        <span className="tnum">{formatIndianNumber(totals.cgst)}</span>
                      </p>
                      <p className="doc-line">
                        <span>{docLabels.addSgst}</span>
                        <span className="tnum">{formatIndianNumber(totals.sgst)}</span>
                      </p>
                    </>
                  )}
                  <p className="doc-line doc-line-rule">
                    <span>{docLabels.totalTax}</span>
                    <span className="tnum">{formatIndianNumber(totals.gstAmount)}</span>
                  </p>
                </>
              )}
              <p className="doc-line doc-line-total">
                <span>{gstOn ? docLabels.totalAfterTax : docLabels.total}</span>
                <span className="tnum">{formatINR(printedTotal)}</span>
              </p>

              {isInvoice && received > 0 && (
                <>
                  <p className="doc-line">
                    <span>{docLabels.received}</span>
                    <span className="tnum">− {formatIndianNumber(received)}</span>
                  </p>
                  <p className="doc-line font-extrabold">
                    <span>
                      {printedBalance > 0 ? docLabels.balanceDue : docLabels.fullySettled}
                    </span>
                    <span className="tnum">{formatINR(printedBalance)}</span>
                  </p>
                </>
              )}
              <p className="doc-eoe">{docLabels.errorsExcepted}</p>
            </div>

            <div className="doc-sign">
              <p className="text-[0.66rem] leading-snug text-stone-500">
                {docLabels.certified}
              </p>
              <p className="mt-1 text-[0.85rem] font-extrabold">
                {docLabels.signFor} {profile?.business_name}
              </p>
              <p className="doc-sign-line">{docLabels.authorisedSignatory}</p>
              {!isInvoice && (
                <p className="mt-3 text-left text-[0.7rem] text-stone-600">
                  {docLabels.approvedBy}: ____________________ &nbsp; Date: __________
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

    </main>
  );
}
