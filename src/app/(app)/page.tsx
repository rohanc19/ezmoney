import Link from "next/link";
import StatusPill from "@/components/StatusPill";
import { findDuplicateBills, labourDue } from "@/lib/summary";
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
  client_id: string | null;
  site_job: string;
  status: string;
  total: number;
  amount_received: number;
  linked_estimate_id: string | null;
  created_at: string;
  clients?: { name: string } | null;
}


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
  const show = ["unpaid", "duplicates"].includes(searchParams.show ?? "")
    ? searchParams.show!
    : "";

  // One pass over his bills feeds the money, the attention list and the
  // filtered views. Search is the exception — it runs in the database so
  // it can reach bills older than this window.
  //
  // The year's spend used to be read here too, for a Profit figure in the
  // hero. It is on /summary now, and Home is two round-trips to Singapore
  // lighter for it.
  const { data: allRaw } = await supabase
    .from("documents")
    .select(
      "id, type, serial_no, doc_date, client_id, site_job, status, total, amount_received, linked_estimate_id, created_at, clients(name)"
    )
    .order("doc_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1000);

  const [{ data: clientRows }, { data: labourRows }] = await Promise.all([
    supabase.from("clients").select("id, name").order("name"),
    // What has to leave his pocket on Saturday. Money out belongs beside
    // money in on the screen he opens first.
    supabase.from("worker_entries").select("worker_id, kind, amount"),
  ]);
  const owedToLabour = labourDue(labourRows ?? []);

  const all = (allRaw ?? []) as unknown as HomeDoc[];
  const invoices = all.filter((d) => d.type === "invoice");

  // ---- what he is owed, across every year ----
  const unpaid = invoices
    .filter((d) => balanceOf(d) > 0.005)
    .sort((a, b) => a.doc_date.localeCompare(b.doc_date)); // oldest first — chase those
  const outstanding = unpaid.reduce((s, d) => s + balanceOf(d), 0);
  const oldestDays = unpaid.length > 0 ? daysBetween(unpaid[0].doc_date) : 0;

  // ---- the same bill twice ----
  // One line, not a card: he asked for the attention stack off Home and
  // was right, so this earns its place by being almost nothing when there
  // is something to say, and nothing at all when there is not.
  const duplicates = findDuplicateBills(all);

  // ---- the list underneath ----
  let docs: HomeDoc[];
  if (show) {
    docs = show === "unpaid" ? unpaid : show === "duplicates" ? duplicates : [];
  } else if (q) {
    // Straight to the database, so a bill from three years ago is findable.
    const safe = q.replace(/[,()*\\%]/g, " ").trim();
    let query = supabase
      .from("documents")
      .select("id, type, serial_no, doc_date, client_id, site_job, status, total, amount_received, linked_estimate_id, created_at, clients(name)")
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

  // ---- where each client stands ----
  // This is what he opens the app to see: the names, and against each one
  // whether he is waiting on paper, waiting on money, or square.
  type ClientState = {
    id: string;
    name: string;
    outstanding: number;
    bills: number;
    last: string;
    status: string | null;
  };
  const byClient = new Map<string, { outstanding: number; bills: number; last: string; draft: boolean; part: boolean; invoices: number }>();
  for (const d of all) {
    if (!d.client_id) continue;
    const c = byClient.get(d.client_id) ?? {
      outstanding: 0,
      bills: 0,
      last: "",
      draft: false,
      part: false,
      invoices: 0,
    };
    c.bills += 1;
    if (d.doc_date > c.last) c.last = d.doc_date;
    if (d.type === "invoice") {
      c.invoices += 1;
      const owed = balanceOf(d);
      c.outstanding += owed;
      if (owed > 0.005 && d.status === "draft") c.draft = true;
      if (owed > 0.005 && Number(d.amount_received) > 0) c.part = true;
    }
    byClient.set(d.client_id, c);
  }

  const clientStates: ClientState[] = (clientRows ?? []).map((c) => {
    const x = byClient.get(c.id);
    let status: string | null = null;
    if (x && x.invoices > 0) {
      if (x.outstanding <= 0.005) status = "paid";
      else if (x.part) status = "partly_paid";
      // An unsent draft is money he cannot chase yet — that is the more
      // useful thing to say than "unpaid".
      else if (x.draft) status = "draft";
      else status = "sent";
    }
    return {
      id: c.id,
      name: c.name,
      outstanding: x?.outstanding ?? 0,
      bills: x?.bills ?? 0,
      last: x?.last ?? "",
      status,
    };
  });
  clientStates.sort((a, b) => {
    if (a.outstanding !== b.outstanding) return b.outstanding - a.outstanding; // who owes, first
    if (a.last !== b.last) return b.last.localeCompare(a.last);
    return a.name.localeCompare(b.name);
  });

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

        <Link
          href="/documents/new?type=estimate"
          className="btn mt-5 w-full bg-white text-lg text-accent-deep shadow-sm"
        >
          ＋ {t.newEstimate}
        </Link>
      </section>

      {searchParams.saved && (
        <p className="mt-4 rounded-2xl bg-green-100 p-3 text-center font-bold text-green-900">
          {t.saved}
        </p>
      )}

      {owedToLabour > 0 && !show && !q && (
        <Link
          href="/labour"
          className="card mt-4 flex items-center justify-between gap-3 p-4 no-underline"
        >
          <span className="font-semibold text-stone-600">{t.toPayLabour}</span>
          <span className="tnum shrink-0 text-xl font-extrabold text-amber-700">
            {formatINR(owedToLabour, 0)}
          </span>
        </Link>
      )}

      {/* ---------- search + filter ---------- */}
      {!show && (
        <>
          <form method="get" className="mt-6">
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder={t.searchPlaceholder}
              className="field"
            />
            {type && <input type="hidden" name="type" value={type} />}
          </form>

          {q && (
            <div className="mt-3 flex gap-2">
              {filters.map((f) => (
                <Link
                  key={f.value}
                  href={
                    f.value
                      ? `/?type=${f.value}&q=${encodeURIComponent(q)}`
                      : `/?q=${encodeURIComponent(q)}`
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
          )}
        </>
      )}

      {duplicates.length > 0 && !show && !q && (
        <Link
          href="/?show=duplicates"
          className="mt-5 flex items-center justify-between gap-3 rounded-2xl bg-amber-50 px-4 py-3 font-semibold text-amber-900 no-underline"
        >
          <span>{t.possibleDuplicate}</span>
          <span className="shrink-0 underline">{t.openBoth} →</span>
        </Link>
      )}

      {/* ---------- his customers ----------
           The list of bills that used to live here said the same thing
           four times over — every client's bills are on the client. This
           is the names, and where each one stands. */}
      {!show && !q && (
        <>
          <div className="mt-7 flex items-center justify-between gap-3">
            <h2 className="eyebrow">{t.clients}</h2>
            <Link href="/clients/new" className="text-sm font-bold text-accent">
              + {t.addNewClient.replace("+ ", "")}
            </Link>
          </div>

          {clientStates.length === 0 ? (
            <div className="card mt-3 p-8 text-center">
              <p className="text-lg text-stone-600">{t.noClientsYet}</p>
              <Link href="/clients/new" className="btn-primary mt-5">
                + {t.addNewClient.replace("+ ", "")}
              </Link>
            </div>
          ) : (
            <ul className="mt-3 space-y-2">
              {clientStates.map((c, i) => (
                <li key={c.id}>
                  <Link href={`/clients/${c.id}`} className="card block p-4">
                    <div className="flex items-start gap-3">
                      <span
                        aria-hidden
                        className="tnum w-5 shrink-0 pt-0.5 text-right text-sm font-bold text-stone-400"
                      >
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-extrabold">{c.name}</span>
                        <span className="mt-0.5 block text-sm text-stone-500">
                          {c.bills === 0
                            ? t.noBillsYet
                            : `${c.bills === 1 ? t.oneBillLabel : t.nBills.replace("{n}", String(c.bills))}${
                                c.last ? ` · ${formatDate(c.last)}` : ""
                              }`}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        {c.outstanding > 0.005 && (
                          <span className="tnum block font-extrabold text-amber-700">
                            {formatINR(c.outstanding, 0)}
                          </span>
                        )}
                        {c.status && (
                          <span className="mt-1 block">
                            <StatusPill
                              status={c.status}
                              label={t.statusLabels[c.status]}
                              size="sm"
                            />
                          </span>
                        )}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {/* ---------- the bills ---------- */}
      {show ? (
        <div className="mt-6 flex items-center justify-between gap-3">
          <h2 className="eyebrow">
            {show === "duplicates" ? t.possibleDuplicate : t.toCollect}
          </h2>
          <Link href="/" className="text-sm font-bold text-accent">
            {t.showAllBills}
          </Link>
        </div>
      ) : q ? (
        <h2 className="eyebrow mt-7">{t.recentBills}</h2>
      ) : null}

      {!show && !q ? null : docs.length === 0 ? (
        show ? (
          <p className="card mt-3 p-8 text-center text-stone-600">{t.nothingHere}</p>
        ) : (
          <div className="card mt-3 p-8 text-center">
            <p className="text-lg text-stone-600">{t.noDocsYet}</p>
            <Link href="/documents/new?type=estimate" className="btn-primary mt-5">
              ＋ {t.newEstimate}
            </Link>
          </div>
        )
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
