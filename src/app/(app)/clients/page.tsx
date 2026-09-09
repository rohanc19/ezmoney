import Link from "next/link";
import { getDict } from "@/lib/i18n";
import { formatDate, formatINR } from "@/lib/format";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const t = getDict();
  const supabase = supabaseServer();

  const [{ data: clients }, { data: docs }] = await Promise.all([
    supabase.from("clients").select("id, name, phone, address").order("name"),
    supabase.from("documents").select("client_id, type, total, amount_received, doc_date"),
  ]);

  // Outstanding = invoices raised for them that are not yet paid.
  const summary = new Map<
    string,
    { billed: number; outstanding: number; count: number; last: string }
  >();
  for (const d of docs ?? []) {
    if (!d.client_id) continue;
    const s = summary.get(d.client_id) ?? { billed: 0, outstanding: 0, count: 0, last: "" };
    s.count += 1;
    if (d.doc_date > s.last) s.last = d.doc_date;
    if (d.type === "invoice") {
      s.billed += Number(d.total);
      s.outstanding += Number(d.total) - Number(d.amount_received);
    }
    summary.set(d.client_id, s);
  }

  const rows = (clients ?? []).slice().sort((a, b) => {
    const oa = summary.get(a.id)?.outstanding ?? 0;
    const ob = summary.get(b.id)?.outstanding ?? 0;
    if (oa !== ob) return ob - oa; // who owes money, first
    return a.name.localeCompare(b.name);
  });

  const totalOutstanding = [...summary.values()].reduce((s, x) => s + x.outstanding, 0);

  return (
    <main>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">{t.clients}</h1>
        <Link href="/clients/new" className="btn-secondary">
          + {t.addNewClient.replace("+ ", "")}
        </Link>
      </div>

      {totalOutstanding > 0 && (
        <div className="card mt-4 flex items-center justify-between p-4">
          <span className="font-semibold text-stone-600">{t.stillToCollect}</span>
          <span className="tnum text-xl font-extrabold text-amber-700">
            {formatINR(totalOutstanding, 0)}
          </span>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="card mt-6 p-8 text-center">
          <p className="mt-3 text-lg text-stone-600">{t.noClientsYet}</p>
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {rows.map((c) => {
            const s = summary.get(c.id);
            return (
              <li key={c.id}>
                <Link href={`/clients/${c.id}`} className="card block p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate font-extrabold">{c.name}</span>
                    {/* Colour and a word, never colour alone. */}
                    {s && s.outstanding > 0 ? (
                      <span className="tnum shrink-0 rounded-full bg-amber-100 px-3 py-1 text-sm font-bold text-amber-900">
                        {formatINR(s.outstanding, 0)}
                      </span>
                    ) : s ? (
                      <span className="shrink-0 rounded-full bg-green-100 px-3 py-1 text-sm font-bold text-green-900">
                        {t.settled}
                      </span>
                    ) : null}
                  </div>
                  {/* What he wants to know about a client is when he last
                      worked for them, not a dash where an address is not. */}
                  <p className="mt-1 truncate text-sm text-stone-500">
                    {s
                      ? `${s.count} ${t.jobsFor.toLowerCase()} · ${t.lastBill} ${formatDate(s.last)}`
                      : c.phone || c.address || t.noBillsForClient}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
