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
  const type = searchParams.type === "estimate" || searchParams.type === "invoice" ? searchParams.type : "";

  // ---- documents list ----
  let query = supabase
    .from("documents")
    .select("id, type, serial_no, doc_date, site_job, status, total, clients(name)")
    .order("doc_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(200);
  if (type) query = query.eq("type", type);
  const { data: docsRaw } = await query;
  let docs = (docsRaw ?? []) as unknown as DocumentRow[];
  if (q) {
    const needle = q.toLowerCase();
    docs = docs.filter(
      (d) =>
        d.serial_no.toLowerCase().includes(needle) ||
        d.site_job.toLowerCase().includes(needle) ||
        (d.clients?.name ?? "").toLowerCase().includes(needle)
    );
  }

  // ---- stat strip: current year ----
  const year = new Date().getFullYear();
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;
  const [{ data: yearInvoices }, { data: yearExpenses }] = await Promise.all([
    supabase
      .from("documents")
      .select("total, status")
      .eq("type", "invoice")
      .gte("doc_date", from)
      .lte("doc_date", to),
    supabase.from("expenses").select("amount").gte("date", from).lte("date", to),
  ]);
  const invoiced = (yearInvoices ?? []).reduce((s, d) => s + Number(d.total), 0);
  const received = (yearInvoices ?? [])
    .filter((d) => d.status === "paid")
    .reduce((s, d) => s + Number(d.total), 0);
  const pending = invoiced - received;
  const spent = (yearExpenses ?? []).reduce((s, e) => s + Number(e.amount), 0);
  const profit = received - spent;

  const stats = [
    { label: t.totalInvoiced, value: invoiced },
    { label: t.received, value: received },
    { label: t.pending, value: pending },
    { label: t.totalExpenses, value: spent },
    { label: t.profit, value: profit },
  ];

  const filters = [
    { label: t.all, value: "" },
    { label: t.estimates, value: "estimate" },
    { label: t.invoices, value: "invoice" },
  ];

  return (
    <main>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t.home}</h1>
        <Link href="/documents/new?type=estimate" className="btn-primary">
          {t.newEstimate}
        </Link>
      </div>

      {searchParams.saved && (
        <p className="mt-3 rounded-xl bg-green-100 p-3 text-center font-semibold text-green-900">
          {t.saved}
        </p>
      )}

      {/* stat strip */}
      <div className="mt-4 overflow-x-auto">
        <div className="flex min-w-max gap-2">
          {stats.map((s) => (
            <div key={s.label} className="min-w-[7.5rem] rounded-xl bg-white p-3 shadow-sm">
              <p className="text-xs font-medium text-stone-500">
                {s.label} · {year}
              </p>
              <p className={`mt-1 font-bold ${s.value < 0 ? "text-red-700" : "text-stone-900"}`}>
                {formatINR(s.value, 0)}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* search + filter */}
      <form method="get" className="mt-4 flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder={t.searchPlaceholder}
          className="field flex-1"
        />
        {type && <input type="hidden" name="type" value={type} />}
        <button type="submit" className="btn-secondary" aria-label="Search">
          🔍
        </button>
      </form>
      <div className="mt-3 flex gap-2">
        {filters.map((f) => (
          <Link
            key={f.value}
            href={f.value ? `/?type=${f.value}${q ? `&q=${encodeURIComponent(q)}` : ""}` : q ? `/?q=${encodeURIComponent(q)}` : "/"}
            className={`btn flex-1 text-sm ${
              type === f.value ? "bg-accent text-white" : "border-2 border-stone-300 bg-white"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {/* documents */}
      {docs.length === 0 ? (
        <div className="mt-10 rounded-2xl bg-white p-8 text-center shadow-sm">
          <p className="text-lg text-stone-600">{t.noDocsYet}</p>
          <Link href="/documents/new?type=estimate" className="btn-primary mt-5">
            {t.newEstimate}
          </Link>
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {docs.map((d) => (
            <li key={d.id}>
              <Link
                href={`/documents/${d.id}`}
                className="block rounded-2xl bg-white p-4 shadow-sm active:bg-stone-100"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-bold">{d.serial_no}</span>
                  <StatusPill status={d.status} label={t.statusLabels[d.status]} />
                </div>
                <p className="mt-1 truncate text-stone-700">
                  {d.clients?.name ?? "—"}
                  {d.site_job ? ` · ${d.site_job}` : ""}
                </p>
                <div className="mt-1 flex items-center justify-between text-sm text-stone-500">
                  <span>{formatDate(d.doc_date)}</span>
                  <span className="text-lg font-bold text-stone-900">{formatINR(Number(d.total), 0)}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
