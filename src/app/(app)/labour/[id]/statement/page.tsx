import Link from "next/link";
import { notFound } from "next/navigation";
import PrintButton from "@/components/PrintButton";
import {
  addDays,
  formatDayShort,
  formatINR,
  formatIndianNumber,
  formatMonth,
  todayISO,
} from "@/lib/format";
import { getDict } from "@/lib/i18n";
import { supabaseServer } from "@/lib/supabase/server";
import type { WorkerEntry } from "@/lib/types";

export const dynamic = "force-dynamic";

// What a man asks for when he wants to know where he stands: every day he
// worked, every rupee taken in advance, every rupee paid, and the balance
// at the end — for one month, on one sheet he can be handed or sent.
//
// It is built from the same worker_entries the labour book is, so it can
// never disagree with what the app shows; nothing here is stored.

function monthKeyOf(iso: string): string {
  return iso.slice(0, 7);
}
function firstOf(key: string): string {
  return `${key}-01`;
}
function lastOf(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return addDays(`${y}-${String(m).padStart(2, "0")}-01`, 32).slice(0, 8) + "01";
}
function shiftMonth(key: string, by: number): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1 + by, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function waLink(phone: string, text: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return null;
  return `https://wa.me/${digits.length === 10 ? "91" + digits : digits}?text=${encodeURIComponent(text)}`;
}

