"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import RatePicker from "@/components/RatePicker";
import ScanSheet from "@/components/ScanSheet";
import { formatINR } from "@/lib/format";
import type { Dict } from "@/lib/i18n";
import { matchesQuery } from "@/lib/prices";
import {
  STATES,
  UNITS,
  type PriceHint,
  type RateCardItem,
  type ScannedItem,
} from "@/lib/types";

interface ItemState {
  description: string;
  qty: string;
  unit: string;
  rate: string;
  hsn: string;
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
    service_charge_mode: string;
    service_charge_value: string;
    service_charge_label: string;
  };
  initialItems: ItemState[];
  clients: { id: string; name: string }[];
  rateCard: RateCardItem[];
  gstEnabled: boolean;
  gstRate: number;
  defaultHsn: string;
  recentDescriptions: string[];
  priceHints: PriceHint[];
  t: Dict;
}

const emptyItem = (hsn: string): ItemState => ({
  description: "",
  qty: "1",
  unit: "Nos",
  rate: "",
  hsn,
});

export default function DocumentForm({
  action,
  id,
  type,
  initial,
  initialItems,
  clients,
  rateCard,
  gstEnabled,
  gstRate,
  defaultHsn,
  recentDescriptions,
  priceHints,
  t,
}: Props) {
  const draftKey = `ezmoney-draft-${id ?? "new-" + type}`;
  const [items, setItems] = useState<ItemState[]>(
    initialItems.length > 0 ? initialItems : [emptyItem(defaultHsn)]
  );
  const [clientId, setClientId] = useState(initial.client_id);
  const [docDate, setDocDate] = useState(initial.doc_date);
  const [siteJob, setSiteJob] = useState(initial.site_job);
  const [notes, setNotes] = useState(initial.notes);
  const [status, setStatus] = useState(initial.status);
  const [scMode, setScMode] = useState(initial.service_charge_mode);
  const [scValue, setScValue] = useState(initial.service_charge_value);
  const [scLabel, setScLabel] = useState(initial.service_charge_label);
  const [newClient, setNewClient] = useState({ name: "", phone: "", address: "", state: "29" });
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
        if (d.scMode) setScMode(d.scMode);
        if (d.scValue) setScValue(d.scValue);
        if (d.scLabel) setScLabel(d.scLabel);
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
      localStorage.setItem(
        draftKey,
        JSON.stringify({ items, clientId, siteJob, notes, newClient, scMode, scValue, scLabel })
      );
    } catch {
      /* ignore */
    }
  }, [items, clientId, siteJob, notes, newClient, scMode, scValue, scLabel, draftKey, id]);

  // ---- live totals ----
  const subtotal = useMemo(
    () => items.reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.rate) || 0), 0),
    [items]
  );
  // Mirrors computeServiceCharge on the server, so the figure he sees
  // while typing is the figure that gets saved.
  const serviceCharge = useMemo(() => {
    const v = Number(scValue) || 0;
    if (scMode === "percent") return Math.round(((subtotal * v) / 100) * 100) / 100;
    if (scMode === "amount") return Math.round(v * 100) / 100;
    return 0;
  }, [scMode, scValue, subtotal]);

  const taxable = subtotal + serviceCharge;
  const gstAmount = gstEnabled ? taxable * gstRate : 0;
  const total = taxable + gstAmount;

  // What he has paid for this material before, shown under the description
  // as he types it. Matching is deliberately loose — the same wire is
  // written differently on every shop's bill.
  const findHint = (text: string): PriceHint | null => {
    if (text.trim().length < 3) return null;
    return priceHints.find((h) => matchesQuery(h.key, text)) ?? null;
  };

  const itemsJson = JSON.stringify(
    items
      .filter((i) => i.description.trim())
      .map((i) => ({
        description: i.description.trim(),
        qty: Number(i.qty) || 0,
        unit: i.unit,
        rate: Number(i.rate) || 0,
        hsn_sac: i.hsn.trim(),
      }))
  );

  const update = (idx: number, patch: Partial<ItemState>) =>
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

  /** Drop rows in, replacing a single blank starter row. */
  const appendRows = (rows: ItemState[]) =>
    setItems((prev) => {
      const base =
        prev.length === 1 && !prev[0].description.trim() && !prev[0].rate ? [] : prev;
      return [...base, ...rows];
    });

  const addFromRateCard = (item: RateCardItem) =>
    appendRows([
      {
        description: item.description,
        qty: "1",
        unit: item.unit,
        rate: String(item.rate),
        hsn: item.hsn_sac || defaultHsn,
      },
    ]);

  const addFromScan = (scanned: ScannedItem[]) =>
    appendRows(
      scanned.map((s) => ({
        description: s.description,
        qty: String(s.qty),
        unit: s.unit,
        rate: String(s.rate),
        hsn: defaultHsn,
      }))
    );

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
      className="space-y-5 pb-4"
    >
      {id && <input type="hidden" name="id" value={id} />}
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="items_json" value={itemsJson} />

      {restored && (
        <p className="rounded-2xl bg-amber-50 p-3 text-center font-semibold text-amber-900">
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
          <div className="card mt-3 space-y-3 p-4">
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
            {gstEnabled && (
              <select
                name="new_client_state"
                value={newClient.state}
                onChange={(e) => setNewClient({ ...newClient, state: e.target.value })}
                className="field"
                aria-label={t.clientState}
              >
                {STATES.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.name}
                  </option>
                ))}
              </select>
            )}
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

        <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <RatePicker items={rateCard} t={t} onPick={addFromRateCard} />
          <ScanSheet t={t} onAdd={addFromScan} />
        </div>

        <datalist id="recent-descriptions">
          {recentDescriptions.map((d) => (
            <option key={d} value={d} />
          ))}
        </datalist>

        <div className="space-y-3">
          {items.map((item, idx) => (
            <div key={idx} className="card p-3">
              <input
                value={item.description}
                onChange={(e) => update(idx, { description: e.target.value })}
                placeholder={t.description}
                list="recent-descriptions"
                className="field"
              />
              {(() => {
                const hint = findHint(item.description);
                if (!hint || hint.quotes.length === 0) return null;
                return (
                  <p className="mt-1.5 text-xs leading-snug text-stone-500">
                    <span className="font-semibold text-stone-600">{t.knownPrices}: </span>
                    {hint.quotes.map((qt, i) => (
                      <span key={qt.shop + i}>
                        {i > 0 ? " · " : ""}
                        <span className="tnum font-semibold">{formatINR(qt.rate, 0)}</span>
                        {" — "}
                        {qt.shop}
                        {qt.area ? ` (${qt.area})` : ""}
                        {qt.stale ? ` — ${t.oldPrice}` : ""}
                      </span>
                    ))}
                  </p>
                );
              })()}
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

              {gstEnabled && (
                <div className="mt-2">
                  <label className="mb-0.5 block text-xs text-stone-500">{t.hsn}</label>
                  <input
                    value={item.hsn}
                    onChange={(e) => update(idx, { hsn: e.target.value })}
                    inputMode="numeric"
                    className="field px-2"
                  />
                </div>
              )}

              <div className="mt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
                  className="min-h-[44px] rounded-xl px-3 text-sm font-semibold text-red-700 active:bg-red-50"
                >
                  ✕ {t.delete}
                </button>
                <span className="tnum font-bold">
                  {formatINR((Number(item.qty) || 0) * (Number(item.rate) || 0))}
                </span>
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setItems((prev) => [...prev, emptyItem(defaultHsn)])}
          className="btn-secondary mt-3 w-full"
        >
          ＋ {t.addItem}
        </button>
      </div>

      {/* service charge — his fee for the job, on top of the items */}
      <div>
        <p className="label">{t.serviceCharge}</p>
        <div className="card space-y-3 p-4">
          <p className="text-sm text-stone-500">{t.serviceChargeHint}</p>
          <select
            name="service_charge_mode"
            value={scMode}
            onChange={(e) => setScMode(e.target.value)}
            className="field"
            aria-label={t.serviceCharge}
          >
            <option value="none">{t.serviceChargeNone}</option>
            <option value="percent">{t.serviceChargePercent}</option>
            <option value="amount">{t.serviceChargeFixed}</option>
          </select>

          {scMode !== "none" && (
            <>
              <div>
                <label className="mb-0.5 block text-xs text-stone-500" htmlFor="sc_value">
                  {scMode === "percent" ? t.percentOfItems : `${t.amount} (₹)`}
                </label>
                <input
                  id="sc_value"
                  name="service_charge_value"
                  value={scValue}
                  onChange={(e) => setScValue(e.target.value)}
                  inputMode="decimal"
                  className="field tnum"
                />
              </div>
              <div>
                <label className="mb-0.5 block text-xs text-stone-500" htmlFor="sc_label">
                  {t.serviceChargeName}
                </label>
                <input
                  id="sc_label"
                  name="service_charge_label"
                  value={scLabel}
                  onChange={(e) => setScLabel(e.target.value)}
                  className="field"
                />
              </div>
              <div className="flex justify-between border-t border-line pt-2 font-bold">
                <span>{scLabel || t.serviceCharge}</span>
                <span className="tnum">{formatINR(serviceCharge)}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* totals */}
      <div className="card p-4">
        <div className="flex justify-between text-stone-600">
          <span>{t.subtotal}</span>
          <span className="tnum">{formatINR(subtotal)}</span>
        </div>
        {serviceCharge !== 0 && (
          <div className="mt-1 flex justify-between text-stone-600">
            <span>{scLabel || t.serviceCharge}</span>
            <span className="tnum">{formatINR(serviceCharge)}</span>
          </div>
        )}
        {gstEnabled && (
          <div className="mt-1 flex justify-between text-stone-600">
            <span>
              {t.gst} ({(gstRate * 100).toFixed(0)}%)
            </span>
            <span className="tnum">{formatINR(gstAmount)}</span>
          </div>
        )}
        <div className="mt-2 flex justify-between border-t border-line pt-2 text-xl font-extrabold">
          <span>{t.total}</span>
          <span className="tnum">{formatINR(total)}</span>
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

      <button
        type="submit"
        disabled={saving}
        className="btn-primary w-full text-xl disabled:opacity-60"
      >
        {saving ? "…" : t.save}
      </button>
    </form>
  );
}
