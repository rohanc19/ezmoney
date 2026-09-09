import Link from "next/link";
import { notFound } from "next/navigation";
import ConfirmButton from "@/components/ConfirmButton";
import StatusPill from "@/components/StatusPill";
import { deleteClient } from "@/lib/actions";
import { getDict } from "@/lib/i18n";
import { formatDate, formatINR } from "@/lib/format";
import { averageDaysToPay, type SummaryPayment } from "@/lib/summary";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ClientLedgerPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: {
    saved?: string;
    exists?: string;
    inuse?: string;
    bills?: string;
    spent?: string;
  };
}) {
  const t = getDict();
  const supabase = supabaseServer();

  const [{ data: client }, { data: docs }, { data: expenses }] = await Promise.all([
    supabase.from("clients").select("*").eq("id", params.id).maybeSingle(),
    supabase
      .from("documents")
      .select("id, type, serial_no, doc_date, status, total, amount_received, site_job")
      .eq("client_id", params.id)
      .order("doc_date", { ascending: false }),
    supabase
      .from("expenses")
      .select("id, date, item, amount")
      .eq("client_id", params.id)
      .order("date", { ascending: false }),
  ]);
  if (!client) notFound();

  const invoices = (docs ?? []).filter((d) => d.type === "invoice");

  // How long they actually take to settle — the number that decides
  // whether to ask this one for an advance next time.
  const { data: paymentsRaw } = invoices.length
    ? await supabase
        .from("payments")
        .select("document_id, paid_on, amount")
        .in(
          "document_id",
          invoices.map((d) => d.id)
        )
    : { data: [] };
  const daysToPay = averageDaysToPay(
    invoices.map((d) => ({
      id: d.id,
      doc_date: d.doc_date,
      total: Number(d.total),
      client_id: params.id,
    })),
    (paymentsRaw ?? []) as SummaryPayment[]
  );
  const billed = invoices.reduce((s, d) => s + Number(d.total), 0);
  const received = invoices.reduce((s, d) => s + Number(d.amount_received), 0);
  const outstanding = billed - received;
  const spent = (expenses ?? []).reduce((s, e) => s + Number(e.amount), 0);

  const wa = client.phone
    ? `https://wa.me/${
        client.phone.replace(/\D/g, "").length === 10
          ? "91" + client.phone.replace(/\D/g, "")
          : client.phone.replace(/\D/g, "")
      }`
    : null;

  return (
    <main>
      <div className="mb-4 flex items-center gap-3">
        <Link href="/clients" className="btn-secondary px-3">
          ← {t.back}
        </Link>
        <h1 className="truncate text-2xl font-extrabold">{client.name}</h1>
      </div>

      {searchParams.saved && (
        <p className="mb-3 rounded-2xl bg-green-100 p-3 text-center font-bold text-green-900">
          {t.saved}
        </p>
      )}
      {searchParams.exists && (
        <p className="mb-3 rounded-2xl bg-amber-50 p-3 text-center font-semibold text-amber-900">
          {t.clientExists}
        </p>
      )}
      {searchParams.inuse && (
        <p className="mb-3 rounded-2xl bg-amber-50 p-3 text-center font-semibold text-amber-900">
          {t.clientHasBills.replace(
            "{what}",
            [
              Number(searchParams.bills) > 0
                ? Number(searchParams.bills) === 1
                  ? t.oneBillLabel
                  : t.nBills.replace("{n}", String(searchParams.bills))
                : "",
              Number(searchParams.spent) > 0
                ? Number(searchParams.spent) === 1
                  ? t.oneExpenseLabel
                  : t.nExpenses.replace("{n}", String(searchParams.spent))
                : "",
            ]
              .filter(Boolean)
              .join(" + ")
          )}
        </p>
      )}

      {/* who they are */}
      <div className="card p-4">
        {client.address && <p className="text-stone-700">{client.address}</p>}
        {client.phone && <p className="text-stone-700">{client.phone}</p>}
        {client.gstin && <p className="text-sm text-stone-600">GSTIN: {client.gstin}</p>}
        {client.state_name && <p className="text-sm text-stone-500">{client.state_name}</p>}
        <p className="mt-2 text-sm font-semibold text-stone-600">
          {invoices.length === 1 ? t.oneJob : t.jobsCount.replace("{n}", String(invoices.length))}
          {" · "}
          {daysToPay === null
            ? t.noPaymentsYetShort
            : t.paysInDays.replace("{n}", String(daysToPay))}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href={`/clients/${client.id}/edit`} className="btn-secondary">
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
          <p className="text-xs font-semibold text-stone-500">{t.totalBilled}</p>
          <p className="tnum mt-0.5 font-extrabold">{formatINR(billed, 0)}</p>
        </div>
        <div className="card p-3">
          <p className="text-xs font-semibold text-stone-500">{t.received}</p>
          <p className="tnum mt-0.5 font-extrabold text-green-800">{formatINR(received, 0)}</p>
        </div>
        <div className="card p-3">
          <p className="text-xs font-semibold text-stone-500">{t.outstanding}</p>
          <p
            className={`tnum mt-0.5 font-extrabold ${
              outstanding > 0 ? "text-amber-700" : "text-stone-800"
            }`}
          >
            {formatINR(outstanding, 0)}
          </p>
        </div>
      </div>

      {/* every bill */}
      <h2 className="eyebrow mt-7">{t.jobsFor}</h2>
      {(docs ?? []).length === 0 ? (
        <p className="card mt-3 p-6 text-center text-stone-600">{t.noDocsYet}</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {(docs ?? []).map((d) => (
            <li key={d.id}>
              <Link href={`/documents/${d.id}`} className="card block p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-extrabold">{d.serial_no}</span>
                  <StatusPill status={d.status} label={t.statusLabels[d.status]} size="sm" />
                </div>
                {d.site_job && <p className="mt-1 truncate text-stone-700">{d.site_job}</p>}
                <div className="mt-1 flex items-center justify-between text-sm text-stone-500">
                  <span>{formatDate(d.doc_date)}</span>
                  <span className="tnum text-lg font-extrabold text-ink">
                    {formatINR(Number(d.total), 0)}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {/* what he spent on them */}
      {(expenses ?? []).length > 0 && (
        <>
          <h2 className="eyebrow mt-7">
            {t.spentOn} · {formatINR(spent, 0)}
          </h2>
          <ul className="mt-3 space-y-2">
            {(expenses ?? []).map((e) => (
              <li key={e.id}>
                <Link
                  href={`/expenses/${e.id}/edit`}
                  className="card flex items-center justify-between gap-3 p-3"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{e.item}</span>
                    <span className="text-sm text-stone-500">{formatDate(e.date)}</span>
                  </span>
                  <span className="tnum shrink-0 font-bold">{formatINR(Number(e.amount), 0)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
      {/* Only possible while nothing points at them — see deleteClient. */}
      <form action={deleteClient} className="mt-8">
        <input type="hidden" name="id" value={client.id} />
        <ConfirmButton message={t.confirmDeleteClient} className="btn-danger w-full">
          {t.deleteClient}
        </ConfirmButton>
      </form>
    </main>
  );
}