export default async function WorkerStatementPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { month?: string };
}) {
  const t = getDict();
  const supabase = supabaseServer();

  const monthKey = /^\d{4}-\d{2}$/.test(searchParams.month ?? "")
    ? searchParams.month!
    : monthKeyOf(todayISO());
  const from = firstOf(monthKey);
  const to = firstOf(shiftMonth(monthKey, 1));

  const [{ data: worker }, { data: entriesRaw }, { data: profile }] = await Promise.all([
    supabase.from("workers").select("*").eq("id", params.id).maybeSingle(),
    supabase
      .from("worker_entries")
      .select("*, clients(name)")
      .eq("worker_id", params.id)
      .order("entry_date")
      .order("created_at"),
    supabase.from("business_profile").select("*").maybeSingle(),
  ]);
  if (!worker) notFound();

  const entries = (entriesRaw ?? []) as unknown as WorkerEntry[];
  const money = (e: WorkerEntry) => (e.kind === "work" ? Number(e.amount) : -Number(e.amount));

  // Everything before this month, as one figure he carries in.
  const opening = entries
    .filter((e) => e.entry_date < from)
    .reduce((s, e) => s + money(e), 0);

  const rows = entries.filter((e) => e.entry_date >= from && e.entry_date < to);
  const earned = rows.filter((e) => e.kind === "work").reduce((s, e) => s + Number(e.amount), 0);
  const advances = rows
    .filter((e) => e.kind === "advance")
    .reduce((s, e) => s + Number(e.amount), 0);
  const payments = rows
    .filter((e) => e.kind === "payment")
    .reduce((s, e) => s + Number(e.amount), 0);
  const daysWorked = rows
    .filter((e) => e.kind === "work")
    .reduce((s, e) => s + Number(e.days), 0);
  const closing = Math.round((opening + earned - advances - payments) * 100) / 100;

  const kindWord: Record<string, string> = {
    work: t.workDone,
    payment: t.payment,
    advance: t.advance,
  };

  const summaryText =
    `${profile?.business_name ?? ""}\n` +
    `${worker.name} — ${formatMonth(from)}\n` +
    `${t.workedDays}: ${formatIndianNumber(daysWorked, 0)}\n` +
    `${t.earned}: ${formatINR(earned, 0)}\n` +
    (advances > 0 ? `${t.advanceTaken}: ${formatINR(advances, 0)}\n` : "") +
    (payments > 0 ? `${t.paidOut}: ${formatINR(payments, 0)}\n` : "") +
    `${t.closingBalance}: ${formatINR(closing, 0)}`;
  const wa = worker.phone ? waLink(worker.phone, summaryText) : null;

  return (
    <main>
      <div className="no-print">
        <div className="mb-4 flex items-center gap-3">
          <Link href={`/labour/${worker.id}`} className="btn-secondary px-3">
            ← {t.back}
          </Link>
          <h1 className="truncate text-2xl font-extrabold">{t.statement}</h1>
        </div>

        <div className="flex items-center justify-between gap-2">
          <Link
            href={`/labour/${worker.id}/statement?month=${shiftMonth(monthKey, -1)}`}
            aria-label={t.prevMonth}
            className="btn-secondary min-h-[44px] px-3 text-xl font-bold"
          >
            ‹
          </Link>
          <p className="text-center font-extrabold">{formatMonth(from)}</p>
          <Link
            href={`/labour/${worker.id}/statement?month=${shiftMonth(monthKey, 1)}`}
            aria-label={t.nextMonth}
            className="btn-secondary min-h-[44px] px-3 text-xl font-bold"
          >
            ›
          </Link>
        </div>

        <div className="mt-4 space-y-2">
          <PrintButton label={t.saveAsPdf} />
          {wa && (
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary w-full"
            >
              {t.sendOnWhatsApp}
            </a>
          )}
        </div>
      </div>

      {/* ---------- the sheet he hands over ---------- */}
      <div className="doc mt-6">
        <p className="doc-title">{t.statement}</p>

        <div className="doc-head">
          <div className="doc-cell">
            <p className="text-lg font-extrabold leading-tight">{profile?.business_name}</p>
            {profile?.phone && <p className="text-[0.8rem] text-stone-600">{profile.phone}</p>}
          </div>
          <div className="doc-cell">
            <p className="doc-kv">
              <span>Name</span>
              <span className="font-bold">{worker.name}</span>
            </p>
            <p className="doc-kv">
              <span>Month</span>
              <span>{formatMonth(from)}</span>
            </p>
            {worker.skill && (
              <p className="doc-kv">
                <span>Work</span>
                <span>{worker.skill}</span>
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
                <th className="doc-num w-12">Days</th>
                <th className="doc-num">{t.earnedCol} (₹)</th>
                <th className="doc-num">{t.paidCol} (₹)</th>
              </tr>
            </thead>
            <tbody>
              {opening !== 0 && (
                <tr>
                  <td className="tnum">{formatDayShort(addDays(from, -1))}</td>
                  <td className="font-semibold">{t.openingBalance}</td>
                  <td />
                  <td className="doc-num">
                    {opening > 0 ? formatIndianNumber(opening) : ""}
                  </td>
                  <td className="doc-num">
                    {opening < 0 ? formatIndianNumber(-opening) : ""}
                  </td>
                </tr>
              )}
              {rows.map((e) => (
                <tr key={e.id}>
                  <td className="tnum">{formatDayShort(e.entry_date)}</td>
                  <td>
                    {kindWord[e.kind]}
                    {e.site_job ? ` — ${e.site_job}` : ""}
                    {!e.site_job && e.clients?.name ? ` — ${e.clients.name}` : ""}
                  </td>
                  <td className="doc-num">
                    {e.kind === "work" ? formatIndianNumber(Number(e.days), 0) : ""}
                  </td>
                  <td className="doc-num">
                    {e.kind === "work" ? formatIndianNumber(Number(e.amount)) : ""}
                  </td>
                  <td className="doc-num">
                    {e.kind !== "work" ? formatIndianNumber(Number(e.amount)) : ""}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="doc-grid-total">
                <td colSpan={2}>{t.total}</td>
                <td className="doc-num">{formatIndianNumber(daysWorked, 0)}</td>
                <td className="doc-num">{formatIndianNumber(earned + Math.max(opening, 0))}</td>
                <td className="doc-num">
                  {formatIndianNumber(advances + payments + Math.max(-opening, 0))}
                </td>
              </tr>
            </tfoot>
            </table>
          </div>
        )}

        <div className="doc-summary-parts" style={{ borderBottom: 0 }}>
          <div className="doc-cell">
            <p className="doc-line doc-line-total">
              <span>{closing >= 0 ? t.toPay : t.paidOut}</span>
              <span className="tnum">{formatINR(Math.abs(closing))}</span>
            </p>
            <p className="mt-2 text-[0.72rem] leading-snug text-stone-500">
              {t.statementFor} {worker.name} · {formatMonth(from)}
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
