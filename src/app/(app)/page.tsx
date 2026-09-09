import Link from "next/link";
import StatusPill from "@/components/StatusPill";
import { getDict } from "@/lib/i18n";
import { daysBetween, formatDate, formatINR, formatMonth } from "@/lib/format";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Home answers two questions and nothing else: what am I owed, and what
// should I do about it. Every number here is either money waiting to come
// in, or a bill that needs an action — never a statistic for its own sake.

interface HomeDoc {
  id: string;
  type: "estimate" | "invoice";
  serial_no: string;
  doc_date: string;
  site_job: string;
  status: string;
  total: number;
  amount_received: number;
  linked_estimate_id: string | null;
  created_at: string;
  clients?: { name: string } | null;
}

/** A bill unpaid this long has stopped being "recent". */
const OVERDUE_DAYS = 30;
/** An estimate this old with no answer probably needs a phone call. */
const NO_REPLY_DAYS = 7;
/** A draft this old was almost certainly forgotten, not deferred. */
const UNSENT_DAYS = 3;

const balanceOf = (d: HomeDoc) => Number(d.total) - Number(d.amount_received);

export default async function HomePage({
  searchParams,
}: {
  searchParams: { q?: string; type?: string; show?: string; saved?: string };
}) {
  const t = getDict();
  const supabase = supabaseServer();
  const q = (searchParams.q ?? "").trim();
  const type =
    searchParams.type === "estimate" || searchParams.type === "invoice" ? searchParams.type : "";
  const show = ["unpaid", "unbilled", "overdue", "awaiting", "drafts"].includes(
    searchParams.show ?? ""
  )
    ? searchParams.show!
    : "";

  const year = new Date().getFullYear();
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;

  // One pass over his bills feeds the money, the attention list and the
  // filtered views. Search is the exception — it runs in the database so
  // it can reach bills older than this window.
  const [{ data: allRaw }, { data: yearExpenses }, { data: yearLabour }] = await Promise.all([
    supabase
      .from("documents")
      .select(
        "id, type, serial_no, doc_date, site_job, status, total, amount_received, linked_estimate_id, created_at, clients(name)"
      )
      .order("doc_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1000),
    supabase.from("expenses").select("amount").gte("date", from).lte("date", to),
    supabase
      .from("worker_entries")
      .select("amount")
      .neq("kind", "work")
      .gte("entry_date", from)
      .lte("entry_date", to),
  ]);

  const all = (allRaw ?? []) as unknown as HomeDoc[];
  const invoices = all.filter((d) => d.type === "invoice");
  const estimates = all.filter((d) => d.type === "estimate");

  // ---- what he is owed, across every year ----
  const unpaid = invoices
    .filter((d) => balanceOf(d) > 0.005)
    .sort((a, b) => a.doc_date.localeCompare(b.doc_date)); // oldest first — chase those
  const outstanding = unpaid.reduce((s, d) => s + balanceOf(d), 0);
  const oldestDays = unpaid.length > 0 ? daysBetween(unpaid[0].doc_date) : 0;

  // ---- the year's money ----
  const yearInvoices = invoices.filter((d) => d.doc_date >= from && d.doc_date <= to);
  const received = yearInvoices.reduce((s, d) => s + Number(d.amount_received), 0);
  const spent =
    (yearExpenses ?? []).reduce((s, e) => s + Number(e.amount), 0) +
    (yearLabour ?? []).reduce((s, e) => s + Number(e.amount), 0);
  const profit = received - spent;

  // ---- this month against last ----
  const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const now = new Date();
  const thisKey = monthKey(now);
  const lastKey = monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  const billedIn = (key: string) =>
    invoices.filter((d) => d.doc_date.startsWith(key)).reduce((s, d) => s + Number(d.total), 0);
  const thisMonth = billedIn(thisKey);
  const lastMonth = billedIn(lastKey);

  // ---- things that need him ----
  const billedEstimateIds = new Set(
    invoices.map((d) => d.linked_estimate_id).filter(Boolean) as string[]
  );
  // Work he was told to go ahead with, finished, and never invoiced.
  const unbilled = estimates.filter(
    (d) => d.status === "approved" && !billedEstimateIds.has(d.id)
  );
  const overdue = unpaid.filter((d) => daysBetween(d.doc_date) > OVERDUE_DAYS);
  const awaiting = estimates.filter(
    (d) => d.status === "sent" && daysBetween(d.doc_date) > NO_REPLY_DAYS
  );
  const drafts = all.filter(
    (d) => d.status === "draft" && daysBetween(d.created_at.slice(0, 10)) > UNSENT_DAYS
  );

  const attention = [
    { key: "unbilled", rows: unbilled, label: t.unbilledWork, hint: t.unbilledWorkHint },
    { key: "overdue", rows: overdue, label: t.overdueBills, hint: t.overdueHint },
    { key: "awaiting", rows: awaiting, label: t.awaitingReply, hint: t.awaitingHint },
    { key: "drafts", rows: drafts, label: t.unsentDrafts, hint: t.unsentHint },
  ].filter((a) => a.rows.length > 0);

  // ---- the list underneath ----
  let docs: HomeDoc[];
  if (show) {
    const sets: Record<string, HomeDoc[]> = { unpaid, unbilled, overdue, awaiting, drafts };
    docs = sets[show] ?? [];
  } else if (q) {
    // Straight to the database, so a bill from three years ago is findable.
    const safe = q.replace(/[,()*\\%]/g, " ").trim();
    let query = supabase
      .from("documents")
      .select("id, type, serial_no, doc_date, site_job, status, total, amount_received, linked_estimate_id, created_at, clients(name)")
      .order("doc_date", { ascending: false })
      .limit(200);
    if (type) query = query.eq("type", type);
    if (safe) {
      const { data: matched } = await supabase.from("clients").select("id").ilike("name", `%${safe}%`);
      const ids = (matched ?? []).map((c) => c.id);
      const parts = [`serial_no.ilike.*${safe}*`, `site_job.ilike.*${safe}*`];
      if (ids.length > 0) parts.push(`client_id.in.(${ids.join(",")})`);
      query = query.or(parts.join(","));
    }
    const { data } = await query;
    docs = (data ?? []) as unknown as HomeDoc[];
  } else {
    docs = (type ? all.filter((d) => d.type === type) : all).slice(0, 200);
  }

  // Grouped by month, so the list reads as a record rather than a stream.
  const months: { key: string; docs: HomeDoc[]; billed: number }[] = [];
  for (const d of docs) {
    const key = d.doc_date.slice(0, 7);
    let g = months.find((m) => m.key === key);
    if (!g) {
      g = { key, docs: [], billed: 0 };
      months.push(g);
    }
    g.docs.push(d);
    if (d.type === "invoice") g.billed += Number(d.total);
  }

  const filters = [
    { label: t.all, value: "" },
    { label: t.estimates, value: "estimate" },
    { label: t.invoices, value: "invoice" },
  ];

  return (
    <main>
      {/* ---------- what he is owed ---------- */}
      <section className="hero -mx-4 -mt-4 rounded-b-[2rem] px-5 pb-6 pt-6 text-white shadow-lift">
        <div className="flex items-baseline justify-between">
          <p className="text-[0.7rem] font-extrabold uppercase tracking-[0.14em] text-teal-200">
            {t.toCollect}
          </p>
          <span className="text-[0.7rem] font-bold text-teal-200">{t.appName}</span>
        </div>

        {outstanding > 0 ? (
          <Link href="/?show=unpaid" className="block no-underline">
            <p className="tnum mt-1 text-[2.6rem] font-extrabold leading-none text-white">
              {formatINR(outstanding, 0)}
            </p>
            <p className="mt-1 text-[0.8rem] font-semibold text-teal-100">
              {unpaid.length === 1
                ? t.fromOneBill
                : t.fromBills.replace("{n}", String(unpaid.length))}
              {oldestDays > 0 ? ` · ${t.oldestDays.replace("{n}", String(oldestDays))}` : ""} →
            </p>
          </Link>
        ) : (
          <p className="mt-2 text-lg font-bold text-teal-100">{t.nothingOutstanding}</p>
        )}

        <div className="mt-5 grid grid-cols-3 gap-3">
          <div>
            <p className="text-[0.7rem] font-semibold text-teal-200">
              {t.receivedThisYear} · {year}
            </p>
            <p className="tnum mt-0.5 text-lg font-bold">{formatINR(received, 0)}</p>
          </div>
          <div>
            <p className="text-[0.7rem] font-semibold text-teal-200">{t.totalExpenses}</p>
            <p className="tnum mt-0.5 text-lg font-bold">{formatINR(spent, 0)}</p>
          </div>
          <div>
            <p className="text-[0.7rem] font-semibold text-teal-200">{t.profit}</p>
            <p className="tnum mt-0.5 text-lg font-bold">{formatINR(profit, 0)}</p>
          </div>
        </div>

        <Link
          href="/documents/new?type=estimate"
          className="btn mt-6 w-full bg-white text-lg text-accent-deep shadow-sm"
        >
          ＋ {t.newEstimate}
        </Link>
      </section>

      {searchParams.saved && (
        <p className="mt-4 rounded-2xl bg-green-100 p-3 text-center font-bold text-green-900">
          {t.saved}
        </p>
      )}

      {/* ---------- what to do about it ---------- */}
      {attention.length > 0 && !show && !q && (
        <>
          <h2 className="eyebrow mt-6">{t.needsAttention}</h2>
          <ul className="mt-2 space-y-2">
            {attention.map((a) => (
              <li key={a.key}>
                <Link
                  href={`/?show=${a.key}`}
                  className="card flex items-center justify-between gap-3 p-4"
                >
                  <span className="min-w-0">
                    <span className="block font-extrabold">{a.label}</span>
                    <span className="block text-sm text-stone-500">{a.hint}</span>
                  </span>
                  <span className="shrink-0 rounded-full bg-amber-100 px-3 py-1 text-sm font-extrabold text-amber-900">
                    {a.rows.length}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      {/* ---------- how the month is going ---------- */}
      {!show && !q && (thisMonth > 0 || lastMonth > 0) && (
        <Link href="/summary" className="card mt-4 flex items-center justify-between gap-3 p-4">
          <span>
            <span className="block text-xs font-semibold text-stone-500">{t.thisMonth}</span>
            <span className="tnum text-xl font-extrabold">{formatINR(thisMonth, 0)}</span>
          </span>
          <span className="text-right">
            <span className="block text-xs font-semibold text-stone-500">{t.lastMonth}</span>
            <span className="tnum font-bold text-stone-600">
              {formatINR(lastMonth, 0)}
              {lastMonth > 0 && thisMonth !== lastMonth && (
                <span className={thisMonth > lastMonth ? "text-green-700" : "text-stone-500"}>
                  {" "}
                  {thisMonth > lastMonth ? "↑" : "↓"}
                </span>
              )}
            </span>
            <span className="mt-0.5 block text-xs font-semibold text-accent">
              {t.seeTheYear} →
            </span>
          </span>
        </Link>
      )}

      {/* ---------- search + filter ---------- */}
      {!show && (
        <>
          <form method="get" className="mt-6 flex gap-2">
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder={t.searchPlaceholder}
              className="field flex-1"
            />
            {type && <input type="hidden" name="type" value={type} />}
            <button type="submit" className="btn-secondary px-5">
              {t.searchBtn}
            </button>
          </form>

          <div className="mt-3 flex gap-2">
            {filters.map((f) => (
              <Link
                key={f.value}
                href={
                  f.value
                    ? `/?type=${f.value}${q ? `&q=${encodeURIComponent(q)}` : ""}`
                    : q
                      ? `/?q=${encodeURIComponent(q)}`
                      : "/"
                }
                className={`btn flex-1 text-sm ${
                  type === f.value
                    ? "bg-accent text-white"
                    : "border-2 border-line bg-white text-stone-700"
                }`}
              >
                {f.label}
              </Link>
            ))}
          </div>
        </>
      )}

      {/* ---------- the bills ---------- */}
      {show ? (
        <div className="mt-6 flex items-center justify-between gap-3">
          <h2 className="eyebrow">
            {attention.find((a) => a.key === show)?.label ?? t.toCollect}
          </h2>
          <Link href="/" className="text-sm font-bold text-accent">
            {t.showAllBills}
          </Link>
        </div>
      ) : (
        <h2 className="eyebrow mt-7">{t.recentBills}</h2>
      )}

      {docs.length === 0 ? (
        <div className="card mt-3 p-8 text-center">
          <p className="text-lg text-stone-600">{t.noDocsYet}</p>
          <Link href="/documents/new?type=estimate" className="btn-primary mt-5">
            ＋ {t.newEstimate}
          </Link>
        </div>
      ) : (
        <div className="mt-3 space-y-5">
          {months.map((m) => (
            <section key={m.key}>
              <p className="mb-2 flex items-baseline justify-between">
                <span className="eyebrow">{formatMonth(m.key)}</span>
                {m.billed > 0 && (
                  <span className="tnum text-sm font-bold text-stone-500">
                    {formatINR(m.billed, 0)}
                  </span>
                )}
              </p>
              <ul className="space-y-3">
                {m.docs.map((d) => {
                  const owed = d.type === "invoice" ? balanceOf(d) : 0;
                  return (
                    <li key={d.id}>
                      <Link href={`/documents/${d.id}`} className="card block p-4">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-extrabold">{d.serial_no}</span>
                          <StatusPill status={d.status} label={t.statusLabels[d.status]} />
                        </div>
                        <p className="mt-1 truncate text-stone-700">
                          {d.clients?.name ?? "—"}
                          {d.site_job ? ` · ${d.site_job}` : ""}
                        </p>
                        <div className="mt-1.5 flex items-center justify-between text-sm text-stone-500">
                          <span>
                            {formatDate(d.doc_date)}
                            {owed > 0.005 && (
                              <span className="font-semibold text-amber-700">
                                {" · "}
                                {t.balanceDue} {formatINR(owed, 0)}
                              </span>
                            )}
                          </span>
                          <span className="tnum text-lg font-extrabold text-ink">
                            {formatINR(Number(d.total), 0)}
                          </span>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
