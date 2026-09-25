"use client";

import { useState } from "react";
import type { Dict } from "@/lib/i18n";
import { suggest } from "@/lib/spelling";

// The materials he buys, as one tap each.
//
// Typing the name was the tax on recording the evening, and he types it
// differently every time — three spellings of 2.5 sqmm copper wire are
// already in his own list. Every variant that misses splits the price
// history, so the shop comparison gets less useful the more he uses it.
// Tapping a name fixes the spelling at the source and saves the typing.
//
// It owns the unit too: a metre of wire and a number of boxes come with
// the item, not as a second decision.

export default function DayItemPicker({
  suggestions,
  units,
  t,
}: {
  suggestions: { label: string; unit: string }[];
  units: readonly string[];
  t: Dict;
}) {
  const [item, setItem] = useState("");
  const [unit, setUnit] = useState("Nos");

  return (
    <>
      {suggestions.length > 0 && (
        <div className="-mx-1 flex flex-wrap gap-1.5">
          {suggestions.map((s) => {
            const on = item === s.label;
            return (
              <button
                key={s.label}
                type="button"
                onClick={() => {
                  // Tapping the one already chosen clears it, so a mistap
                  // is undone the same way it was made.
                  setItem(on ? "" : s.label);
                  if (!on) setUnit(s.unit || "Nos");
                }}
                className={`min-h-[44px] rounded-xl px-3 text-sm font-semibold ${
                  on
                    ? "bg-accent text-white"
                    : "border-2 border-line bg-white text-stone-700"
                }`}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      )}

      <div>
        <input
          name="item"
          value={item}
          onChange={(e) => setItem(e.target.value)}
          placeholder={t.whatDidYouBuy}
          required
          className="field"
          list="known-materials"
          autoComplete="off"
        />
        {(() => {
          const fixed = suggest(item);
          if (!fixed) return null;
          return (
            <button
              type="button"
              onClick={() => setItem(fixed)}
              className="mt-1.5 block min-h-[32px] text-left text-xs leading-snug text-accent"
            >
              {t.didYouMean} <span className="font-bold underline">{fixed}</span>
            </button>
          );
        })()}
      </div>

      {/* How many, and what the lot came to. The unit price follows from
          those two, and that is what the price book is made of. */}
      <div className="flex gap-2">
        <div className="w-20 shrink-0">
          <input
            name="qty"
            inputMode="decimal"
            placeholder={t.qty}
            aria-label={t.qty}
            className="field tnum px-2 text-center"
          />
        </div>
        <div className="w-24 shrink-0">
          <select
            name="unit"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            className="field px-2"
            aria-label={t.unit}
          >
            {units.map((u) => (
              <option key={u}>{u}</option>
            ))}
          </select>
        </div>
        <div className="min-w-0 flex-1">
          <input
            name="amount"
            inputMode="decimal"
            placeholder={t.totalPaid}
            required
            aria-label={t.totalPaid}
            className="field tnum"
          />
        </div>
      </div>
    </>
  );
}
