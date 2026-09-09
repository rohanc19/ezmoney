import Link from "next/link";
import { getDict } from "@/lib/i18n";
import { formatDate, formatINR } from "@/lib/format";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: { saved?: string };
}) {
  const t = getDict();
  const supabase = supabaseServer();
  const year = new Date().getFullYear();

  const [{ data: expenses }, { data: labour }] = await Promise.all([
    supabase
      .from("expenses")
      .select("id, date, category, item, vendor, amount, paid_via, receipt_path, clients(name)")
      .order("date", { ascending: false })
      .limit(300),
    // Money paid to the people he hires lives in the labour book, not
    // here — but it is spent money, and Home counts it. Showing only the
    // materials figure under the word "Expenses" would put two different
    // numbers behind the same word.
    supabase
      .from("worker_entries")
      .select("amount")
      .neq("kind", "work")
      .gte("entry_date", `${year}-01-01`)
      .lte("entry_date", `${year}-12-31`),
  ]);

  const materialsTotal = (expenses ?? [])
    .filter((e) => e.date.startsWith(String(year)))
    .reduce((s, e) => s + Number(e.amount), 0);
  const labourTotal = (labour ?? []).reduce((s, e) => s + Number(e.amount), 0);
  const yearTotal = materialsTotal + labourTotal;

  return (
    <main>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">{t.expenses}</h1>
        <Link href="/expenses/new" className="btn-primary">
          ＋ {t.addExpense}
        </Link>
      </div>

      {searchParams.saved && (
        <p className="mt-4 rounded-2xl bg-green-100 p-3 text-center font-bold text-green-900">
          {t.saved}
        </p>
      )}

      <Link href="/shops" className="card mt-4 flex items-center justify-between gap-3 p-4">
        <span className="min-w-0">
          <span className="block font-extrabold">{t.priceBook}</span>
          <span className="block text-sm text-stone-500">{t.priceBookHint}</span>
        </span>
        <span aria-hidden className="shrink-0 text-2xl text-stone-400">
          ›
        </span>
      </Link>

      {/* The year's spend, broken out — so this agrees with Home, and he
          can see which half is which. */}
      <div className="card mt-4 p-4">
        <p className="eyebrow">
          {t.totalExpenses} · {year}
        </p>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-stone-600">{t.materialsAndOther}</span>
          <span className="tnum font-semibold">{formatINR(materialsTotal, 0)}</span>
        </div>
        <Link
          href="/labour"
          className="mt-1 flex items-center justify-between text-stone-600"
        >
          <span className="underline decoration-line underline-offset-2">{t.labour}</span>
          <span className="tnum font-semibold">{formatINR(labourTotal, 0)}</span>
        </Link>
        <div className="mt-2 flex items-center justify-between border-t border-line pt-2">
          <span className="font-bold">{t.total}</span>
          <span className="tnum text-xl font-extrabold">{formatINR(yearTotal, 0)}</span>
        </div>
      </div>

      {(expenses ?? []).length === 0 ? (
        <div className="card mt-6 p-8 text-center">
          <p className="text-4xl" aria-hidden>
            🧾
          </p>
          <p className="mt-3 text-lg text-stone-600">{t.noExpensesYet}</p>
          <Link href="/expenses/new" className="btn-primary mt-5">
            ＋ {t.addExpense}
          </Link>
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {(expenses ?? []).map((e) => (
            <li key={e.id}>
              <Link href={`/expenses/${e.id}/edit`} className="card block p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate font-bold">
                    {e.receipt_path ? "📎 " : ""}
                    {e.item}
                  </span>
                  <span className="tnum shrink-0 text-lg font-extrabold">
                    {formatINR(Number(e.amount), 0)}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between gap-3 text-sm text-stone-500">
                  <span className="truncate">
                    {e.category}
                    {e.vendor ? ` · ${e.vendor}` : ""}
                    {(e.clients as unknown as { name: string } | null)?.name
                      ? ` · ${(e.clients as unknown as { name: string }).name}`
                      : ""}
                  </span>
                  <span className="shrink-0">
                    {formatDate(e.date)} · {e.paid_via}
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
