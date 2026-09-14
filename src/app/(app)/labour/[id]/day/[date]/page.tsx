import Link from "next/link";
import { notFound } from "next/navigation";
import ConfirmButton from "@/components/ConfirmButton";
import { deleteWorkerEntry, markWorkedThisDay, saveWorkerEntry } from "@/lib/actions";
import { formatDate, formatINR, mondayOf } from "@/lib/format";
import { getDict } from "@/lib/i18n";
import { supabaseServer } from "@/lib/supabase/server";
import { PAID_VIA, type WorkerEntry } from "@/lib/types";

export const dynamic = "force-dynamic";

// One man, one day, one table. Every record for the day in the order it
// happened — what it was, where, and how much — because three separate
// card sections for work, advances and payments read as three screens
// stacked rather than one day.

export default async function WorkerDayPage({
  params,
  searchParams,
}: {
  params: { id: string; date: string };
  searchParams: { saved?: string };
}) {
  const t = getDict();
  const supabase = supabaseServer();
  const date = params.date;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) notFound();

  const [{ data: worker }, { data: rowsRaw }, { data: clients }] = await Promise.all([
    supabase.from("workers").select("*").eq("id", params.id).maybeSingle(),
    supabase
      .from("worker_entries")
      .select("*, clients(name)")
      .eq("worker_id", params.id)
      .eq("entry_date", date)
      .order("created_at"),
    supabase.from("clients").select("id, name").order("name"),
  ]);
  if (!worker) notFound();

  const rows = (rowsRaw ?? []) as unknown as WorkerEntry[];
  const sum = (kind: string) =>
    rows.filter((r) => r.kind === kind).reduce((s, r) => s + Number(r.amount), 0);
  const earned = sum("work");
  const advance = sum("advance");
  const paid = sum("payment");

  const here = `/labour/${worker.id}/day/${date}`;
  const backToWeek = `/labour/${worker.id}?week=${mondayOf(date)}`;

  const kindLabel: Record<string, string> = {
    work: t.workDone,
    advance: t.advance,
    payment: t.payment,
  };
  const kindTone: Record<string, string> = {
    work: "bg-stone-100 text-stone-700",
    advance: "bg-amber-100 text-amber-900",
    payment: "bg-green-100 text-green-900",
  };

  /** Fields every form on this page needs. */
  const Hidden = ({ kind }: { kind: string }) => (
    <>
      <input type="hidden" name="worker_id" value={worker.id} />
      <input type="hidden" name="entry_date" value={date} />
      <input type="hidden" name="return_to" value={here} />
      <input type="hidden" name="kind" value={kind} />
    </>
  );

  const MoneyForm = ({ kind }: { kind: "advance" | "payment" }) => (
    <form action={saveWorkerEntry} className="mt-3 space-y-3">
      <Hidden kind={kind} />
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="label" htmlFor={`${kind}_amt`}>
            {t.amount} (₹)
          </label>
          <input
            id={`${kind}_amt`}
            name="amount"
            inputMode="decimal"
            required
            className="field tnum"
          />
        </div>
        <div className="flex-1">
          <label className="label" htmlFor={`${kind}_via`}>
            {t.paidVia}
          </label>
          <select id={`${kind}_via`} name="paid_via" className="field">
            {PAID_VIA.map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="label" htmlFor={`${kind}_notes`}>
          {t.notes}
        </label>
        <input id={`${kind}_notes`} name="notes" className="field" />
      </div>
      <button type="submit" className="btn-primary w-full">
        {t.save}
      </button>
    </form>
  );

  return (
    <main>
      <div className="mb-4 flex items-center gap-3">
        <Link href={backToWeek} className="btn-secondary px-3">
          ← {t.back}
        </Link>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-extrabold">{worker.name}</h1>
          <p className="text-sm text-stone-500">{formatDate(date)}</p>
        </div>
      </div>

      {searchParams.saved && (
        <p className="mb-3 rounded-2xl bg-green-100 p-3 text-center font-bold text-green-900">
          {t.saved}
        </p>
      )}

      {/* ---- everything that happened on this day ---- */}
      <div className="card overflow-hidden">
        {rows.length === 0 ? (
          <p className="p-6 text-center text-stone-600">{t.nothingThisDay}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-paper text-left">
                <th className="px-3 py-2 font-bold">{t.whatColumn}</th>
                <th className="px-2 py-2 font-bold">{t.detailsColumn}</th>
                <th className="px-3 py-2 text-right font-bold">{t.amount}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-line align-top">
                  <td className="px-3 py-2">
                    <span
                      className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-bold ${
                        kindTone[r.kind]
                      }`}
                    >
                      {kindLabel[r.kind]}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-stone-700">
                    {r.kind === "work" ? (
                      <>
                        {Number(r.days) > 0 &&
                          (() => {
                            // Only claim "1 day x Rs 1,200" when that is
                            // actually the amount. He often types a lump sum
                            // over the top, and a sum that does not match
                            // the figure beside it is worse than no sum.
                            const days = Number(r.days);
                            const rate = Number(r.rate);
                            const label =
                              days === 1 ? t.oneDay : `${r.days} ${t.days.toLowerCase()}`;
                            const multipliesOut =
                              rate > 0 && Math.abs(days * rate - Number(r.amount)) <= 0.5;
                            return (
                              <span className="tnum block text-xs text-stone-500">
                                {label}
                                {multipliesOut ? ` × ${formatINR(rate, 0)}` : ""}
                              </span>
                            );
                          })()}
                        <span className="block">
                          {[r.clients?.name, r.site_job].filter(Boolean).join(" · ") || "—"}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="block text-xs text-stone-500">{r.paid_via}</span>
                        <span className="block">{r.notes || "—"}</span>
                      </>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <span
                      className={`tnum block font-bold ${
                        r.kind === "work"
                          ? "text-ink"
                          : r.kind === "advance"
                            ? "text-amber-700"
                            : "text-green-800"
                      }`}
                    >
                      {formatINR(Number(r.amount), 0)}
                    </span>
                    <form action={deleteWorkerEntry}>
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="worker_id" value={worker.id} />
                      <input type="hidden" name="return_to" value={here} />
                      <ConfirmButton
                        message={t.confirmDeleteEntry}
                        confirmLabel={t.tapAgain}
                        className="mt-0.5 min-h-[32px] rounded px-1 text-[0.7rem] font-semibold text-red-700"
                      >
                        ✕
                      </ConfirmButton>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-paper">
                <td className="px-3 py-2 font-bold" colSpan={2}>
                  {t.dayTotals}
                </td>
                <td className="px-3 py-2 text-right">
                  <span className="tnum block font-extrabold">{formatINR(earned, 0)}</span>
                  {advance > 0 && (
                    <span className="tnum block text-xs font-bold text-amber-700">
                      − {formatINR(advance, 0)}
                    </span>
                  )}
                  {paid > 0 && (
                    <span className="tnum block text-xs font-bold text-green-800">
                      − {formatINR(paid, 0)}
                    </span>
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {/* ---- the common case: he worked, here ---- */}
      <form action={markWorkedThisDay} className="mt-4 space-y-2">
        <input type="hidden" name="worker_id" value={worker.id} />
        <input type="hidden" name="day" value={date} />
        <input type="hidden" name="return_to" value={here} />
        <input name="site_job" placeholder={t.whereWorked} className="field" />
        <button type="submit" className="btn-primary w-full">
          + {t.workedThisDay}
        </button>
      </form>

      {/* ---- everything else, folded away ---- */}
      <div className="mt-4 space-y-2">
        <details className="card p-3">
          <summary className="min-h-[40px] cursor-pointer list-none px-1 font-semibold text-accent-dark">
            + {t.addSomethingElse}
          </summary>
          <MoneyForm kind="advance" />
        </details>

        <details className="card p-3">
          <summary className="min-h-[40px] cursor-pointer list-none px-1 font-semibold text-accent-dark">
            + {t.addPaymentShort}
          </summary>
          <MoneyForm kind="payment" />
        </details>

        <details className="card p-3">
          <summary className="min-h-[40px] cursor-pointer list-none px-1 font-semibold text-accent-dark">
            {t.otherAmount}
          </summary>
          <form action={saveWorkerEntry} className="mt-3 space-y-3">
            <Hidden kind="work" />
            <div className="flex gap-3">
              <div className="w-24">
                <label className="label" htmlFor="d_days">
                  {t.days}
                </label>
                <input
                  id="d_days"
                  name="days"
                  inputMode="decimal"
                  defaultValue="1"
                  className="field tnum px-2"
                />
              </div>
              <div className="flex-1">
                <label className="label" htmlFor="d_rate">
                  {t.dailyWage}
                </label>
                <input
                  id="d_rate"
                  name="rate"
                  inputMode="decimal"
                  defaultValue={Number(worker.daily_rate) > 0 ? String(worker.daily_rate) : ""}
                  className="field tnum"
                />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="d_amount">
                {t.orFixedAmount}
              </label>
              <input id="d_amount" name="amount" inputMode="decimal" className="field tnum" />
            </div>
            <div>
              <label className="label" htmlFor="d_site">
                {t.whereWorked}
              </label>
              <input id="d_site" name="site_job" className="field" />
            </div>
            <div>
              <label className="label" htmlFor="d_client">
                {t.forClient}
              </label>
              <select id="d_client" name="client_id" className="field">
                <option value="">—</option>
                {(clients ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className="btn-secondary w-full">
              {t.save}
            </button>
          </form>
        </details>
      </div>
    </main>
  );
}
