"use client";

import { useRef, useState } from "react";
import Icon from "@/components/Icon";
import { formatINR } from "@/lib/format";
import { downscaleImage } from "@/lib/image";
import type { Dict } from "@/lib/i18n";
import { savePricesFromScan } from "@/lib/actions";
import {
  EXPENSE_CATEGORIES,
  PAID_VIA,
  type Expense,
  type ScanResult,
  type ScannedItem,
} from "@/lib/types";

// Add an expense — or photograph the shop bill and let it fill itself in.
// The photo is kept with the expense, so a year later he can still see
// what he actually bought.

export default function ExpenseForm({
  t,
  today,
  clients,
  shops,
  expense,
  receiptUrl,
  action,
}: {
  t: Dict;
  today: string;
  clients: { id: string; name: string }[];
  shops: { id: string; name: string; area: string }[];
  expense?: Expense | null;
  receiptUrl?: string | null;
  action: (formData: FormData) => Promise<void>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(receiptUrl ?? null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanNote, setScanNote] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [item, setItem] = useState(expense?.item ?? "");
  const [amount, setAmount] = useState(expense ? String(expense.amount) : "");
  const [date, setDate] = useState(expense?.date ?? today);
  const [category, setCategory] = useState(expense?.category ?? "Materials");
  const [paidVia, setPaidVia] = useState(expense?.paid_via ?? "Cash");
  const [clientIdVal, setClientIdVal] = useState(expense?.client_id ?? "");
  const [vendor, setVendor] = useState(expense?.vendor ?? "");
  const [notes, setNotes] = useState(expense?.notes ?? "");

  // What the photo said the shop charged. Kept aside so he can file it in
  // the price book — the only way that book ever gets filled.
  const [scanItems, setScanItems] = useState<ScannedItem[]>([]);
  const [priceShop, setPriceShop] = useState("");
  const [newShopArea, setNewShopArea] = useState("");
  const [savingPrices, setSavingPrices] = useState(false);
  const [pricesNote, setPricesNote] = useState<string | null>(null);

  async function choosePhoto(file: File) {
    const small = await downscaleImage(file);
    setPhoto(small);
    setRemovePhoto(false);
    setPreview(URL.createObjectURL(small));
    setScanNote(null);
    setScanItems([]);
    setPricesNote(null);
  }

  async function fillFromPhoto() {
    if (!photo) return;
    setScanning(true);
    setScanNote(null);
    try {
      const body = new FormData();
      body.append("image", photo);
      const res = await fetch("/api/scan", { method: "POST", body });
      const json = await res.json();
      if (!res.ok) {
        setScanNote(json.error ?? t.genericError);
      } else {
        const scan = json as ScanResult;
        setScanItems(scan.items ?? []);
        // A shop he already buys from, matched on the name the photo read.
        const known = scan.vendor
          ? shops.find((sh) => sh.name.toLowerCase() === scan.vendor.trim().toLowerCase())
          : undefined;
        setPriceShop(known ? known.id : scan.vendor ? "__new" : "");
        if (scan.vendor) setVendor(scan.vendor);
        if (scan.date) setDate(scan.date);
        if (scan.grandTotal) setAmount(String(scan.grandTotal));
        if (!item && scan.items.length > 0) {
          setItem(scan.items.slice(0, 2).map((i) => i.description).join(", ").slice(0, 80));
        }
        setScanNote(
          scan.grandTotal
            ? `${t.saved} ${formatINR(scan.grandTotal, 0)}`
            : t.scanNothing
        );
      }
    } catch {
      setScanNote(t.genericError);
    } finally {
      setScanning(false);
    }
  }

  async function keepPrices() {
    if (scanItems.length === 0) return;
    setSavingPrices(true);
    setPricesNote(null);
    try {
      const res = await savePricesFromScan({
        shopId: priceShop,
        newShopName: vendor,
        newShopArea,
        seenOn: date,
        items: scanItems.map((i) => ({ item: i.description, unit: i.unit, rate: i.rate })),
      });
      setPricesNote(
        res.saved > 0
          ? `${res.saved} ${t.pricesSaved}${res.shopName ? ` — ${res.shopName}` : ""}`
          : t.genericError
      );
      if (res.saved > 0) setScanItems([]);
    } catch {
      setPricesNote(t.genericError);
    } finally {
      setSavingPrices(false);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData();
    if (expense) fd.append("id", expense.id);
    fd.append("item", item);
    fd.append("amount", amount);
    fd.append("date", date);
    fd.append("category", category);
    fd.append("paid_via", paidVia);
    fd.append("client_id", clientIdVal);
    fd.append("vendor", vendor);
    fd.append("notes", notes);
    if (expense?.receipt_path) fd.append("existing_receipt", expense.receipt_path);
    if (removePhoto) fd.append("remove_receipt", "1");
    if (photo) fd.append("receipt", photo);
    try {
      await action(fd);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 pb-4">
      {/* photo first — on site, the photo is the fastest input */}
      <div className="card p-4">
        <p className="label mb-2">{t.receiptPhoto}</p>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void choosePhoto(f);
            e.target.value = "";
          }}
        />
        {preview ? (
          <div className="space-y-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt={t.receiptPhoto}
              className="max-h-56 w-full rounded-xl border border-line object-contain"
            />
            <div className="flex flex-wrap gap-2">
              {photo && (
                <button
                  type="button"
                  className="btn-secondary flex-1"
                  disabled={scanning}
                  onClick={fillFromPhoto}
                >
                  {scanning ? (
                    t.scanning
                  ) : (
                    <>
                      <Icon name="camera" /> {t.scanBill}
                    </>
                  )}
                </button>
              )}
              <button
                type="button"
                className="btn-danger"
                onClick={() => {
                  setPhoto(null);
                  setPreview(null);
                  setRemovePhoto(true);
                }}
              >
                {t.removePhoto}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="btn-secondary w-full"
            onClick={() => fileRef.current?.click()}
          >
            <Icon name="camera" /> {t.addPhoto}
          </button>
        )}
        {scanNote && (
          <p className="mt-2 rounded-xl bg-accent-wash p-3 text-center font-medium text-accent-dark">
            {scanNote}
          </p>
        )}
      </div>

      {/* one tap: what this bill charged becomes the price book */}
      {scanItems.length > 0 && (
        <div className="card p-4">
          <p className="label mb-1">{t.savePricesFromBill}</p>
          <p className="text-sm text-stone-500">{t.savePricesHint}</p>

          <ul className="mt-3 max-h-40 space-y-1 overflow-y-auto text-sm">
            {scanItems.map((i, n) => (
              <li key={n} className="flex justify-between gap-3">
                <span className="min-w-0 truncate text-stone-700">{i.description}</span>
                <span className="tnum shrink-0 font-semibold">{formatINR(i.rate)}</span>
              </li>
            ))}
          </ul>

          <div className="mt-3">
            <label className="mb-0.5 block text-xs text-stone-500" htmlFor="price_shop">
              {t.whichShop}
            </label>
            <select
              id="price_shop"
              value={priceShop}
              onChange={(e) => setPriceShop(e.target.value)}
              className="field"
            >
              <option value="">—</option>
              {shops.map((sh) => (
                <option key={sh.id} value={sh.id}>
                  {sh.name}
                  {sh.area ? ` · ${sh.area}` : ""}
                </option>
              ))}
              <option value="__new">{t.newShop}</option>
            </select>
          </div>

          {priceShop === "__new" && (
            <p className="mt-2 text-sm text-stone-500">
              {t.shopName}: <span className="font-semibold text-stone-700">{vendor || "—"}</span>
            </p>
          )}
          {priceShop === "__new" && (
            <input
              value={newShopArea}
              onChange={(e) => setNewShopArea(e.target.value)}
              placeholder={t.shopArea}
              className="field mt-2"
            />
          )}

          <button
            type="button"
            className="btn-secondary mt-3 w-full"
            disabled={savingPrices || !priceShop || (priceShop === "__new" && !vendor.trim())}
            onClick={keepPrices}
          >
            {savingPrices ? "…" : t.savePricesFromBill}
          </button>

          {pricesNote && (
            <p className="mt-2 rounded-xl bg-green-100 p-3 text-center font-semibold text-green-900">
              {pricesNote}
            </p>
          )}
        </div>
      )}

      <div>
        <label htmlFor="item" className="label">
          {t.item}
        </label>
        <input
          id="item"
          required
          value={item}
          onChange={(e) => setItem(e.target.value)}
          className="field"
        />
      </div>
      <div>
        <label htmlFor="amount" className="label">
          {t.amount} (₹)
        </label>
        <input
          id="amount"
          inputMode="decimal"
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="field tnum"
        />
      </div>
      <div className="flex gap-3">
        <div className="flex-1">
          <label htmlFor="date" className="label">
            {t.date}
          </label>
          <input
            id="date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="field"
          />
        </div>
        <div className="flex-1">
          <label htmlFor="category" className="label">
            {t.category}
          </label>
          <select
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="field"
          >
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex gap-3">
        <div className="flex-1">
          <label htmlFor="paid_via" className="label">
            {t.paidVia}
          </label>
          <select
            id="paid_via"
            value={paidVia}
            onChange={(e) => setPaidVia(e.target.value)}
            className="field"
          >
            {PAID_VIA.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label htmlFor="client_id" className="label">
            {t.forClient}
          </label>
          <select
            id="client_id"
            value={clientIdVal}
            onChange={(e) => setClientIdVal(e.target.value)}
            className="field"
          >
            <option value="">—</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label htmlFor="vendor" className="label">
          {t.vendor}
        </label>
        <input
          id="vendor"
          value={vendor}
          onChange={(e) => setVendor(e.target.value)}
          className="field"
        />
      </div>
      <div>
        <label htmlFor="notes" className="label">
          {t.notes}
        </label>
        <input
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
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
