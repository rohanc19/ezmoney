import Link from "next/link";
import { notFound } from "next/navigation";
import PrintButton from "@/components/PrintButton";
import { formatDayShort, formatINR, formatIndianNumber } from "@/lib/format";
import { getDict } from "@/lib/i18n";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// What a client asks for when they want the whole picture: every bill
// raised, every rupee paid against it, and what is still open — for the
// whole relationship or for one job, on a sheet he can print or send.
//
// Built from documents and payments, so it agrees with the app by
// construction. Estimates are listed but never counted: a quote is not
// money owed, and an estimate in the running balance would say he is
// owed for work nobody has agreed to yet.

interface Row {
  date: string;
  what: string;
  ref: string;
  billed: number;
  paid: number;
}

function waLink(phone: string, text: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return null;
  return `https://wa.me/${digits.length === 10 ? "91" + digits : digits}?text=${encodeURIComponent(text)}`;
}

export default async function ClientStatementPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { job?: string };
}) {
  const t = getDict();
  const supabase = supabaseServer();

  const [{ data: client }, { data: docs }, { data: profile }] = await Promise.all([
    supabase.from("clients").select("*").eq("id", params.id).maybeSingle(),
    supabase
      .from("documents")
      .select("id, type, serial_no, doc_date, site_job, total")
      .eq("client_id", params.id)
      .order("doc_date"),
    supabase.from("business_profile").select("*").maybeSingle(),
  ]);
  if (!client) notFound();

  const allDocs = docs ?? [];
  const jobs = [...new Set(allDocs.map((d) => (d.site_job ?? "").trim()).filter(Boolean))].sort();
  const job = (searchParams.job ?? "").trim();
  const inScope = job ? allDocs.filter((d) => (d.site_job ?? "").trim() === job) : allDocs;

  const invoiceIds = inScope.filter((d) => d.type === "invoice").map((d) => d.id);
  const { data: payments } = invoiceIds.length
    ? await supabase
        .from("payments")
        .select("id, document_id, paid_on, amount, method")
        .in("document_id", invoiceIds)
    : { data: [] as { id: string; document_id: string; paid_on: string; amount: number; method: string }[] };

  const serialOf = new Map(inScope.map((d) => [d.id, d.serial_no]));

  const rows: Row[] = [];
  for (const d of inScope) {
    if (d.type !== "invoice") continue;
    rows.push({
      date: d.doc_date,
      what: d.site_job || t.invoice,
      ref: d.serial_no,
      billed: Number(d.total),
      paid: 0,
    });
  }
  for (const p of payments ?? []) {
    rows.push({
      date: p.paid_on,
      what: `${t.payment}${p.method ? ` · ${p.method}` : ""}`,
      ref: serialOf.get(p.document_id) ?? "",
      billed: 0,
      paid: Number(p.amount),
    });
  }
  rows.sort((a, b) => (a.date === b.date ? b.billed - a.billed : a.date.localeCompare(b.date)));

  const billed = rows.reduce((s, r) => s + r.billed, 0);
  const received = rows.reduce((s, r) => s + r.paid, 0);
  const balance = Math.round((billed - received) * 100) / 100;

  const estimates = inScope.filter((d) => d.type === "estimate");

  const summaryText =
    `${profile?.business_name ?? ""}\n` +
    `${t.statementFor} ${client.name}${job ? ` — ${job}` : ""}\n` +
    `${t.billedToday}: ${formatINR(billed, 0)}\n` +
    `${t.receivedToday}: ${formatINR(received, 0)}\n` +
    `${t.balanceDue}: ${formatINR(balance, 0)}`;
  const wa = client.phone ? waLink(client.phone, summaryText) : null;

  return (
    <main>
      <div className="no-print">
        <div className="mb-4 flex items-center gap-3">
          <Link href={`/clients/${client.id}`} className="btn-secondary px-3">
            ← {t.back}
          </Link>
          <h1 className="truncate text-2xl font-extrabold">{t.statement}</h1>
        </div>

        {/* one job, or the whole relationship */}
        {jobs.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/clients/${client.id}/statement`}
              className={`btn text-sm ${
                job ? "border-2 border-line bg-white text-stone-700" : "bg-accent text-white"
              }`}
            >
              {t.allProjects}
            </Link>
            {jobs.map((j) => (
              <Link
                key={j}
                href={`/clients/${client.id}/statement?job=${encodeURIComponent(j)}`}
                className={`btn max-w-full truncate text-sm ${
                  job === j ? "bg-accent text-white" : "border-2 border-line bg-white text-stone-700"
                }`}
              >
                {j}
              </Link>
            ))}
          </div>
        )}

        <div className="mt-4 space-y-2">
          <PrintButton label={t.saveAsPdf} />
          {wa && (
            <a href={wa} target="_blank" rel="noopener noreferrer" className="btn-secondary w-full">
              {t.sendOnWhatsApp}
            </a>
          )}
        </div>
      </div>

      {/* ---------- the sheet ---------- */}
      <div className="doc mt-6">
        <p className="doc-title">{t.statement}</p>

        <div className="doc-head">
          <div className="doc-cell">
            <p className="text-lg font-extrabold leading-tight">{profile?.business_name}</p>
            {profile?.phone && <p className="text-[0.8rem] text-stone-600">{profile.phone}</p>}
            {profile?.gstin && (
              <p className="text-[0.8rem] font-bold">GSTIN: {profile.gstin}</p>
            )}
          </div>
          <div className="doc-cell">
            <p className="doc-kv">
              <span>Statement for</span>
              <span className="font-bold">{client.name}</span>
            </p>
            {job && (
              <p className="doc-kv">
                <span>Work</span>
                <span>{job}</span>
              </p>
            )}
            {client.phone && (
              <p className="doc-kv">
                <span>Phone</span>
                <span className="tnum">{client.phone}</span>
              </p>
            )}
          </div>
        </div>

        {rows.length === 0 ? (
          <p className="p-8 text-center text-stone-500">{t.nothingInPeriod}</p>
        ) : (
          <div className="doc-scroll">
            <table className="doc-table">
            <thead>
              <tr>
                <th className="w-16">Date</th>
                <th>What</th>
                <th className="w-24">Bill No.</th>
                <th className="doc-num">Billed (₹)</th>
                <th className="doc-num">Paid (₹)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={`${r.ref}-${r.date}-${i}`}>
                  <td className="tnum">{formatDayShort(r.date)}</td>
                  <td>{r.what}</td>
                  <td className="tnum">{r.ref}</td>
                  <td className="doc-num">{r.billed ? formatIndianNumber(r.billed) : ""}</td>
                  <td className="doc-num">{r.paid ? formatIndianNumber(r.paid) : ""}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="doc-grid-total">
                <td colSpan={3}>{t.total}</td>
                <td className="doc-num">{formatIndianNumber(billed)}</td>
                <td className="doc-num">{formatIndianNumber(received)}</td>
              </tr>
            </tfoot>
            </table>
          </div>
        )}

        <div className="doc-summary-parts" style={{ borderBottom: 0 }}>
          <div className="doc-cell">
            <p className="doc-line doc-line-total">
              <span>{balance > 0 ? t.balanceDue : t.fullySettled}</span>
              <span className="tnum">{formatINR(Math.abs(balance))}</span>
            </p>
            {estimates.length > 0 && (
              <p className="mt-2 text-[0.72rem] leading-snug text-stone-500">
                {t.estimates}:{" "}
                {estimates.map((e) => `${e.serial_no} (${formatINR(Number(e.total), 0)})`).join(", ")}
                {" — "}
                {t.notCounted}
              </p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
