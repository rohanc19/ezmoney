"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import RatePicker from "@/components/RatePicker";
import ScanSheet from "@/components/ScanSheet";
import { formatDate, formatINR } from "@/lib/format";
import type { Dict } from "@/lib/i18n";
import { matchesQuery } from "@/lib/prices";
import { suggest } from "@/lib/spelling";
import type { OwnRate } from "@/lib/queries";
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
  /** Which part of the job. Empty unless he splits the bill. */
  section: string;
}

interface Props {
  action: (formData: FormData) => Promise<void>;
  id?: string;
  type: "estimate" | "invoice";
  initial: {
    doc_date: string;
    due_date: string;
    client_id: string;
    site_job: string;
    notes: string;
    status: string;
    service_charge_mode: string;
    service_charge_value: string;
    service_charge_label: string;
  };
  initialItems: ItemState[];
  /** Distinguishes drafts of different shapes for the same doc type. */
  variant?: string;
  clients: { id: string; name: string }[];
  rateCard: RateCardItem[];
  gstEnabled: boolean;
  gstRate: number;
  defaultHsn: string;
  recentDescriptions: string[];
  priceHints: PriceHint[];
  ownRates: OwnRate[];
  t: Dict;
}

const emptyItem = (hsn: string, section = ""): ItemState => ({
  description: "",
  qty: "1",
  unit: "Nos",
  rate: "",
  hsn,
  section,
});

