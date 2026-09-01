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
  const { data: expenses } = await supabase
    .from("expenses")
    .select("id, date, category, item, vendor, amount, paid_via, clients(name)")
    .order("date", { ascending: false })
    .limit(300);

  const year = new Date().getFullYear();
  const yearTotal = (expenses ?? [])
    .filter((e) => e.date.startsWith(String(year)))
    .reduce((s, e) => s + Number(e.amount), 0);

  return (
    <main>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t.expenses}</h1>
        <Link href="/expenses/new" className="btn-primary">
          ＋ {t.addExpense}
        </Link>
      </div>

      {searchParams.saved && (
        <p className="mt-3 rounded-xl bg-green-100 p-3 text-center font-semibold text-green-900">
          {t.saved}
        </p>
      )}

      <div className="mt-4 rounded-xl bg-white p-3 shadow-sm">
        <p className="text-xs font-medium text-stone-500">
          {t.totalExpenses} · {year}
        </p>
        <p className="mt-1 text-xl font-bold">{formatINR(yearTotal, 0)}</p>
      </div>

      {(expenses ?? []).length === 0 ? (
        <div className="mt-10 rounded-2xl bg-white p-8 text-center shadow-sm">
          <p className="text-lg text-stone-600">{t.noExpensesYet}</p>
          <Link href="/expenses/new" className="btn-primary mt-5">
            ＋ {t.addExpense}
          </Link>
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {(expenses ?? []).map((e) => (
            <li key={e.id}>
              <Link
                href={`/expenses/${e.id}/edit`}
                className="block rounded-2xl bg-white p-4 shadow-sm active:bg-stone-100"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold">{e.item}</span>
                  <span className="text-lg font-bold">{formatINR(Number(e.amount), 0)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-sm text-stone-500">
                  <span>
                    {e.category}
                    {e.vendor ? ` · ${e.vendor}` : ""}
                    {(e.clients as unknown as { name: string } | null)?.name
                      ? ` · ${(e.clients as unknown as { name: string }).name}`
                      : ""}
                  </span>
                  <span>
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
