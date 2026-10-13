import Link from "next/link";
import PeriodPicker from "@/components/PeriodPicker";
import PrintButton from "@/components/PrintButton";
import { formatDate, formatIndianNumber, todayISO } from "@/lib/format";
import { getDict } from "@/lib/i18n";
import { monthPeriod, periodFromParams, periodLabel, shiftMonth } from "@/lib/period";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// The invoice register, in the shape he drew it on his estimate pad:
// Invoice No · Date · Customer · Amount · Paid · Balance. He has kept his
// books in Excel his whole working life, so this is the one screen that
// is deliberately a spreadsheet — it prints as one, and it downloads as
// one (/api/export?what=invoices) with the figures as plain numbers so
// Excel can add them up.
//
// Paid reads amount_received, never status, so part-payments count.
// Estimates are not here: a quote is not money owed.

type Row = {
  id: string;
  serial_no: string;
  doc_date: string;
  total: number;
  amount_received: number;
  clients: { name: string } | null;
};

export default async function InvoiceListPage({
  searchParams,
}: {
  searchParams: { month?: string; from?: string; to?: string };
}) {
  const t = getDict();
  const supabase = supabaseServer();

  const period = periodFromParams(searchParams);
  const thisMonth = todayISO().slice(0, 7);
  const year = thisMonth.slice(0, 4);

  const [{ data }, { data: profile }] = await Promise.all([
    supabase
      .from("documents")
      .select("id, serial_no, doc_date, total, amount_received, clients(name)")
      .eq("type", "invoice")
      .gte("doc_date", period.from)
      .lte("doc_date", period.to)
      .order("doc_date")
      .order("serial_no")
      .limit(2000),
    supabase.from("business_profile").select("business_name").maybeSingle(),
  ]);
  const rows = (data ?? []) as unknown as Row[];

  const r2 = (n: number) => Math.round(n * 100) / 100;
  const amount = r2(rows.reduce((s, r) => s + Number(r.total), 0));
  const paid = r2(rows.reduce((s, r) => s + Number(r.amount_received), 0));
  const balance = r2(amount - paid);

  const query = `from=${period.from}&to=${period.to}`;

  return (
    <main>
      <div className="no-print">
        <div className="mb-2 flex items-center gap-3">
          <Link href="/summary" className="btn-secondary px-3">
            ← {t.back}
          </Link>
          <h1 className="truncate text-2xl font-extrabold">{t.invoiceList}</h1>
        </div>
        <p className="mb-4 text-sm leading-snug text-stone-500">{t.invoiceListHint}</p>

        <PeriodPicker
          path="/invoices"
          period={period}
          t={t}
          shortcuts={[
            { label: t.thisMonth, period: monthPeriod(thisMonth) },
            { label: t.lastMonth, period: monthPeriod(shiftMonth(thisMonth, -1)) },
            {
              label: year,
              period: { from: `${year}-01-01`, to: `${year}-12-31`, monthKey: null },
            },
          ]}
        />

        {rows.length > 0 && (
          <div className="mt-4 space-y-2">
            <PrintButton label={t.saveAsPdf} />
            <a href={`/api/export?what=invoices&${query}`} className="btn-secondary w-full">
              {t.downloadForExcel}
            </a>
          </div>
        )}
      </div>

      {/* ---------- the sheet ---------- */}
      <div className="doc mt-6">
        <p className="doc-title">Invoice List</p>
        <div className="doc-head">
          <div className="doc-cell">
            <p className="text-lg font-extrabold leading-tight">{profile?.business_name}</p>
          </div>
          <div className="doc-cell">
            <p className="doc-kv">
              <span>{period.monthKey ? "Month" : "Period"}</span>
              <span>{periodLabel(period)}</span>
            </p>
            <p className="doc-kv">
              <span>Invoices</span>
              <span>{rows.length}</span>
            </p>
          </div>
        </div>

        {rows.length === 0 ? (
          <p className="p-8 text-center text-stone-500">{t.noInvoicesInPeriod}</p>
        ) : (
          <div className="doc-scroll">
            <table className="doc-table">
              <thead>
                <tr>
                  <th>Invoice No</th>
                  <th>Date</th>
                  <th>Customer</th>
                  <th className="doc-num">Amount (₹)</th>
                  <th className="doc-num">Paid (₹)</th>
                  <th className="doc-num">Balance (₹)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const owed = r2(Number(r.total) - Number(r.amount_received));
                  return (
                    <tr key={r.id}>
                      <td className="whitespace-nowrap">
                        <Link href={`/documents/${r.id}`} className="font-semibold">
                          {r.serial_no}
                        </Link>
                      </td>
                      <td className="tnum whitespace-nowrap">{formatDate(r.doc_date)}</td>
                      <td>{r.clients?.name ?? "—"}</td>
                      <td className="doc-num">{formatIndianNumber(Number(r.total))}</td>
                      <td className="doc-num">{formatIndianNumber(Number(r.amount_received))}</td>
                      <td className={`doc-num ${owed > 0 ? "font-bold" : ""}`}>
                        {formatIndianNumber(owed)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="doc-grid-total">
                  <td colSpan={3}>TOTAL</td>
                  <td className="doc-num">{formatIndianNumber(amount)}</td>
                  <td className="doc-num">{formatIndianNumber(paid)}</td>
                  <td className="doc-num">{formatIndianNumber(balance)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