export default function DocumentForm({
  action,
  id,
  type,
  initial,
  initialItems,
  variant,
  clients,
  rateCard,
  gstEnabled,
  gstRate,
  defaultHsn,
  recentDescriptions,
  priceHints,
  ownRates,
  t,
}: Props) {
  const draftKey = `ezmoney-draft-${id ?? "new-" + type}${variant ? `-${variant}` : ""}`;
  const [items, setItems] = useState<ItemState[]>(
    initialItems.length > 0 ? initialItems : [emptyItem(defaultHsn)]
  );
  const [clientId, setClientId] = useState(initial.client_id);
  const [docDate, setDocDate] = useState(initial.doc_date);
  // Most of his bills are settled on the spot, so the due date stays out
  // of the way until he asks for it — and shows itself on a bill that has
  // one already.
  const [dueDate, setDueDate] = useState(initial.due_date);
  const [showDue, setShowDue] = useState(Boolean(initial.due_date));
  const [siteJob, setSiteJob] = useState(initial.site_job);
  const [notes, setNotes] = useState(initial.notes);
  const [status, setStatus] = useState(initial.status);
  const [scMode, setScMode] = useState(initial.service_charge_mode);
  const [scValue, setScValue] = useState(initial.service_charge_value);
  const [scLabel, setScLabel] = useState(initial.service_charge_label);
  // Off unless this bill already has parts. Most of his cash bills are a
  // plain list and should look exactly as they always have.
  const [useParts, setUseParts] = useState(
    initialItems.some((i) => (i.section ?? "").trim().length > 0)
  );
  const [newClient, setNewClient] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    state: "29",
  });
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
        const typed = (d.items ?? []).some(
          (i: ItemState) => i.description && (Number(i.qty) || 0) > 0
        );
        if (d.siteJob || typed) setRestored(true);
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

  // What he charged for this last time — the number he is about to
  // decide again, with the previous one beside it if it has moved.
  const findOwnRate = (text: string): OwnRate | null => {
    if (text.trim().length < 3) return null;
    return ownRates.find((r) => matchesQuery(r.key, text)) ?? null;
  };

  const itemsJson = JSON.stringify(
    items
      // A point sheet lays out every rate and he fills in a handful, so
      // the rest must fall away rather than print as ₹0 lines. The shop
      // list has always worked this way.
      .filter((i) => i.description.trim() && (Number(i.qty) || 0) > 0)
      .map((i) => ({
        description: i.description.trim(),
        qty: Number(i.qty) || 0,
        unit: i.unit,
        rate: Number(i.rate) || 0,
        hsn_sac: i.hsn.trim(),
        section: useParts ? i.section.trim() : "",
      }))
  );

  /** New rows join the part the previous row was in — he types it once. */
  const lastSection = () => {
    for (let i = items.length - 1; i >= 0; i -= 1) {
      if (items[i].section.trim()) return items[i].section;
    }
    return "";
  };

  const update = (idx: number, patch: Partial<ItemState>) =>
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

  /** Drop rows in, replacing a single blank starter row. */
  const appendRows = (rows: ItemState[]) =>
    setItems((prev) => {
      const base =
        prev.length === 1 && !prev[0].description.trim() && !prev[0].rate ? [] : prev;
      return [...base, ...rows];
    });

  // He can tick several at once, so this takes a list.
  const addFromRateCard = (chosen: RateCardItem[]) =>
    appendRows(
      chosen.map((item) => ({
        description: item.description,
        qty: "1",
        unit: item.unit,
        rate: String(item.rate),
        hsn: item.hsn_sac || defaultHsn,
        section: lastSection(),
      }))
    );

  const addFromScan = (scanned: ScannedItem[]) =>
    appendRows(
      scanned.map((s) => ({
        description: s.description,
        qty: String(s.qty),
        unit: s.unit,
        rate: String(s.rate),
        hsn: defaultHsn,
        section: lastSection(),
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
      className="space-y-5 pb-20"
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
              name="new_client_email"
              type="email"
              value={newClient.email}
              onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
              placeholder={t.clientEmail}
              inputMode="email"
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
        {type === "invoice" &&
          (showDue ? (
            <div className="mt-3">
              <label htmlFor="due_date" className="label">
                {t.dueDate}
              </label>
              <input
                id="due_date"
                type="date"
                name="due_date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="field"
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowDue(true)}
              className="mt-1 min-h-[36px] text-sm font-semibold text-accent underline"
            >
              + {t.addDueDate}
            </button>
          ))}
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
        {(() => {
          const fixed = suggest(siteJob);
          if (!fixed) return null;
          return (
            <button
              type="button"
              onClick={() => setSiteJob(fixed)}
              className="mt-1.5 block min-h-[32px] text-left text-xs leading-snug text-accent"
            >
              {t.didYouMean} <span className="font-bold underline">{fixed}</span>
            </button>
          );
        })()}
      </div>

      {/* line items */}
      <div>
        <p className="label">{t.items}</p>

        <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <RatePicker items={rateCard} t={t} onPick={addFromRateCard} />
          <ScanSheet t={t} onAdd={addFromScan} />
        </div>

        <datalist id="bill-parts">
          {[...new Set(items.map((i) => i.section.trim()).filter(Boolean))].map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>

        <datalist id="recent-descriptions">
          {recentDescriptions.map((d) => (
            <option key={d} value={d} />
          ))}
        </datalist>

        {variant === "points" ? (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-paper text-left">
                  <th className="px-2 py-2 font-bold">{t.description}</th>
                  <th className="w-[4.2rem] px-0.5 py-2 text-center font-bold">{t.qty}</th>
                  <th className="w-[5rem] px-0.5 py-2 text-center font-bold">{t.rate}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => {
                  const amount = (Number(item.qty) || 0) * (Number(item.rate) || 0);
                  return (
                    <tr key={idx} className="border-b border-line">
                      <td className="px-2 py-2">
                        <span className="block font-semibold leading-snug">
                          {item.description}
                        </span>
                        <span className="text-xs text-stone-500">
                          {item.unit}
                          {amount > 0 && (
                            <>
                              {" · "}
                              <span className="tnum font-bold text-ink">
                                {formatINR(amount, 0)}
                              </span>
                            </>
                          )}
                        </span>
                      </td>
                      <td className="px-0.5 py-2">
                        <input
                          value={item.qty}
                          onChange={(e) => update(idx, { qty: e.target.value })}
                          inputMode="decimal"
                          placeholder="0"
                          aria-label={`${t.qty} ${item.description}`}
                          className="field field-tight tnum min-h-[44px]"
                        />
                      </td>
                      <td className="px-0.5 py-2">
                        <input
                          value={item.rate}
                          onChange={(e) => update(idx, { rate: e.target.value })}
                          inputMode="decimal"
                          aria-label={`${t.rate} ${item.description}`}
                          className="field field-tight tnum min-h-[44px]"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
        <div className="space-y-3">
          {items.map((item, idx) => (
            <div key={idx} className="card p-3">
              {useParts && (
                <input
                  value={item.section}
                  onChange={(e) => update(idx, { section: e.target.value })}
                  placeholder={t.partName}
                  list="bill-parts"
                  className="field mb-2 bg-paper text-sm"
                />
              )}
              <input
                value={item.description}
                onChange={(e) => update(idx, { description: e.target.value })}
                placeholder={t.description}
                list="recent-descriptions"
                className="field"
              />
              {(() => {
                // Proposed, never applied: what he typed is what gets saved
                // unless he taps. See src/lib/spelling.ts.
                const fixed = suggest(item.description);
                if (!fixed) return null;
                return (
                  <button
                    type="button"
                    onClick={() => update(idx, { description: fixed })}
                    className="mt-1.5 block min-h-[32px] text-left text-xs leading-snug text-accent"
                  >
                    {t.didYouMean} <span className="font-bold underline">{fixed}</span>
                  </button>
                );
              })()}
              {(() => {
                const own = findOwnRate(item.description);
                if (!own) return null;
                return (
                  <p className="mt-1.5 text-xs leading-snug text-stone-600">
                    <span className="font-semibold">{t.youChargedLast}</span>{" "}
                    <span className="tnum font-bold">{formatINR(own.latest.rate, 0)}</span>{" "}
                    {t.lastTimeOn} {formatDate(own.latest.date)}
                    {own.earlier && (
                      <>
                        {" · "}
                        {t.wasEarlier}{" "}
                        <span className="tnum">{formatINR(own.earlier.rate, 0)}</span>{" "}
                        {formatDate(own.earlier.date)}
                      </>
                    )}
                  </p>
                );
              })()}
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
                {/* Nothing to remove when this is the only line. */}
                {items.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
                    className="min-h-[44px] rounded-xl px-3 text-sm font-semibold text-red-700 active:bg-red-50"
                  >
                    × {t.delete}
                  </button>
                ) : (
                  <span />
                )}
                <span className="tnum font-bold">
                  {formatINR((Number(item.qty) || 0) * (Number(item.rate) || 0))}
                </span>
              </div>
            </div>
          ))}
        </div>
        )}

        {variant !== "points" && (
          <button
            type="button"
            onClick={() => setItems((prev) => [...prev, emptyItem(defaultHsn, lastSection())])}
            className="btn-secondary mt-3 w-full"
          >
            + {t.addItem}
          </button>
        )}

        {/* The two things he needs occasionally, as links rather than
            blocks. A plain cash bill never has to look at either. */}
        <div className="mt-3 flex flex-wrap justify-center gap-x-5 gap-y-1 text-sm">
          <button
            type="button"
            onClick={() => setUseParts((v) => !v)}
            className="min-h-[36px] font-semibold text-accent underline"
          >
            {useParts ? `- ${t.removeParts}` : `+ ${t.useParts}`}
          </button>
          {scMode === "none" && (
            <button
              type="button"
              onClick={() => setScMode("percent")}
              className="min-h-[36px] font-semibold text-accent underline"
            >
              + {t.addServiceCharge}
            </button>
          )}
        </div>
      </div>

      {/* Only once he has asked for it — see the link under Add Item. */}
      {scMode !== "none" && (
        <div>
          <p className="label">{t.serviceCharge}</p>
          <div className="card space-y-3 p-4">
            <select
              name="service_charge_mode"
              value={scMode}
              onChange={(e) => setScMode(e.target.value)}
              className="field"
              aria-label={t.serviceCharge}
            >
              <option value="percent">{t.serviceChargePercent}</option>
              <option value="amount">{t.serviceChargeFixed}</option>
              <option value="none">{t.serviceChargeNone}</option>
            </select>

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
          </div>
        </div>
      )}

      {/* Only when there is a breakdown worth showing. With no service
          charge and GST off it just repeated the running-total bar. */}
      {(serviceCharge !== 0 || gstEnabled || useParts) && (
        <div className="card p-4">
          {useParts &&
            (() => {
              const parts: { name: string; total: number }[] = [];
              for (const i of items) {
                const name = i.section.trim();
                if (!name) continue;
                const value = (Number(i.qty) || 0) * (Number(i.rate) || 0);
                const found = parts.find((p) => p.name === name);
                if (found) found.total += value;
                else parts.push({ name, total: value });
              }
              if (parts.length === 0) return null;
              return (
                <div className="mb-2 border-b border-line pb-2">
                  {parts.map((p) => (
                    <div key={p.name} className="flex justify-between text-sm text-stone-600">
                      <span className="truncate">{p.name}</span>
                      <span className="tnum font-semibold">{formatINR(p.total)}</span>
                    </div>
                  ))}
                </div>
              );
            })()}
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
      )}

      {/* Status is a decision he never needs when writing a bill — a new
          one is a draft, and sharing it is what makes it sent. On an
          existing bill it stays available. */}
      {id ? (
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
      ) : (
        <input type="hidden" name="status" value={status} />
      )}
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

      {/* He quotes with the customer standing next to him; the number he
          is about to say out loud should never be a scroll away. */}
      {total > 0 && (
        <div className="total-bar no-print">
          <div className="total-bar-inner flex items-center justify-between px-4 py-2.5">
            <span className="font-semibold text-stone-600">{t.total}</span>
            <span className="tnum text-xl font-extrabold">{formatINR(total)}</span>
          </div>
        </div>
      )}
    </form>
  );
}
