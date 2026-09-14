import Link from "next/link";
import { notFound } from "next/navigation";
import ConfirmButton from "@/components/ConfirmButton";
import PrintButton from "@/components/PrintButton";
import {
  addChecklistItem,
  deleteChecklist,
  deleteChecklistItem,
  saveChecklist,
} from "@/lib/actions";
import { formatDate, todayISO } from "@/lib/format";
import { getDict } from "@/lib/i18n";
import { supabaseServer } from "@/lib/supabase/server";
import { UNITS, type ChecklistItem } from "@/lib/types";

export const dynamic = "force-dynamic";

// Fill the quantities in, tick anything the client is buying himself, and
// print. The printed half is the shop's copy: only what he actually wants,
// with a box to tick beside each line and the client's items called out so
// the shop knows not to supply them.

export default async function ChecklistPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { saved?: string };
}) {
  const t = getDict();
  const supabase = supabaseServer();

  const [{ data: list }, { data: itemsRaw }, { data: clients }, { data: profile }] =
    await Promise.all([
      supabase
        .from("checklists")
        .select("*, clients(name)")
        .eq("id", params.id)
        .maybeSingle(),
      supabase
        .from("checklist_items")
        .select("*")
        .eq("checklist_id", params.id)
        .order("position"),
      supabase.from("clients").select("id, name").order("name"),
      supabase.from("business_profile").select("business_name, phone, logo_url").maybeSingle(),
    ]);
  if (!list) notFound();

  const items = (itemsRaw ?? []) as ChecklistItem[];
  const wanted = items.filter((i) => Number(i.qty) > 0);
  const fromShop = wanted.filter((i) => !i.by_client);
  const client = (list.clients as { name: string } | null) ?? null;

  return (
    <main>
      <div className="no-print">
        <div className="mb-4 flex items-center gap-3">
          <Link href="/checklists" className="btn-secondary px-3">
            ← {t.back}
          </Link>
          <h1 className="truncate text-xl font-extrabold">{list.name}</h1>
        </div>

        {searchParams.saved && (
          <p className="mb-3 rounded-2xl bg-green-100 p-3 text-center font-bold text-green-900">
            {t.saved}
          </p>
        )}

        <PrintButton label={t.printList} />

        {/* ---- who and where ---- */}
        <form action={saveChecklist} className="mt-4 space-y-4">
          <input type="hidden" name="id" value={list.id} />

          <div>
            <label className="label" htmlFor="name">
              {t.listName}
            </label>
            <input id="name" name="name" defaultValue={list.name} className="field" />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="label" htmlFor="client_id">
                {t.client}
              </label>
              <select
                id="client_id"
                name="client_id"
                defaultValue={list.client_id ?? ""}
                className="field"
              >
                <option value="">—</option>
                {(clients ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-40">
              <label className="label" htmlFor="list_date">
                {t.date}
              </label>
              <input
                id="list_date"
                type="date"
                name="list_date"
                defaultValue={list.list_date ?? todayISO()}
                className="field"
              />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="site_job">
              {t.siteJob}
            </label>
            <input id="site_job" name="site_job" defaultValue={list.site_job} className="field" />
          </div>

          {/* ---- the items: a quantity each, and who buys it ---- */}
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-paper text-left">
                  <th className="px-3 py-2 font-bold">{t.description}</th>
                  <th className="w-20 px-1 py-2 text-center font-bold">{t.quantity}</th>
                  <th className="w-16 px-2 py-2 text-center font-bold">{t.clientBuysShort}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.id} className="border-b border-line">
                    <td className="px-3 py-2">
                      <span className="block font-semibold leading-snug">{i.description}</span>
                      <span className="text-xs text-stone-500">{i.unit}</span>
                    </td>
                    <td className="px-1 py-2">
                      <input
                        name={`qty_${i.id}`}
                        defaultValue={Number(i.qty) > 0 ? String(i.qty) : ""}
                        inputMode="decimal"
                        placeholder="0"
                        aria-label={`${t.quantity} ${i.description}`}
                        className="field tnum min-h-[44px] px-2 text-center"
                      />
                    </td>
                    <td className="px-2 py-2 text-center">
                      <input
                        type="checkbox"
                        name={`client_${i.id}`}
                        defaultChecked={i.by_client}
                        aria-label={`${t.clientBuys} ${i.description}`}
                        className="h-6 w-6 accent-teal-700"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <label className="label" htmlFor="notes">
              {t.notes}
            </label>
            <input id="notes" name="notes" defaultValue={list.notes} className="field" />
          </div>

          <button type="submit" className="btn-primary w-full text-xl">
            {t.save}
          </button>
        </form>

        {/* ---- odds and ends the template never knew about ---- */}
        <details className="card mt-4 p-3">
          <summary className="min-h-[44px] cursor-pointer list-none px-1 font-semibold text-accent-dark">
            + {t.addOneOff}
          </summary>
          <form action={addChecklistItem} className="mt-3 space-y-3">
            <input type="hidden" name="checklist_id" value={list.id} />
            <input name="description" placeholder={t.description} required className="field" />
            <div className="flex gap-3">
              <div className="w-24">
                <label className="label" htmlFor="new_qty">
                  {t.quantity}
                </label>
                <input id="new_qty" name="qty" inputMode="decimal" className="field tnum px-2" />
              </div>
              <div className="flex-1">
                <label className="label" htmlFor="new_unit">
                  {t.unit}
                </label>
                <select id="new_unit" name="unit" className="field">
                  {UNITS.map((u) => (
                    <option key={u}>{u}</option>
                  ))}
                </select>
              </div>
            </div>
            <button type="submit" className="btn-secondary w-full">
              {t.save}
            </button>
          </form>
        </details>

        {/* removing a line the template carried but he never wants */}
        {items.length > 0 && (
          <details className="card mt-2 p-3">
            <summary className="min-h-[44px] cursor-pointer list-none px-1 font-semibold text-stone-600">
              {t.more}
            </summary>
            <ul className="mt-2 divide-y divide-line">
              {items.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-2 py-1.5">
                  <span className="min-w-0 truncate text-sm">{i.description}</span>
                  <form action={deleteChecklistItem}>
                    <input type="hidden" name="id" value={i.id} />
                    <input type="hidden" name="checklist_id" value={list.id} />
                    <ConfirmButton
                      message={t.confirmDeleteListItem}
                      confirmLabel={t.tapAgain}
                      className="min-h-[36px] rounded px-2 text-xs font-semibold text-red-700"
                    >
                      ✕
                    </ConfirmButton>
                  </form>
                </li>
              ))}
            </ul>
            <form action={deleteChecklist} className="mt-3">
              <input type="hidden" name="id" value={list.id} />
              <ConfirmButton
                message={t.confirmDeleteList}
                confirmLabel={t.tapAgain}
                className="btn-danger w-full"
              >
                {t.delete}
              </ConfirmButton>
            </form>
          </details>
        )}
      </div>

      {/* ---------- the shop's copy ---------- */}
      <div className="doc mt-6">
        <p className="doc-title">{list.name}</p>

        <div className="doc-head">
          <div className="doc-cell">
            <p className="text-lg font-extrabold leading-tight">{profile?.business_name}</p>
            {profile?.phone && <p className="text-[0.8rem] text-stone-600">{profile.phone}</p>}
          </div>
          <div className="doc-cell">
            <p className="doc-kv">
              <span>Date</span>
              <span className="tnum">{formatDate(list.list_date)}</span>
            </p>
            {client?.name && (
              <p className="doc-kv">
                <span>For</span>
                <span>{client.name}</span>
              </p>
            )}
            {list.site_job && (
              <p className="doc-kv">
                <span>Site</span>
                <span>{list.site_job}</span>
              </p>
            )}
          </div>
        </div>

        {wanted.length === 0 ? (
          <p className="p-6 text-center text-stone-500">{t.nothingWanted}</p>
        ) : (
          <table className="doc-table">
            <thead>
              <tr>
                <th className="w-8">✓</th>
                <th className="w-9">Sr</th>
                <th>Item</th>
                <th className="doc-num">Qty</th>
                <th>Unit</th>
              </tr>
            </thead>
            <tbody>
              {wanted.map((i, n) => (
                <tr key={i.id}>
                  {/* a box for the shop to tick as they pick it off the shelf */}
                  <td className="text-center">{i.by_client ? "—" : "☐"}</td>
                  <td className="tnum">{n + 1}</td>
                  <td>
                    {i.description}
                    {i.by_client && (
                      <span className="ml-2 rounded border border-[color:var(--doc-ink)] px-1 text-[0.6rem] font-extrabold">
                        {t.clientBuysShort}
                      </span>
                    )}
                  </td>
                  <td className="doc-num">{Number(i.qty)}</td>
                  <td>{i.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="doc-cell border-t border-[color:var(--doc-ink)]">
          <p className="text-[0.78rem] text-stone-600">
            {t.itemsWanted.replace("{n}", String(fromShop.length))}
            {wanted.length > fromShop.length ? ` · ${t.clientBuysNote}` : ""}
          </p>
          {list.notes && <p className="mt-1 text-[0.78rem] text-stone-700">{list.notes}</p>}
        </div>
      </div>
    </main>
  );
}
