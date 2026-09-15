import Link from "next/link";
import ConfirmButton from "@/components/ConfirmButton";
import { addDayExpense, deleteDayExpense } from "@/lib/actions";
import { addDays, formatDate, formatINR, todayISO } from "@/lib/format";
import { getDict } from "@/lib/i18n";
import { supabaseServer } from "@/lib/supabase/server";
import { EXPENSE_CATEGORIES, PAID_VIA } from "@/lib/types";

export const dynamic = "force-dynamic";

// His evening. He finishes on site, comes home, and writes the day down
// on a spreadsheet. This is that page: one date, everything that happened
// on it already filled in from what the app knows, and one line to add
// what it does not — which is the shop runs.
//
// The point is that he is not asked to remember. The labour he paid, the
// bills he raised and the money that came in are already on the page; he
// only types the till receipts in his pocket. Adding a line keeps him on
// the same day, so it is a list he works down, not a form he reopens.

export default async function DayPage({
  searchParams,
}: {
  searchParams: { d?: string };
}) {
  const t = getDict();
  const supabase = supabaseServer();
  const today = todayISO();
  const day = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.d ?? "") ? searchParams.d! : today;

  const [{ data: spends }, { data: labour }, { data: billed }, { data: paid }, { data: clients }] =
    await Promise.all([
      supabase
        .from("expenses")
        .select("id, item, vendor, category, amount, paid_via, clients(name)")
        .eq("date", day)
        .order("id"),
      supabase
        .from("worker_entries")
        .select("id, kind, amount, site_job, workers(name)")
        .eq("entry_date", day)
        .neq("kind", "work"),
      supabase
        .from("documents")
        .select("id, serial_no, type, total, clients(name)")
        .eq("doc_date", day),
      supabase
        .from("payments")
        .select("id, amount, method, documents(serial_no, clients(name))")
        .eq("paid_on", day),
      supabase.from("clients").select("id, name").order("name"),
    ]);

  const spent = (spends ?? []).reduce((s, e) => s + Number(e.amount), 0);
  const toLabour = (labour ?? []).reduce((s, e) => s + Number(e.amount), 0);
  const billedTotal = (billed ?? [])
    .filter((d) => d.type === "invoice")
    .reduce((s, d) => s + Number(d.total), 0);
  const received = (paid ?? []).reduce((s, p) => s + Number(p.amount), 0);
  const outOfPocket = spent + toLabour;

  const isToday = day === today;
  const heading = isToday ? t.today : formatDate(day);

  return (
    <main>
      {/* the day he is looking at */}
      <div className="flex items-center justify-between gap-2">
        <Link
          href={`/day?d=${addDays(day, -1)}`}
          aria-label={t.prevDay}
          className="btn-secondary min-h-[44px] px-3 text-xl font-bold"
        >
          ‹
        </Link>
        <div className="min-w-0 text-center">
          <h1 className="truncate text-2xl font-extrabold">{heading}</h1>
          {!isToday && <p className="text-sm text-stone-500">{formatDate(day)}</p>}
        </div>
        {day < today ? (
          <Link
            href={`/day?d=${addDays(day, 1)}`}
            aria-label={t.nextDay}
            className="btn-secondary min-h-[44px] px-3 text-xl font-bold"
          >
            ›
          </Link>
        ) : (
          // Nothing has happened tomorrow yet.
          <span className="min-h-[44px] w-[46px]" />
        )}
      </div>

      {/* what the day cost him, and what came back */}
      <div className="card mt-4 p-4">
        <div className="flex items-baseline justify-between">
          <span className="font-semibold text-stone-600">{t.spentToday}</span>
          <span className="tnum text-2xl font-extrabold text-amber-700">
            {formatINR(outOfPocket, 0)}
          </span>
        </div>
        {toLabour > 0 && (
          <p className="mt-1 text-sm text-stone-500">
            {t.paidToLabourToday} {formatINR(toLabour, 0)}
          </p>
        )}
        {(received > 0 || billedTotal > 0) && (
          <dl className="mt-3 border-t border-line pt-2 text-sm">
            {received > 0 && (
              <div className="flex justify-between py-0.5">
                <dt className="text-stone-600">{t.receivedToday}</dt>
                <dd className="tnum font-bold text-green-800">{formatINR(received, 0)}</dd>
              </div>
            )}
            {billedTotal > 0 && (
              <div className="flex justify-between py-0.5">
                <dt className="text-stone-600">{t.billedToday}</dt>
                <dd className="tnum font-semibold">{formatINR(billedTotal, 0)}</dd>
              </div>
            )}
          </dl>
        )}
      </div>

      {/* the one line he types — what he bought, and what it cost */}
      <form action={addDayExpense} className="card mt-4 space-y-3 p-4">
        <input type="hidden" name="date" value={day} />
        <div className="flex gap-2">
          <div className="min-w-0 flex-1">
            <input
              name="item"
              placeholder={t.whatDidYouBuy}
              required
              className="field"
              autoComplete="off"
            />
          </div>
          <div className="w-28 shrink-0">
            <input
              name="amount"
              inputMode="decimal"
              placeholder="₹"
              required
              className="field tnum"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <div className="w-32 shrink-0">
            <select name="category" className="field px-2" defaultValue="Materials">
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="min-w-0 flex-1">
            <input name="vendor" placeholder={t.vendor} className="field" autoComplete="off" />
          </div>
        </div>
        <div className="flex gap-2">
          <div className="w-32 shrink-0">
            <select name="paid_via" className="field px-2" defaultValue="Cash">
              {PAID_VIA.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </div>
          <div className="min-w-0 flex-1">
            <select name="client_id" className="field px-2" defaultValue="">
              <option value="">{t.forClient}</option>
              {(clients ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button type="submit" className="btn-primary w-full">
          + {t.addExpense}
        </button>
      </form>

      {/* everything on this day, his lines and the app's own */}
      {(spends ?? []).length === 0 &&
      (labour ?? []).length === 0 &&
      (billed ?? []).length === 0 &&
      (paid ?? []).length === 0 ? (
        <p className="card mt-4 p-8 text-center text-stone-600">{t.nothingYet}</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {(spends ?? []).map((e) => (
            <li key={e.id} className="card flex items-center gap-3 p-3">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold">{e.item}</span>
                <span className="block text-xs text-stone-500">
                  {e.category}
                  {e.vendor ? ` · ${e.vendor}` : ""}
                  {e.paid_via ? ` · ${e.paid_via}` : ""}
                  {(e.clients as unknown as { name: string } | null)?.name
                    ? ` · ${(e.clients as unknown as { name: string }).name}`
                    : ""}
                </span>
              </span>
              <span className="tnum shrink-0 font-extrabold">{formatINR(Number(e.amount), 0)}</span>
              <form action={deleteDayExpense} className="shrink-0">
                <input type="hidden" name="id" value={e.id} />
                <input type="hidden" name="date" value={day} />
                <ConfirmButton
                  message={t.confirmDeleteExpense}
                  confirmLabel={t.tapAgain}
                  className="min-h-[40px] rounded-lg px-2 text-sm font-bold text-red-700"
                >
                  ×
                </ConfirmButton>
              </form>
            </li>
          ))}

          {/* Already in the labour book — shown so he does not write it
              twice, and not editable here for the same reason. */}
          {(labour ?? []).map((e) => (
            <li key={e.id} className="card flex items-center gap-3 p-3 opacity-90">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold">
                  {(e.workers as unknown as { name: string } | null)?.name ?? t.labour}
                </span>
                <span className="block text-xs text-stone-500">
                  {e.kind === "advance" ? t.advance : t.payment}
                  {e.site_job ? ` · ${e.site_job}` : ""}
                </span>
              </span>
              <span className="tnum shrink-0 font-extrabold">{formatINR(Number(e.amount), 0)}</span>
            </li>
          ))}

          {(paid ?? []).map((p) => {
            const d = p.documents as unknown as { serial_no: string; clients?: { name: string } | null } | null;
            return (
              <li key={p.id} className="card flex items-center gap-3 p-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold text-green-800">
                    {t.receivedToday} · {d?.clients?.name ?? d?.serial_no ?? ""}
                  </span>
                  <span className="block text-xs text-stone-500">
                    {d?.serial_no ?? ""}
                    {p.method ? ` · ${p.method}` : ""}
                  </span>
                </span>
                <span className="tnum shrink-0 font-extrabold text-green-800">
                  + {formatINR(Number(p.amount), 0)}
                </span>
              </li>
            );
          })}

          {(billed ?? []).map((d) => (
            <li key={d.id}>
              <Link href={`/documents/${d.id}`} className="card flex items-center gap-3 p-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold">
                    {(d.clients as unknown as { name: string } | null)?.name ?? d.serial_no}
                  </span>
                  <span className="block text-xs text-stone-500">{d.serial_no}</span>
                </span>
                <span className="tnum shrink-0 font-semibold text-stone-600">
                  {formatINR(Number(d.total), 0)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Link href="/expenses" className="mt-5 block text-center text-sm font-bold text-accent">
        {t.allExpenses} →
      </Link>
    </main>
  );
}
