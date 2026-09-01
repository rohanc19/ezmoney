"use client";

import { useRef, useState } from "react";
import { formatINR } from "@/lib/format";
import { downscaleImage } from "@/lib/image";
import type { Dict } from "@/lib/i18n";
import { EXPENSE_CATEGORIES, PAID_VIA, type Expense, type ScanResult } from "@/lib/types";

// Add an expense — or photograph the shop bill and let it fill itself in.
// The photo is kept with the expense, so a year later he can still see
// what he actually bought.

export default function ExpenseForm({
  t,
  today,
  clients,
  expense,
  receiptUrl,
  action,
}: {
  t: Dict;
  today: string;
  clients: { id: string; name: string }[];
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

  async function choosePhoto(file: File) {
    const small = await downscaleImage(file);
    setPhoto(small);
    setRemovePhoto(false);
    setPreview(URL.createObjectURL(small));
    setScanNote(null);
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
                  {scanning ? t.scanning : `✨ ${t.scanBill}`}
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
            📷 {t.addPhoto}
          </button>
        )}
        {scanNote && (
          <p className="mt-2 rounded-xl bg-accent-wash p-3 text-center font-medium text-accent-dark">
            {scanNote}
          </p>
        )}
      </div>

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
