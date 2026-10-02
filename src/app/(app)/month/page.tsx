import Link from "next/link";
import { formatINR, formatIndianNumber, formatMonth, todayISO } from "@/lib/format";
import { getDict } from "@/lib/i18n";
import { monthMoney, nextMonth, prevMonth, topBy } from "@/lib/summary";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// The month, end to end: what he billed, what actually arrived, what left,
// and what is left over — each against the month before, because a figure
// on its own tells him nothing he did not already feel.
//
// Cash basis throughout. A bill raised on the 28th and paid in November is
// this month's work and next month's money, and the two are kept apart:
// "billed" sits beside the money figures, never inside their sum.

const firstOf = (key: string) => `${key}-01`;

export default async function MonthPage({
  searchParams,
}: {
  searchParams: { m?: string };
}) {
  const t = getDict();
  const supabase = supabaseServer();

  const thisKey = todayISO().slice(0, 7);
  const key = /^\d{4}-\d{2}$/.test(searchParams.m ?? "") ? searchParams.m! : thisKey;
  const prev = prevMonth(key);

  // A two-month window, split in code — one trip instead of two per table.
  const from = `${prev}-01`;
  const to = `${nextMonth(key)}-01`;

  const [
    { data: docs },
    { data: payments },
    { data: expenses },
    { data: labour },
    { data: workers },
    { data: clients },
  ] = await Promise.all([
    supabase
      .from("documents")
      .select("id, type, doc_date, total, client_id")
      .gte("doc_date", from)
      .lt("doc_date", to),
    supabase.from("payments").select("paid_on, amount").gte("paid_on", from).lt("paid_on", to),
    supabase
      .from("expenses")
      .select("date, item, amount, vendor, qty, unit")
      .gte("date", from)
      .lt("date", to),
    supabase
      .from("worker_entries")
      .select("entry_date, kind, amount, days, worker_id")
      .gte("entry_date", from)
      .lt("entry_date", to),
    supabase.from("workers").select("id, name"),
    supabase.from("clients").select("id, name"),
  ]);

  const all = {
    docs: docs ?? [],
    payments: payments ?? [],
    expenses: expenses ?? [],
    labour: labour ?? [],
  };
  const now = monthMoney({ monthKey: key, ...all });
  const was = monthMoney({ monthKey: prev, ...all });

  const inThis = (iso: string) => (iso ?? "").slice(0, 7) === key;
  const clientName = new Map((clients ?? []).map((c) => [c.id, c.name]));
  const workerName = new Map((workers ?? []).map((w) => [w.id, w.name]));

  // Who he worked for.
  const byClient = new Map<string, { name: string; billed: number; jobs: number }>();
  for (const d of all.docs) {
    if (d.type !== "invoice" || !inThis(d.doc_date) || !d.client_id) continue;
    const row = byClient.get(d.client_id) ?? {
      name: clientName.get(d.client_id) ?? "—",
      billed: 0,
      jobs: 0,
    };
    row.billed += Number(d.total);
    row.jobs += 1;
    byClient.set(d.client_id, row);
  }
  const customers = topBy([...byClient.values()], (r) => r.billed, 6);

  // Where the money went.
  const byShop = new Map<string, number>();
  const byItem = new Map<string, { item: string; spent: number; times: number }>();
  for (const e of all.expenses) {
    if (!inThis(e.date)) continue;
    const shop = (e.vendor ?? "").trim() || t.otherShop;
    byShop.set(shop, (byShop.get(shop) ?? 0) + Number(e.amount));
    const row = byItem.get(e.item) ?? { item: e.item, spent: 0, times: 0 };
    row.spent += Number(e.amount);
    row.times += 1;
    byItem.set(e.item, row);
  }
  const shops = topBy(
    [...byShop.entries()].map(([name, spent]) => ({ name, spent })),
    (r) => r.spent,
    5
  );
  const items = topBy([...byItem.values()], (r) => r.spent, 6);

  // His men: days worked, and what they were handed.
  const byWorker = new Map<string, { name: string; days: number; paid: number }>();
  for (const e of all.labour) {
    if (!inThis(e.entry_date)) continue;
    const row = byWorker.get(e.worker_id) ?? {
      name: workerName.get(e.worker_id) ?? "—",
      days: 0,
      paid: 0,
    };
    if (e.kind === "work") row.days += Number(e.days);
    else row.paid += Number(e.amount);
    byWorker.set(e.worker_id, row);
  }
  const men = [...byWorker.values()].sort((a, b) => b.days - a.days);

  // "₹2,000 more than August" — a figure alone tells him nothing.
  const Change = ({ now: a, was: b }: { now: number; was: number }) => {
    const d = Math.round((a - b) * 100) / 100;
    if (b === 0 && a === 0) return null;
    if (d === 0) return <span className="text-xs text-stone-400">{t.sameAsLast}</span>;
    return (
      <span className="text-xs text-stone-500">
        {d > 0 ? "↑" : "↓"} {formatINR(Math.abs(d), 0)} {t.vsLastMonth}
      </span>
    );
  };

  const canSayLeft = now.left !== null;

  return (
    <main>
      {/* which month */}
      <div className="flex items-center justify-between gap-2">
        <Link
          href={`/month?m=${prev}`}
          aria-label={t.prevMonth}
          className="btn-secondary min-h-[44px] px-3 text-xl font-bold"
        >
          ‹
        </Link>
        <h1 className="truncate text-2xl font-extrabold">{formatMonth(firstOf(key))}</h1>
        {key < thisKey ? (
          <Link
            href={`/month?m=${nextMonth(key)}`}
            aria-label={t.nextMonth}
            className="btn-secondary min-h-[44px] px-3 text-xl font-bold"
          >
            ›
          </Link>
        ) : (
          <span className="min-h-[44px] w-[46px]" />
        )}
      </div>

      {/* what the month left him */}
      <div className="card mt-4 p-4">
        {canSayLeft ? (
          <>
            <p className="text-sm font-semibold text-stone-600">{t.leftThisMonth}</p>
            <p
              className={`tnum mt-0.5 text-3xl font-extrabold ${
                (now.left ?? 0) < 0 ? "text-red-700" : "text-green-800"
              }`}
            >
              {formatINR(now.left ?? 0, 0)}
            </p>
            {was.left !== null && (
              <p className="mt-1">
                <Change now={now.left ?? 0} was={was.left} />
              </p>
            )}
          </>
        ) : (
          <p className="text-center text-sm leading-snug text-stone-500">
            {t.profitNeedsMaterials}
          </p>
        )}

        <dl className="mt-3 space-y-2 border-t border-line pt-3 text-sm">
          {(
            [
              [t.receivedToday, now.received, was.received, "text-green-800"],
              [t.materialsUsed, now.materials, was.materials, "text-amber-700"],
              [t.labourUsed, now.labour, was.labour, "text-amber-700"],
            ] as const
          ).map(([label, a, b, tone]) => (
            <div key={label} className="flex items-baseline justify-between gap-3">
              <dt className="text-stone-600">
                {label}
                <span className="ml-2">
                  <Change now={a} was={b} />
                </span>
              </dt>
              <dd className={`tnum shrink-0 font-bold ${tone}`}>{formatINR(a, 0)}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* what he billed — kept apart from the cash on purpose */}
      <div className="card mt-3 p-4">
        <div className="flex items-baseline justify-between gap-3">
          <span className="font-semibold text-stone-600">
            {t.billedToday}
            <span className="ml-2">
              <Change now={now.billed} was={was.billed} />
            </span>
          </span>
          <span className="tnum shrink-0 text-xl font-extrabold">{formatINR(now.billed, 0)}</span>
        </div>
        <p className="mt-1 text-xs leading-snug text-stone-500">
          {now.jobs === 1 ? t.oneJob : t.jobsCount.replace("{n}", String(now.jobs))}
          {" · "}
          {t.billedNotCash}
        </p>
      </div>

      {customers.length > 0 && (
        <>
          <h2 className="eyebrow mt-6">{t.workedFor}</h2>
          <ul className="mt-2 space-y-2">
            {customers.map((c) => (
              <li key={c.name} className="card flex items-baseline justify-between gap-3 p-3">
                <span className="min-w-0">
                  <span className="block truncate font-bold">{c.name}</span>
                  <span className="text-xs text-stone-500">
                    {c.jobs === 1 ? t.oneJob : t.jobsCount.replace("{n}", String(c.jobs))}
                  </span>
                </span>
                <span className="tnum shrink-0 font-extrabold">{formatINR(c.billed, 0)}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {shops.length > 0 && (
        <>
          <h2 className="eyebrow mt-6">{t.whereItWent}</h2>
          <ul className="mt-2 space-y-2">
            {shops.map((s) => (
              <li key={s.name} className="card flex items-baseline justify-between gap-3 p-3">
                <span className="min-w-0 truncate font-bold">{s.name}</span>
                <span className="tnum shrink-0 font-extrabold text-amber-700">
                  {formatINR(s.spent, 0)}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      {items.length > 0 && (
        <>
          <h2 className="eyebrow mt-6">{t.boughtMost}</h2>
          <ul className="mt-2 space-y-2">
            {items.map((i) => (
              <li key={i.item} className="card flex items-baseline justify-between gap-3 p-3">
                <span className="min-w-0">
                  <span className="block truncate font-bold">{i.item}</span>
                  <span className="text-xs text-stone-500">
                    {i.times === 1 ? t.onceWord : t.nTimes.replace("{n}", String(i.times))}
                  </span>
                </span>
                <span className="tnum shrink-0 font-extrabold">{formatINR(i.spent, 0)}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {men.length > 0 && (
        <>
          <h2 className="eyebrow mt-6">{t.labour}</h2>
          <ul className="mt-2 space-y-2">
            {men.map((w) => (
              <li key={w.name} className="card flex items-baseline justify-between gap-3 p-3">
                <span className="min-w-0">
                  <span className="block truncate font-bold">{w.name}</span>
                  <span className="text-xs text-stone-500">
                    {t.workedDays} · {formatIndianNumber(w.days, 0)}
                  </span>
                </span>
                <span className="tnum shrink-0 font-extrabold">{formatINR(w.paid, 0)}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      <Link href="/summary" className="mt-6 block text-center text-sm font-bold text-accent">
        {t.seeTheYear} →
      </Link>
    </main>
  );
}
