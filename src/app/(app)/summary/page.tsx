import Link from "next/link";
import { getDict } from "@/lib/i18n";
import { formatINR, formatMonth } from "@/lib/format";
import {
  averageDaysToPay,
  jobSizeBuckets,
  monthSeries,
  topBy,
  type SummaryDoc,
  type SummaryPayment,
} from "@/lib/summary";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// The year on one page: what he billed, what came in, who pays him, what
// he bills most, and how his work splits by size. This is also the page
// he prints for his accountant, so it stays plain and it prints.

const MONTH_LETTERS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

export default async function SummaryPage({
  searchParams,
}: {
  searchParams: { year?: string };
}) {
  const t = getDict();
  const supabase = supabaseServer();

  const thisYear = new Date().getFullYear();
  const year = Number(searchParams.year) || thisYear;
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;

  const [
    { data: docsRaw },
    { data: allDates },
    { data: paymentsRaw },
    { data: expensesRaw },
    { data: labourRaw },
    { data: clientsRaw },
    { data: itemsRaw },
  ] = await Promise.all([
    supabase
      .from("documents")
      .select("id, doc_date, total, amount_received, client_id, type")
      .eq("type", "invoice")
      .gte("doc_date", from)
      .lte("doc_date", to)
      .limit(2000),
    supabase.from("documents").select("doc_date").order("doc_date").limit(2000),
    supabase
      .from("payments")
      .select("document_id, paid_on, amount")
      .gte("paid_on", from)
      .lte("paid_on", to)
      .limit(2000),
    supabase.from("expenses").select("amount").gte("date", from).lte("date", to),
    supabase
      .from("worker_entries")
      .select("amount")
      .neq("kind", "work")
      .gte("entry_date", from)
      .lte("entry_date", to),
    supabase.from("clients").select("id, name"),
    supabase
      .from("line_items")
      .select("description, amount, documents!inner(doc_date, type)")
      .gte("documents.doc_date", from)
      .lte("documents.doc_date", to)
      .eq("documents.type", "invoice")
      .limit(5000),
  ]);

  const invoices = (docsRaw ?? []) as (SummaryDoc & { amount_received: number })[];
  const payments = (paymentsRaw ?? []) as SummaryPayment[];
  const clients = new Map((clientsRaw ?? []).map((c) => [c.id, c.name as string]));

  // ---- the money ----
  const invoiced = invoices.reduce((s, d) => s + Number(d.total), 0);
  const received = invoices.reduce((s, d) => s + Number(d.amount_received), 0);
  const outstanding = invoiced - received;
  const materials = (expensesRaw ?? []).reduce((s, e) => s + Number(e.amount), 0);
  const labour = (labourRaw ?? []).reduce((s, e) => s + Number(e.amount), 0);
  const spent = materials + labour;
  const profit = received - spent;

  // ---- the years he can look at ----
  const years = [
    ...new Set(
      (allDates ?? [])
        .map((d) => Number(String(d.doc_date).slice(0, 4)))
        .filter((y) => y > 2000)
    ),
  ].sort((a, b) => b - a);
  if (!years.includes(thisYear)) years.unshift(thisYear);

  // ---- month by month ----
  const months = monthSeries(invoices, year);
  const peak = Math.max(...months, 0);

  // ---- who pays him ----
  const byClient = new Map<string, { billed: number; count: number; docs: SummaryDoc[] }>();
  for (const d of invoices) {
    const key = d.client_id ?? "none";
    const row = byClient.get(key) ?? { billed: 0, count: 0, docs: [] };
    row.billed += Number(d.total);
    row.count += 1;
    row.docs.push(d);
    byClient.set(key, row);
  }
  const bestClients = topBy(
    [...byClient.entries()].map(([id, row]) => ({
      id,
      name: clients.get(id) ?? "—",
      billed: row.billed,
      count: row.count,
      days: averageDaysToPay(row.docs, payments),
    })),
    (r) => r.billed,
    6
  );

  // ---- what he bills most ----
  const byItem = new Map<string, { label: string; total: number; count: number }>();
  for (const li of (itemsRaw ?? []) as { description: string; amount: number }[]) {
    const label = (li.description ?? "").trim();
    if (!label) continue;
    const key = label.toLowerCase();
    const row = byItem.get(key) ?? { label, total: 0, count: 0 };
    row.total += Number(li.amount);
    row.count += 1;
    byItem.set(key, row);
  }
  const topItems = topBy([...byItem.values()], (r) => r.total, 6);

  // ---- how the work splits ----
  const buckets = jobSizeBuckets(invoices.map((d) => Number(d.total)));
  const bucketLabels: Record<string, string> = {
    small: t.smallJobs,
    medium: t.mediumJobs,
    large: t.largeJobs,
  };

  const nothing = invoiced === 0 && spent === 0;

  return (
    <main>
      <div className="no-print mb-4 flex items-center gap-3">
        <Link href="/" className="btn-secondary px-3">
          ← {t.back}
        </Link>
        <h1 className="text-2xl font-extrabold">{t.summary}</h1>
      </div>

      {/* which year */}
      <div className="no-print mb-4 flex flex-wrap gap-2">
        {years.slice(0, 6).map((y) => (
          <Link
            key={y}
            href={`/summary?year=${y}`}
            className={`btn px-4 text-sm ${
              y === year ? "bg-accent text-white" : "border-2 border-line bg-white text-stone-700"
            }`}
          >
            {y}
          </Link>
        ))}
      </div>

      {nothing ? (
        <p className="card p-8 text-center text-stone-600">{t.nothingForYear}</p>
      ) : (
        <>
          {/* ---- the money ---- */}
          <div className="card p-4">
            <p className="eyebrow">
              {t.summary} · {year}
            </p>
            <dl className="mt-3 space-y-2">
              {[
                [t.invoicedTotal, formatINR(invoiced, 0), ""],
                [t.received, formatINR(received, 0), "text-green-800"],
                [t.stillToCollect, formatINR(outstanding, 0), "text-amber-700"],
                [t.materialsAndOther, formatINR(materials, 0), ""],
                [t.labour, formatINR(labour, 0), ""],
              ].map(([label, value, tone]) => (
                <div key={label} className="flex items-baseline justify-between gap-3">
                  <dt className="text-stone-600">{label}</dt>
                  <dd className={`tnum font-bold ${tone}`}>{value}</dd>
                </div>
              ))}
              <div className="flex items-baseline justify-between gap-3 border-t border-line pt-2">
                <dt className="font-bold">{t.profit}</dt>
                <dd
                  className={`tnum text-xl font-extrabold ${
                    profit < 0 ? "text-red-700" : "text-ink"
                  }`}
                >
                  {formatINR(profit, 0)}
                </dd>
              </div>
            </dl>
          </div>

          {/* ---- month by month: plain SVG, no chart library ---- */}
          {peak > 0 && (
            <section className="card mt-4 p-4">
              <p className="eyebrow">{t.byMonth}</p>
              <svg
                viewBox="0 0 360 132"
                className="mt-3 w-full"
                role="img"
                aria-label={`${t.byMonth} ${year}`}
              >
                {months.map((v, i) => {
                  const h = peak > 0 ? Math.round((v / peak) * 96) : 0;
                  const x = 6 + i * 29;
                  return (
                    <g key={i}>
                      <rect x={x} y={110 - h} width="20" height={Math.max(h, 1)} rx="3"
                        fill={v > 0 ? "#0f766e" : "#e4e0d8"} />
                      <text x={x + 10} y={126} textAnchor="middle" fontSize="11" fill="#78716c">
                        {MONTH_LETTERS[i]}
                      </text>
                    </g>
                  );
                })}
              </svg>
              <p className="mt-1 text-center text-xs text-stone-500">
                {t.tallestBar}: {formatINR(peak, 0)}
              </p>
            </section>
          )}

          {/* ---- who pays him ---- */}
          {bestClients.length > 0 && (
            <section className="mt-6">
              <h2 className="eyebrow">{t.bestCustomers}</h2>
              <ul className="mt-2 space-y-2">
                {bestClients.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={c.id === "none" ? "/clients" : `/clients/${c.id}`}
                      className="card flex items-center justify-between gap-3 p-3"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-bold">{c.name}</span>
                        <span className="block text-xs text-stone-500">
                          {c.count === 1 ? t.oneJob : t.jobsCount.replace("{n}", String(c.count))}
                          {" · "}
                          {c.days === null
                            ? t.noPaymentsYetShort
                            : t.paysInDays.replace("{n}", String(c.days))}
                        </span>
                      </span>
                      <span className="tnum shrink-0 font-extrabold">
                        {formatINR(c.billed, 0)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* ---- what he bills most ---- */}
          {topItems.length > 0 && (
            <section className="mt-6">
              <h2 className="eyebrow">{t.whatYouBillMost}</h2>
              <ul className="card mt-2 divide-y divide-line">
                {topItems.map((i) => (
                  <li key={i.label} className="flex items-baseline justify-between gap-3 p-3">
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{i.label}</span>
                      <span className="text-xs text-stone-500">
                        {i.count === 1 ? t.oneJob : t.jobsCount.replace("{n}", String(i.count))}
                      </span>
                    </span>
                    <span className="tnum shrink-0 font-bold">{formatINR(i.total, 0)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* ---- how the work splits ---- */}
          {buckets.some((b) => b.count > 0) && (
            <section className="mt-6 pb-2">
              <h2 className="eyebrow">{t.jobSizes}</h2>
              <ul className="card mt-2 divide-y divide-line">
                {buckets.map((b) => (
                  <li key={b.key} className="flex items-baseline justify-between gap-3 p-3">
                    <span>
                      <span className="block font-semibold">{bucketLabels[b.key]}</span>
                      <span className="text-xs text-stone-500">
                        {b.count === 1 ? t.oneJob : t.jobsCount.replace("{n}", String(b.count))}
                      </span>
                    </span>
                    <span className="tnum font-bold">{formatINR(b.total, 0)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </main>
  );
}
