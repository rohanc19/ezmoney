import Link from "next/link";
import StatusPill from "@/components/StatusPill";
import { getDict } from "@/lib/i18n";
import { formatDate, formatINR } from "@/lib/format";
import { supabaseServer } from "@/lib/supabase/server";
import type { DocumentRow } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: { q?: string; type?: string; saved?: string };
}) {
  const t = getDict();
  const supabase = supabaseServer();
  const q = (searchParams.q ?? "").trim();
  const type =
    searchParams.type === "estimate" || searchParams.type === "invoice" ? searchParams.type : "";

  let query = supabase
    .from("documents")
    .select("id, type, serial_no, doc_date, site_job, status, total, clients(name)")
    .order("doc_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(200);
  if (type) query = query.eq("type", type);

  // Search runs in the database, across every bill he has ever made.
  // Filtering the last 200 in JavaScript looked fine and quietly returned
  // "no bills" for anything older than that.
  if (q) {
    // These characters are the filter language's own punctuation.
    const safe = q.replace(/[,()*\\%]/g, " ").trim();
    if (safe) {
      const { data: matchedClients } = await supabase
        .from("clients")
        .select("id")
        .ilike("name", `%${safe}%`);
      const clientIds = (matchedClients ?? []).map((c) => c.id);

      const parts = [`serial_no.ilike.*${safe}*`, `site_job.ilike.*${safe}*`];
      if (clientIds.length > 0) parts.push(`client_id.in.(${clientIds.join(",")})`);
      query = query.or(parts.join(","));
    }
  }

  const { data: docsRaw } = await query;
  const docs = (docsRaw ?? []) as unknown as DocumentRow[];

  // ---- the year's money ----
  const year = new Date().getFullYear();
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;
  const [{ data: yearInvoices }, { data: yearExpenses }, { data: yearLabour }] = await Promise.all([
    supabase
      .from("documents")
      .select("total, amount_received")
      .eq("type", "invoice")
      .gte("doc_date", from)
      .lte("doc_date", to),
    supabase.from("expenses").select("amount").gte("date", from).lte("date", to),
    // Money handed to the people he hires is real money out, so it
    // belongs in the year's spend alongside materials.
    supabase
      .from("worker_entries")
      .select("amount, kind")
      .neq("kind", "work")
      .gte("entry_date", from)
      .lte("entry_date", to),
  ]);
  const invoiced = (yearInvoices ?? []).reduce((s, d) => s + Number(d.total), 0);
  // Part-payments count. A bill half settled puts half its money here and
  // leaves the other half in "still to collect".
  const received = (yearInvoices ?? []).reduce((s, d) => s + Number(d.amount_received), 0);
  const pending = invoiced - received;
  const spent =
    (yearExpenses ?? []).reduce((s, e) => s + Number(e.amount), 0) +
    (yearLabour ?? []).reduce((s, e) => s + Number(e.amount), 0);
  const profit = received - spent;

  const filters = [
    { label: t.all, value: "" },
    { label: t.estimates, value: "estimate" },
    { label: t.invoices, value: "invoice" },
  ];

  return (
    <main>
      {/* ---------- the money, up front ---------- */}
      <section className="hero -mx-4 -mt-4 rounded-b-[2rem] px-5 pb-6 pt-6 text-white shadow-lift">
        <div className="flex items-baseline justify-between">
          <p className="text-[0.7rem] font-extrabold uppercase tracking-[0.14em] text-teal-200">
            {t.moneyIn} · {year}
          </p>
          <span className="text-[0.7rem] font-bold text-teal-200">{t.appName}</span>
        </div>
        <p className="tnum mt-1 text-[2.6rem] font-extrabold leading-none">
          {formatINR(received, 0)}
        </p>

        <div className="mt-5 grid grid-cols-3 gap-3">
          <div>
            <p className="text-[0.7rem] font-semibold text-teal-200">{t.stillToCollect}</p>
            <p className="tnum mt-0.5 text-lg font-bold">{formatINR(pending, 0)}</p>
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

      {/* ---------- search + filter ---------- */}
      <form method="get" className="mt-6 flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder={t.searchPlaceholder}
          className="field flex-1"
        />
        {type && <input type="hidden" name="type" value={type} />}
        <button type="submit" className="btn-secondary px-4" aria-label="Search">
          🔍
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

      {/* ---------- bills ---------- */}
      <h2 className="eyebrow mt-7">{t.recentBills}</h2>

      {docs.length === 0 ? (
        <div className="card mt-3 p-8 text-center">
          <p className="text-4xl" aria-hidden>
            🧾
          </p>
          <p className="mt-3 text-lg text-stone-600">{t.noDocsYet}</p>
          <Link href="/documents/new?type=estimate" className="btn-primary mt-5">
            ＋ {t.newEstimate}
          </Link>
        </div>
      ) : (
        <ul className="mt-3 space-y-3">
          {docs.map((d) => (
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
                  <span>{formatDate(d.doc_date)}</span>
                  <span className="tnum text-lg font-extrabold text-ink">
                    {formatINR(Number(d.total), 0)}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
