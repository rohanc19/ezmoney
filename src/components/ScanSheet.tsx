"use client";

import { useRef, useState } from "react";
import Icon from "@/components/Icon";
import { formatINR } from "@/lib/format";
import { downscaleImage } from "@/lib/image";
import type { Dict } from "@/lib/i18n";
import type { ScannedItem, ScanResult } from "@/lib/types";

// "Scan a bill": photograph a supplier's bill, and the items on it come
// back as tickable rows. Nothing is saved until he ticks and confirms —
// the photo is only read, never trusted.

interface Props {
  t: Dict;
  onAdd: (items: ScannedItem[]) => void;
}

export default function ScanSheet({ t, onAdd }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [picked, setPicked] = useState<Record<number, boolean>>({});

  async function handleFile(file: File) {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const small = await downscaleImage(file);
      const body = new FormData();
      body.append("image", small);
      const res = await fetch("/api/scan", { method: "POST", body });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? t.genericError);
      } else {
        const scan = json as ScanResult;
        setResult(scan);
        setPicked(Object.fromEntries(scan.items.map((_, i) => [i, true])));
      }
    } catch {
      setError(t.genericError);
    } finally {
      setBusy(false);
    }
  }

  function confirm() {
    if (!result) return;
    const chosen = result.items.filter((_, i) => picked[i]);
    if (chosen.length > 0) onAdd(chosen);
    setResult(null);
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          e.target.value = "";
        }}
      />

      <button
        type="button"
        className="btn-secondary w-full"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? (
          t.scanning
        ) : (
          <>
            <Icon name="camera" /> {t.scanBill}
          </>
        )}
      </button>

      {error && (
        <p className="mt-2 rounded-xl bg-amber-50 p-3 text-center font-medium text-amber-900">
          {error}
        </p>
      )}

      {result && (
        <div className="fixed inset-0 z-50 flex flex-col bg-paper">
          <div className="flex items-center justify-between border-b border-line bg-white px-4 py-3">
            <h2 className="text-lg font-extrabold">{t.scanBill}</h2>
            <button type="button" className="btn-ghost px-3" onClick={() => setResult(null)}>
              × {t.cancel}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {result.items.length === 0 ? (
              <p className="mt-8 text-center text-stone-600">{t.scanNothing}</p>
            ) : (
              <>
                <p className="mb-3 font-semibold text-stone-700">{t.scanFound}</p>
                <ul className="space-y-2">
                  {result.items.map((item, i) => (
                    <li key={i}>
                      <label className="card flex cursor-pointer items-start gap-3 p-3">
                        <input
                          type="checkbox"
                          checked={!!picked[i]}
                          onChange={(e) =>
                            setPicked((p) => ({ ...p, [i]: e.target.checked }))
                          }
                          className="mt-1 h-6 w-6 shrink-0 accent-teal-700"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold">{item.description}</span>
                          <span className="tnum mt-0.5 block text-sm text-stone-500">
                            {item.qty} {item.unit} × {formatINR(item.rate)}
                          </span>
                        </span>
                        <span className="tnum shrink-0 font-bold">{formatINR(item.amount)}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          <div className="flex gap-2 border-t border-line bg-white p-4">
            <button
              type="button"
              className="btn-secondary flex-1"
              onClick={() => {
                setResult(null);
                inputRef.current?.click();
              }}
            >
              {t.retake}
            </button>
            <button
              type="button"
              className="btn-primary flex-1"
              disabled={result.items.length === 0}
              onClick={confirm}
            >
              {t.addSelected}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
