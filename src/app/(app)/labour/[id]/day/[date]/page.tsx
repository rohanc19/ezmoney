import Link from "next/link";
import { notFound } from "next/navigation";
import ConfirmButton from "@/components/ConfirmButton";
import {
  deleteWorkerEntry,
  markWorkedThisDay,
  saveWorkerEntry,
} from "@/lib/actions";
import { formatDate, formatINR, mondayOf } from "@/lib/format";
import { getDict } from "@/lib/i18n";
import { supabaseServer } from "@/lib/supabase/server";
import { PAID_VIA, type WorkerEntry } from "@/lib/types";

export const dynamic = "force-dynamic";

// One man, one day. Where he worked, what he took as an advance, and what
// he was paid — the three things worth knowing about a day on site.

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
  if (!worker || !/^\d{4}-\d{2}-\d{2}$/.test(date)) notFound();

  const rows = (rowsRaw ?? []) as unknown as WorkerEntry[];
  const work = rows.filter((r) => r.kind === "work");
  const advances = rows.filter((r) => r.kind === "advance");
  const payments = rows.filter((r) => r.kind === "payment");

  const earned = work.reduce((s, r) => s + Number(r.amount), 0);
  const advance = advances.reduce((s, r) => s + Number(r.amount), 0);
  const paid = payments.reduce((s, r) => s + Number(r.amount), 0);

  const here = `/labour/${worker.id}/day/${date}`;
  const backToWeek = `/labour/${worker.id}?week=${mondayOf(date)}`;

  /** Every entry on this page returns here when it is saved or removed. */
  const Hidden = ({ kind }: { kind?: string }) => (
    <>
      <input type="hidden" name="worker_id" value={worker.id} />
      <input type="hidden" name="entry_date" value={date} />
      <input type="hidden" name="return_to" value={here} />
      {kind && <input type="hidden" name="kind" value={kind} />}
    </>
  );

  const Rows = ({ list, tone }: { list: WorkerEntry[]; tone: string }) =>
    list.length === 0 ? null : (
      <ul className="mb-2 divide-y divide-line border-b border-line">
        {list.map((r) => (
          <li key={r.id} className="flex items-start justify-between gap-3 py-2">
            <span className="min-w-0">
              <span className={`tnum block font-bold ${tone}`}>
                {formatINR(Number(r.amount), 0)}
              </span>
              <span className="block text-xs text-stone-500">
                {r.kind === "work" && Number(r.days) > 0
                  ? `${Number(r.days) === 1 ? t.oneDay : `${r.days} ${t.days.toLowerCase()}`} × ${formatINR(Number(r.rate), 0)}`
                  : r.paid_via}
                {r.notes ? ` · ${r.notes}` : ""}
              </span>
              {(r.site_job || r.clients?.name) && (
                <span className="block truncate text-sm text-stone-700">
                  {[r.clients?.name, r.site_job].filter(Boolean).join(" · ")}
                </span>
              )}
            </span>
            <form action={deleteWorkerEntry} className="shrink-0">
              <input type="hidden" name="id" value={r.id} />
              <input type="hidden" name="worker_id" value={worker.id} />
              <input type="hidden" name="return_to" value={here} />
              <ConfirmButton
                message={t.confirmDeleteEntry}
                confirmLabel={t.tapAgain}
                className="min-h-[36px] rounded-lg px-2 text-xs font-semibold text-red-700"
              >
                ✕ {t.delete}
              </ConfirmButton>
            </form>
          </li>
        ))}
      </ul>
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

      {/* what the day comes to */}
      <div className="grid grid-cols-3 gap-2">
        <div className="card p-3">
          <p className="text-xs font-semibold text-stone-500">{t.dayEarned}</p>
          <p className="tnum mt-0.5 font-extrabold">{formatINR(earned, 0)}</p>
        </div>
        <div className="card p-3">
          <p className="text-xs font-semibold text-stone-500">{t.advance}</p>
          <p className="tnum mt-0.5 font-extrabold text-amber-700">{formatINR(advance, 0)}</p>
        </div>
        <div className="card p-3">
          <p className="text-xs font-semibold text-stone-500">{t.paidOut}</p>
          <p className="tnum mt-0.5 font-extrabold text-green-800">{formatINR(paid, 0)}</p>
        </div>
      </div>

      {/* ---- the work ---- */}
      <section className="card mt-4 p-4">
        <h2 className="eyebrow">{t.workDone}</h2>
        <Rows list={work} tone="text-ink" />

        <form action={markWorkedThisDay} className="mt-2 space-y-2">
          <input type="hidden" name="worker_id" value={worker.id} />
          <input type="hidden" name="day" value={date} />
          <input type="hidden" name="return_to" value={here} />
          <input
            name="site_job"
            placeholder={t.whereWorked}
            className="field text-sm"
          />
          <button type="submit" className="btn-primary w-full">
            + {t.workedThisDay}
          </button>
        </form>

        <details className="mt-2">
          <summary className="min-h-[40px] cursor-pointer list-none text-center text-sm font-semibold text-accent underline">
            {t.otherAmount}
          </summary>
          <form action={saveWorkerEntry} className="mt-3 space-y-3">
            <Hidden kind="work" />
            <div className="flex gap-3">
              <div className="w-24">
                <label className="label" htmlFor="d_days">
                  {t.days}
                </label>
                <input id="d_days" name="days" inputMode="decimal" defaultValue="1" className="field tnum px-2" />
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
      </section>

      {/* ---- advance and payment ---- */}
      {(
        [
          ["advance", t.advance, t.addAdvance, advances, "text-amber-700"],
          ["payment", t.payment, t.addPayment, payments, "text-green-800"],
        ] as const
      ).map(([kind, heading, addLabel, list, tone]) => (
        <section key={kind} className="card mt-3 p-4">
          <h2 className="eyebrow">{heading}</h2>
          <Rows list={list} tone={tone} />
          <details>
            <summary className="min-h-[44px] cursor-pointer list-none font-extrabold text-accent-dark">
              + {addLabel}
            </summary>
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
          </details>
        </section>
      ))}

      {rows.length === 0 && (
        <p className="mt-4 text-center text-sm text-stone-500">{t.nothingThisDay}</p>
      )}
    </main>
  );
}
