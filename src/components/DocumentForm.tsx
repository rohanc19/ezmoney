"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatINR } from "@/lib/format";
import type { Dict } from "@/lib/i18n";
import { UNITS } from "@/lib/types";

interface ItemState {
  description: string;
  qty: string;
  unit: string;
  rate: string;
}

interface Props {
  action: (formData: FormData) => Promise<void>;
  id?: string;
  type: "estimate" | "invoice";
  initial: {
    doc_date: string;
    client_id: string;
    site_job: string;
    notes: string;
    status: string;
  };
  initialItems: ItemState[];
  clients: { id: string; name: string }[];
  gstEnabled: boolean;
  gstRate: number;
  recentDescriptions: string[];
  t: Dict;
}

const emptyItem = (): ItemState => ({ description: "", qty: "1", unit: "Nos", rate: "" });

export default function DocumentForm({
  action,
  id,
  type,
  initial,
  initialItems,
  clients,
  gstEnabled,
  gstRate,
  recentDescriptions,
  t,
}: Props) {
  const draftKey = `ezmoney-draft-${id ?? "new-" + type}`;
  const [items, setItems] = useState<ItemState[]>(
    initialItems.length > 0 ? initialItems : [emptyItem()]
  );
  const [clientId, setClientId] = useState(initial.client_id);
  const [docDate, setDocDate] = useState(initial.doc_date);
  const [siteJob, setSiteJob] = useState(initial.site_job);
  const [notes, setNotes] = useState(initial.notes);
  const [status, setStatus] = useState(initial.status);
  const [newClient, setNewClient] = useState({ name: "", phone: "", address: "" });
  const [restored, setRestored] = useState(false);
  const [saving, setSaving] = useState(false);
  const loaded = useRef(false);

  // ---- draft auto-save (new documents only): nothing gets lost ----
  useEffect(() => {
    if (id) {
      loaded.current = true;
      return;
    }
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        const d = JSON.parse(raw);
        if (Array.isArray(d.items) && d.items.length > 0) setItems(d.items);
        if (d.clientId) setClientId(d.clientId);
        if (d.siteJob) setSiteJob(d.siteJob);
        if (d.notes) setNotes(d.notes);
        if (d.newClient) setNewClient(d.newClient);
        if (d.siteJob || (d.items ?? []).some((i: ItemState) => i.description)) setRestored(true);
      }
    } catch {
      /* draft is a convenience — ignore problems */
    }
    loaded.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!loaded.current || id) return;
    try {
      localStorage.setItem(draftKey, JSON.stringify({ items, clientId, siteJob, notes, newClient }));
    } catch {
      /* ignore */
    }
  }, [items, clientId, siteJob, notes, newClient, draftKey, id]);

  // ---- live totals ----
  const subtotal = useMemo(
    () => items.reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.rate) || 0), 0),
    [items]
  );
  const gstAmount = gstEnabled ? subtotal * gstRate : 0;
  const total = subtotal + gstAmount;

  const itemsJson = JSON.stringify(
    items
      .filter((i) => i.description.trim())
      .map((i) => ({
        description: i.description.trim(),
        qty: Number(i.qty) || 0,
        unit: i.unit,
        rate: Number(i.rate) || 0,
      }))
  );

  const update = (idx: number, patch: Partial<ItemState>) =>
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

  const statusOptions =
    type === "estimate" ? ["draft", "sent", "approved", "rejected"] : ["draft", "sent", "paid"];

  return (
    <form
      action={action}
      onSubmit={() => {
        setSaving(true);
        try {
          localStorage.removeItem(draftKey);
        } catch {
          /* ignore */
        }
      }}
      className="space-y-5"
    >
      {id && <input type="hidden" name="id" value={id} />}
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="items_json" value={itemsJson} />

      {restored && (
        <p className="rounded-xl bg-amber-50 p-3 text-center font-medium text-amber-900">
          {t.draftRestored}
        </p>
      )}

      {/* client */}
      <div>
        <label htmlFor="client_id" className="label">
          {t.client}
        </label>
        <select
          id="client_id"
          name="client_id"
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          className="field"
        >
          <option value="">{t.chooseClient}</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
          <option value="__new">{t.addNewClient}</option>
        </select>
        {clientId === "__new" && (
          <div className="mt-3 space-y-3 rounded-xl bg-white p-4 shadow-sm">
            <input
              name="new_client_name"
              value={newClient.name}
              onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
              placeholder={t.clientName}
              required
              className="field"
            />
            <input
              name="new_client_phone"
              value={newClient.phone}
              onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
              placeholder={t.clientPhone}
              inputMode="tel"
              className="field"
            />
            <input
              name="new_client_address"
              value={newClient.address}
              onChange={(e) => setNewClient({ ...newClient, address: e.target.value })}
              placeholder={t.clientAddress}
              className="field"
            />
          </div>
        )}
      </div>

      {/* date + site */}
      <div>
        <label htmlFor="doc_date" className="label">
          {t.date}
        </label>
        <input
          id="doc_date"
          type="date"
          name="doc_date"
          value={docDate}
          onChange={(e) => setDocDate(e.target.value)}
          className="field"
        />
      </div>
      <div>
        <label htmlFor="site_job" className="label">
          {t.siteJob}
        </label>
        <input
          id="site_job"
          name="site_job"
          value={siteJob}
          onChange={(e) => setSiteJob(e.target.value)}
          className="field"
        />
      </div>

      {/* line items */}
      <div>
        <p className="label">{t.items}</p>
        <datalist id="recent-descriptions">
          {recentDescriptions.map((d) => (
            <option key={d} value={d} />
          ))}
        </datalist>
        <div className="space-y-3">
          {items.map((item, idx) => (
            <div key={idx} className="rounded-xl bg-white p-3 shadow-sm">
              <input
                value={item.description}
                onChange={(e) => update(idx, { description: e.target.value })}
                placeholder={t.description}
                list="recent-descriptions"
                className="field"
              />
              <div className="mt-2 flex gap-2">
                <div className="w-20">
                  <label className="mb-0.5 block text-xs text-stone-500">{t.qty}</label>
                  <input
                    value={item.qty}
                    onChange={(e) => update(idx, { qty: e.target.value })}
                    inputMode="decimal"
                    className="field px-2"
                  />
                </div>
                <div className="w-24">
                  <label className="mb-0.5 block text-xs text-stone-500">{t.unit}</label>
                  <select
                    value={item.unit}
                    onChange={(e) => update(idx, { unit: e.target.value })}
                    className="field px-2"
                  >
                    {UNITS.map((u) => (
                      <option key={u}>{u}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="mb-0.5 block text-xs text-stone-500">{t.rate} (₹)</label>
                  <input
                    value={item.rate}
                    onChange={(e) => update(idx, { rate: e.target.value })}
                    inputMode="decimal"
                    className="field px-2"
                  />
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
                  className="min-h-[44px] rounded-lg px-3 text-sm font-medium text-red-700 active:bg-red-50"
                >
                  ✕ {t.delete}
                </button>
                <span className="font-semibold">
                  {formatINR((Number(item.qty) || 0) * (Number(item.rate) || 0))}
                </span>
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setItems((prev) => [...prev, emptyItem()])}
          className="btn-secondary mt-3 w-full"
        >
          ＋ {t.addItem}
        </button>
      </div>

      {/* totals */}
      <div className="rounded-xl bg-white p-4 shadow-sm">
        <div className="flex justify-between text-stone-600">
          <span>{t.subtotal}</span>
          <span>{formatINR(subtotal)}</span>
        </div>
        {gstEnabled && (
          <div className="mt-1 flex justify-between text-stone-600">
            <span>
              {t.gst} ({(gstRate * 100).toFixed(0)}%)
            </span>
            <span>{formatINR(gstAmount)}</span>
          </div>
        )}
        <div className="mt-2 flex justify-between border-t border-stone-200 pt-2 text-xl font-bold">
          <span>{t.total}</span>
          <span>{formatINR(total)}</span>
        </div>
      </div>

      {/* status + notes */}
      <div>
        <label htmlFor="status" className="label">
          {t.status}
        </label>
        <select
          id="status"
          name="status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="field"
        >
          {statusOptions.map((s) => (
            <option key={s} value={s}>
              {t.statusLabels[s]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="notes" className="label">
          {t.notes}
        </label>
        <textarea
          id="notes"
          name="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="field"
        />
      </div>

      <button type="submit" disabled={saving} className="btn-primary w-full text-xl disabled:opacity-60">
        {saving ? "…" : t.save}
      </button>
    </form>
  );
}
