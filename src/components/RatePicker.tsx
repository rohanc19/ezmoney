"use client";

import { useMemo, useState } from "react";
import { formatINR } from "@/lib/format";
import type { Dict } from "@/lib/i18n";
import type { RateCardItem } from "@/lib/types";

// His saved work and materials, most-used first. Tapping one drops it
// straight onto the bill at its usual rate — the fastest path from
// "client wants 30 points" to a finished estimate.

export default function RatePicker({
  items,
  t,
  onPick,
}: {
  items: RateCardItem[];
  t: Dict;
  onPick: (item: RateCardItem) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((i) => i.description.toLowerCase().includes(needle));
  }, [items, q]);

  if (items.length === 0) return null;

  return (
    <>
      <button type="button" className="btn-secondary w-full" onClick={() => setOpen(true)}>
        ☰ {t.pickFromList}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-paper">
          <div className="flex items-center justify-between border-b border-line bg-white px-4 py-3">
            <h2 className="text-lg font-extrabold">{t.rateCardShort}</h2>
            <button type="button" className="btn-ghost px-3" onClick={() => setOpen(false)}>
              ✕ {t.cancel}
            </button>
          </div>

          <div className="border-b border-line bg-white px-4 pb-3">
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t.searchPlaceholder}
              className="field"
            />
          </div>

          <ul className="flex-1 space-y-2 overflow-y-auto p-4">
            {filtered.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className="card flex w-full items-center justify-between gap-3 p-4 text-left"
                  onClick={() => {
                    onPick(item);
                    setOpen(false);
                    setQ("");
                  }}
                >
                  <span className="min-w-0">
                    <span className="block font-semibold">{item.description}</span>
                    <span className="text-sm text-stone-500">per {item.unit}</span>
                  </span>
                  <span className="tnum shrink-0 text-lg font-bold text-accent">
                    {formatINR(item.rate, 0)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
