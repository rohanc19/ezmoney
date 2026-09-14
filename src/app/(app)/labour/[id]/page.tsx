import Link from "next/link";
import { notFound } from "next/navigation";
import ConfirmButton from "@/components/ConfirmButton";
import { deleteWorker, payWeek } from "@/lib/actions";
import {
  addDays,
  formatDate,
  formatDayShort,
  formatINR,
  mondayOf,
  todayISO,
} from "@/lib/format";
import { getDict } from "@/lib/i18n";
import { supabaseServer } from "@/lib/supabase/server";
import type { WorkerEntry } from "@/lib/types";

export const dynamic = "force-dynamic";

function waLink(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return null;
  return `https://wa.me/${digits.length === 10 ? "91" + digits : digits}`;
}

export default async function WorkerBookPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { saved?: string; week?: string };
}) {
  const t = getDict();
  const supabase = supabaseServer();
  const today = todayISO();

  const [{ data: worker }, { data: entriesRaw }, { data: clients }] = await Promise.all([
    supabase.from("workers").select("*").eq("id", params.id).maybeSingle(),
    supabase
      .from("worker_entries")
      .select("*, clients(name)")
      .eq("worker_id", params.id)
      .order("entry_date", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase.from("clients").select("id, name").order("name"),
  ]);
  if (!worker) notFound();

  const entries = (entriesRaw ?? []) as unknown as WorkerEntry[];
  const earned = entries
    .filter((e) => e.kind === "work")
    .reduce((s, e) => s + Number(e.amount), 0);
  const paid = entries
    .filter((e) => e.kind !== "work")
    .reduce((s, e) => s + Number(e.amount), 0);
  const balance = earned - paid;

  // ---- the working week: Monday to Sunday, settled on Saturday ----
  const weekStart = mondayOf(searchParams.week || today);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const saturday = weekDays[5];

  const inWeek = entries.filter(
    (e) => e.entry_date >= weekDays[0] && e.entry_date <= weekDays[6]
  );
  const dayTotals = weekDays.map((d) => {
    const rows = inWeek.filter((e) => e.kind === "work" && e.entry_date === d);
    return {
      date: d,
      days: rows.reduce((s2, r) => s2 + Number(r.days), 0),
      amount: rows.reduce((s2, r) => s2 + Number(r.amount), 0),
      count: rows.length,
    };
  });
  const weekEarned = dayTotals.reduce((s2, d) => s2 + d.amount, 0);
  const weekDaysWorked = dayTotals.reduce((s2, d) => s2 + d.days, 0);
  const weekAdvance = inWeek
    .filter((e) => e.kind === "advance")
    .reduce((s2, e) => s2 + Number(e.amount), 0);
  const weekPaid = inWeek
    .filter((e) => e.kind === "payment")
    .reduce((s2, e) => s2 + Number(e.amount), 0);
  const weekDue = Math.round((weekEarned - weekAdvance - weekPaid) * 100) / 100;
  const hasWage = Number(worker.daily_rate) > 0;

  const wa = worker.phone ? waLink(worker.phone) : null;
  const kindLabel: Record<string, string> = {
    work: t.workDone,
    payment: t.payment,
    advance: t.advance,
  };

  return (
    <main>
      <div className="mb-4 flex items-center gap-3">
        <Link href="/labour" className="btn-secondary px-3">
          ← {t.back}
        </Link>
        <h1 className="truncate text-2xl font-extrabold">{worker.name}</h1>
      </div>

      {searchParams.saved && (
        <p className="mb-3 rounded-2xl bg-green-100 p-3 text-center font-bold text-green-900">
          {t.saved}
        </p>
      )}

      {/* who they are */}
      <div className="card p-4">
        <p className="font-semibold text-stone-700">
          {worker.skill}
          {Number(worker.daily_rate) > 0
            ? ` · ${formatINR(Number(worker.daily_rate), 0)} ${t.perDay}`
            : ""}
        </p>
        {worker.phone && <p className="text-stone-700">{worker.phone}</p>}
        {worker.address && <p className="text-sm text-stone-600">{worker.address}</p>}
        {worker.notes && <p className="mt-1 text-sm text-stone-500">{worker.notes}</p>}
        {!worker.active && (
          <p className="mt-2 inline-block rounded-full bg-stone-100 px-3 py-1 text-sm font-bold text-stone-600">
            {t.pastWorker}
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href={`/labour/${worker.id}/edit`} className="btn-secondary">
            {t.edit}
          </Link>
          {wa && (
            <a href={wa} target="_blank" rel="noopener noreferrer" className="btn-secondary">
              {t.sendOnWhatsApp}
            </a>
          )}
        </div>
      </div>

      {/* ---- the week: tap the days, settle on Saturday ---- */}
      <section className="card mt-4 p-4">
        <div className="flex items-center justify-between gap-2">
          <Link
            href={`/labour/${worker.id}?week=${addDays(weekStart, -7)}`}
            aria-label={t.prevWeek}
            className="min-h-[40px] px-2 text-xl font-bold text-stone-500"
          >
            ‹
          </Link>
          <p className="text-center text-sm font-extrabold">
            {weekStart === mondayOf(today)
              ? t.thisWeek
              : `${t.weekOf} ${formatDayShort(weekStart)}`}
            <span className="ml-1 font-semibold text-stone-500">
              {formatDayShort(weekDays[0])} – {formatDayShort(weekDays[6])}
            </span>
          </p>
          <Link
            href={`/labour/${worker.id}?week=${addDays(weekStart, 7)}`}
            aria-label={t.nextWeek}
            className="min-h-[40px] px-2 text-xl font-bold text-stone-500"
          >
            ›
          </Link>
        </div>

        {!hasWage ? (
          <p className="mt-3 text-center text-sm text-stone-500">{t.setWageFirst}</p>
        ) : (
          <>
            <div className="mt-3 grid grid-cols-7 gap-1">
              {dayTotals.map((d, i) => {
                const extras = inWeek.filter(
                  (e) => e.entry_date === d.date && e.kind !== "work"
                ).length;
                return (
                  <Link
                    key={d.date}
                    href={`/labour/${worker.id}/day/${d.date}`}
                    aria-label={`${t.openTheDay} ${formatDayShort(d.date)}`}
                    className={`flex min-h-[58px] flex-col items-center justify-center rounded-xl border-2 px-0.5 no-underline ${
                      d.days > 0
                        ? "border-accent bg-accent text-white"
                        : "border-line bg-white text-stone-500"
                    }`}
                  >
                    <span className="text-[0.62rem] font-bold uppercase">{t.daysShort[i]}</span>
                    <span className="text-[0.68rem]">{formatDayShort(d.date).split(" ")[0]}</span>
                    <span className="flex h-[0.6rem] items-center gap-0.5">
                      {d.days > 0 && (
                        <span className="tnum text-[0.6rem] font-bold">
                          {d.days === 1 ? "✓" : d.days}
                        </span>
                      )}
                      {/* a dot means money moved that day */}
                      {extras > 0 && (
                        <span
                          aria-hidden
                          className={`h-1 w-1 rounded-full ${
                            d.days > 0 ? "bg-white" : "bg-amber-500"
                          }`}
                        />
                      )}
                    </span>
                  </Link>
                );
              })}
            </div>
            <p className="mt-1.5 text-center text-xs text-stone-500">{t.openDayHint}</p>

            <dl className="mt-3 border-t border-line pt-2">
              <div className="flex justify-between py-0.5 text-sm">
                <dt className="text-stone-600">
                  {t.workedDays} · {weekDaysWorked}
                </dt>
                <dd className="tnum font-semibold">{formatINR(weekEarned, 0)}</dd>
              </div>
              {weekAdvance > 0 && (
                <div className="flex justify-between py-0.5 text-sm">
                  <dt className="text-stone-600">{t.advanceTaken}</dt>
                  <dd className="tnum font-semibold text-amber-700">
                    − {formatINR(weekAdvance, 0)}
                  </dd>
                </div>
              )}
              {weekPaid > 0 && (
                <div className="flex justify-between py-0.5 text-sm">
                  <dt className="text-stone-600">{t.paidOut}</dt>
                  <dd className="tnum font-semibold text-green-800">
                    − {formatINR(weekPaid, 0)}
                  </dd>
                </div>
              )}
              <div className="mt-1 flex justify-between border-t border-line pt-2">
                <dt className="font-bold">{t.toPaySaturday}</dt>
                <dd
                  className={`tnum text-xl font-extrabold ${
                    weekDue > 0 ? "text-amber-700" : "text-stone-800"
                  }`}
                >
                  {formatINR(weekDue, 0)}
                </dd>
              </div>
            </dl>

            {weekDue > 0 && (
              <form action={payWeek} className="mt-3">
                <input type="hidden" name="worker_id" value={worker.id} />
                <input type="hidden" name="amount" value={weekDue} />
                <input type="hidden" name="paid_on" value={saturday} />
                <input type="hidden" name="week" value={formatDate(weekStart)} />
                <button type="submit" className="btn-primary w-full">
                  {t.payNow} {formatINR(weekDue, 0)}
                </button>
              </form>
            )}
          </>
        )}
      </section>

      {/* the numbers */}
      <div className="mt-4 grid grid-cols-3 gap-2">
        <div className="card p-3">
          <p className="text-xs font-semibold text-stone-500">{t.earned}</p>
          <p className="tnum mt-0.5 font-extrabold">{formatINR(earned, 0)}</p>
        </div>
        <div className="card p-3">
          <p className="text-xs font-semibold text-stone-500">{t.paidOut}</p>
          <p className="tnum mt-0.5 font-extrabold text-green-800">{formatINR(paid, 0)}</p>
        </div>
        <div className="card p-3">
          <p className="text-xs font-semibold text-stone-500">{t.toPay}</p>
          <p
            className={`tnum mt-0.5 font-extrabold ${
              balance > 0 ? "text-amber-700" : "text-stone-800"
            }`}
          >
            {formatINR(balance, 0)}
          </p>
        </div>
      </div>

      <form action={deleteWorker} className="mt-8">
        <input type="hidden" name="id" value={worker.id} />
        <ConfirmButton message={t.confirmDeleteWorker}
                      confirmLabel={t.tapAgain} className="btn-danger w-full">
          {t.delete}
        </ConfirmButton>
      </form>
    </main>
  );
}
