import Link from "next/link";
import { getDict } from "@/lib/i18n";
import { formatINR } from "@/lib/format";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function LabourPage() {
  const t = getDict();
  const supabase = supabaseServer();

  const [{ data: workers }, { data: entries }] = await Promise.all([
    supabase.from("workers").select("id, name, phone, skill, active").order("name"),
    supabase.from("worker_entries").select("worker_id, kind, amount, entry_date"),
  ]);

  // Earned - paid = what he still owes each person.
  const book = new Map<string, { earned: number; paid: number }>();
  const year = String(new Date().getFullYear());
  let paidThisYear = 0;
  for (const e of entries ?? []) {
    const b = book.get(e.worker_id) ?? { earned: 0, paid: 0 };
    if (e.kind === "work") b.earned += Number(e.amount);
    else {
      b.paid += Number(e.amount);
      if (String(e.entry_date).startsWith(year)) paidThisYear += Number(e.amount);
    }
    book.set(e.worker_id, b);
  }

  const balanceOf = (id: string) => {
    const b = book.get(id);
    return b ? b.earned - b.paid : 0;
  };

  const rows = (workers ?? []).slice().sort((a, b) => {
    // People still working come first, then whoever is owed the most.
    if (a.active !== b.active) return a.active ? -1 : 1;
    const d = balanceOf(b.id) - balanceOf(a.id);
    if (d !== 0) return d;
    return a.name.localeCompare(b.name);
  });

  const totalToPay = rows.reduce((s, w) => s + Math.max(0, balanceOf(w.id)), 0);

  return (
    <main>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">{t.labour}</h1>
        <Link href="/labour/new" className="btn-secondary">
          ＋ {t.addWorker}
        </Link>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="card p-4">
          <p className="text-xs font-semibold text-stone-500">{t.toPay}</p>
          <p
            className={`tnum mt-0.5 text-xl font-extrabold ${
              totalToPay > 0 ? "text-amber-700" : "text-stone-800"
            }`}
          >
            {formatINR(totalToPay, 0)}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-semibold text-stone-500">{t.labourThisYear}</p>
          <p className="tnum mt-0.5 text-xl font-extrabold">{formatINR(paidThisYear, 0)}</p>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="card mt-6 p-8 text-center">
          <p className="text-lg text-stone-600">{t.noWorkersYet}</p>
          <Link href="/labour/new" className="btn-primary mt-5">
            ＋ {t.addWorker}
          </Link>
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {rows.map((w) => {
            const balance = balanceOf(w.id);
            return (
              <li key={w.id}>
                <Link href={`/labour/${w.id}`} className="card block p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate font-extrabold">
                      {w.name}
                      {!w.active && (
                        <span className="ml-2 rounded-full bg-stone-100 px-2 py-0.5 text-xs font-bold text-stone-500">
                          {t.pastWorker}
                        </span>
                      )}
                    </span>
                    {balance > 0 ? (
                      <span className="tnum shrink-0 rounded-full bg-amber-100 px-3 py-1 text-sm font-bold text-amber-900">
                        {t.toPay} {formatINR(balance, 0)}
                      </span>
                    ) : (
                      <span className="shrink-0 rounded-full bg-green-100 px-3 py-1 text-sm font-bold text-green-900">
                        {t.allSettled}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 truncate text-sm text-stone-500">
                    {w.skill}
                    {w.phone ? ` · ${w.phone}` : ""}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-6 text-center text-sm text-stone-500">{t.labourHint}</p>
    </main>
  );
}
