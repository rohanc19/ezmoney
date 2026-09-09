import Link from "next/link";
import { notFound } from "next/navigation";
import ConfirmButton from "@/components/ConfirmButton";
import { deleteWorker, deleteWorkerEntry, saveWorkerEntry } from "@/lib/actions";
import { formatDate, formatINR, todayISO } from "@/lib/format";
import { getDict } from "@/lib/i18n";
import { supabaseServer } from "@/lib/supabase/server";
import { PAID_VIA, type WorkerEntry } from "@/lib/types";

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
  searchParams: { saved?: string };
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
            ? ` · ${formatINR(Number(worker.daily_rate), 0)} / ${t.days.toLowerCase()}`
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

      {/* ---- add a work day ---- */}
      <details className="card mt-4 p-4">
        <summary className="min-h-[44px] cursor-pointer list-none font-extrabold text-accent-dark">
          + {t.addWork}
        </summary>
        <form action={saveWorkerEntry} className="mt-4 space-y-4">
          <input type="hidden" name="worker_id" value={worker.id} />
          <input type="hidden" name="kind" value="work" />
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="label" htmlFor="w_date">
                {t.date}
              </label>
              <input id="w_date" type="date" name="entry_date" defaultValue={today} className="field" />
            </div>
            <div className="w-24">
              <label className="label" htmlFor="w_days">
                {t.days}
              </label>
              <input
                id="w_days"
                name="days"
                inputMode="decimal"
                defaultValue="1"
                className="field tnum px-2"
              />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="w_rate">
              {t.dailyWage}
            </label>
            <input
              id="w_rate"
              name="rate"
              inputMode="decimal"
              defaultValue={Number(worker.daily_rate) > 0 ? String(worker.daily_rate) : ""}
              className="field tnum"
            />
          </div>
          <div>
            <label className="label" htmlFor="w_amount">
              {t.orFixedAmount}
            </label>
            <input id="w_amount" name="amount" inputMode="decimal" className="field tnum" />
          </div>
          <div>
            <label className="label" htmlFor="w_site">
              {t.siteJob}
            </label>
            <input id="w_site" name="site_job" className="field" />
          </div>
          <div>
            <label className="label" htmlFor="w_client">
              {t.forClient}
            </label>
            <select id="w_client" name="client_id" className="field">
              <option value="">—</option>
              {(clients ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn-primary w-full">
            {t.save}
          </button>
        </form>
      </details>

      {/* ---- pay money ---- */}
      <details className="card mt-3 p-4">
        <summary className="min-h-[44px] cursor-pointer list-none font-extrabold text-accent-dark">
          + {t.addPayment}
        </summary>
        <form action={saveWorkerEntry} className="mt-4 space-y-4">
          <input type="hidden" name="worker_id" value={worker.id} />
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="label" htmlFor="p_date">
                {t.date}
              </label>
              <input id="p_date" type="date" name="entry_date" defaultValue={today} className="field" />
            </div>
            <div className="flex-1">
              <label className="label" htmlFor="p_amount">
                {t.amount} (₹)
              </label>
              <input
                id="p_amount"
                name="amount"
                inputMode="decimal"
                required
                className="field tnum"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="label" htmlFor="p_kind">
                {t.category}
              </label>
              <select id="p_kind" name="kind" defaultValue="payment" className="field">
                <option value="payment">{t.payment}</option>
                <option value="advance">{t.advance}</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="label" htmlFor="p_via">
                {t.paidVia}
              </label>
              <select id="p_via" name="paid_via" className="field">
                {PAID_VIA.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label" htmlFor="p_notes">
              {t.notes}
            </label>
            <input id="p_notes" name="notes" className="field" />
          </div>
          <button type="submit" className="btn-primary w-full">
            {t.save}
          </button>
        </form>
      </details>

      <p className="mt-2 text-center text-xs text-stone-500">{t.labourCountedNote}</p>

      {/* ---- the book ---- */}
      <h2 className="eyebrow mt-7">{t.workerBook}</h2>
      {entries.length === 0 ? (
        <p className="card mt-3 p-6 text-center text-stone-600">{t.noEntriesYet}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {entries.map((e) => {
            const isWork = e.kind === "work";
            return (
              <li key={e.id} className="card p-3">
                <div className="flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${
                        isWork
                          ? "bg-stone-100 text-stone-700"
                          : e.kind === "advance"
                            ? "bg-amber-100 text-amber-900"
                            : "bg-green-100 text-green-900"
                      }`}
                    >
                      {kindLabel[e.kind]}
                    </span>
                    <span className="mt-1 block text-sm text-stone-500">
                      {formatDate(e.entry_date)}
                      {isWork && Number(e.days) > 0
                        ? ` · ${e.days} ${t.days.toLowerCase()} × ${formatINR(Number(e.rate), 0)}`
                        : ""}
                      {!isWork ? ` · ${e.paid_via}` : ""}
                    </span>
                    {(e.site_job || e.clients?.name) && (
                      <span className="block truncate text-sm text-stone-600">
                        {[e.clients?.name, e.site_job].filter(Boolean).join(" · ")}
                      </span>
                    )}
                    {e.notes && <span className="block text-sm text-stone-500">{e.notes}</span>}
                  </span>
                  <span className="shrink-0 text-right">
                    <span
                      className={`tnum block font-extrabold ${
                        isWork ? "text-ink" : "text-green-800"
                      }`}
                    >
                      {isWork ? "" : "− "}
                      {formatINR(Number(e.amount), 0)}
                    </span>
                    <form action={deleteWorkerEntry}>
                      <input type="hidden" name="id" value={e.id} />
                      <input type="hidden" name="worker_id" value={worker.id} />
                      <ConfirmButton
                        message={t.confirmDeleteEntry}
                        className="mt-1 min-h-[36px] rounded-lg px-2 text-xs font-semibold text-red-700"
                      >
                        × {t.delete}
                      </ConfirmButton>
                    </form>
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <form action={deleteWorker} className="mt-8">
        <input type="hidden" name="id" value={worker.id} />
        <ConfirmButton message={t.confirmDeleteWorker} className="btn-danger w-full">
          {t.delete}
        </ConfirmButton>
      </form>
    </main>
  );
}
