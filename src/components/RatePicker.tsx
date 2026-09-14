"use client";

import { useMemo, useState } from "react";
import Icon from "@/components/Icon";
import { formatINR } from "@/lib/format";
import type { Dict } from "@/lib/i18n";
import { matchesQuery, itemKey } from "@/lib/prices";
import type { RateCardItem } from "@/lib/types";

// His saved work and materials. He has over two hundred of them, so a
// flat scroll is useless — this is search-first, with the handful he
// actually reaches for sitting at the top when the box is empty.
//
// Tapping ticks rather than closes: a thirty-line estimate used to mean
// opening this sheet thirty times.

const MOST_USED = 8;

export default function RatePicker({
  items,
  t,
  onPick,
}: {
  items: RateCardItem[];
  t: Dict;
  onPick: (items: RateCardItem[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<Record<string, boolean>>({});

  // Searching goes through the same forgiving match the bill form uses,
  // so "bend 3/4" and "3/4 inch bend" both find the same thing — which
  // matters, because he has spelled it both ways over the years.
  const results = useMemo(() => {
    const needle = q.trim();
    if (!needle) return null;
    return items.filter(
      (i) =>
        matchesQuery(itemKey(i.description), needle) ||
        i.description.toLowerCase().includes(needle.toLowerCase())
    );
  }, [items, q]);

  // Only things he has actually reached for more than once. Most of his
  // two hundred items have been billed a single time, and ranking those
  // against each other just produces a random-looking top eight.
  const mostUsed = useMemo(() => {
    const repeat = items.filter((i) => i.times_used >= 2);
    if (repeat.length < 3) return [];
    return repeat.sort((a, b) => b.times_used - a.times_used).slice(0, MOST_USED);
  }, [items]);
  const mostUsedIds = new Set(mostUsed.map((i) => i.id));
  const rest = useMemo(
    () =>
      [...items]
        .filter((i) => !mostUsedIds.has(i.id))
        .sort((a, b) => a.description.localeCompare(b.description)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items]
  );

  const chosen = items.filter((i) => picked[i.id]);

  const close = () => {
    setOpen(false);
    setQ("");
    setPicked({});
  };

  if (items.length === 0) return null;

  const Row = ({ item }: { item: RateCardItem }) => (
    <li>
      <button
        type="button"
        onClick={() => setPicked((p) => ({ ...p, [item.id]: !p[item.id] }))}
        className={`flex min-h-[52px] w-full items-center gap-3 border-b border-line px-4 text-left ${
          picked[item.id] ? "bg-accent-wash" : "bg-white"
        }`}
      >
        <span
          aria-hidden
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 text-sm font-extrabold ${
            picked[item.id]
              ? "border-accent bg-accent text-white"
              : "border-line text-transparent"
          }`}
        >
          ✓
        </span>
        <span className="min-w-0 flex-1 py-2">
          <span className="block truncate font-semibold leading-snug">{item.description}</span>
        </span>
        <span className="tnum shrink-0 text-right">
          <span className="block font-bold text-accent-dark">{formatINR(item.rate, 0)}</span>
          <span className="block text-[0.7rem] text-stone-500">per {item.unit}</span>
        </span>
      </button>
    </li>
  );

  return (
    <>
      <button type="button" className="btn-secondary w-full" onClick={() => setOpen(true)}>
        <Icon name="list" /> {t.pickFromList}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-paper">
          <div className="border-b border-line bg-white px-4 pb-3 pt-3">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-lg font-extrabold">
                {t.rateCardShort}{" "}
                <span className="text-sm font-semibold text-stone-500">
                  {t.itemsCount.replace("{n}", String(items.length))}
                </span>
              </h2>
              <button type="button" className="btn-ghost px-3" onClick={close}>
                {t.cancel}
              </button>
            </div>
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t.searchItems}
              className="field"
            />
          </div>

          <div className="flex-1 overflow-y-auto pb-2">
            {results ? (
              results.length === 0 ? (
                <p className="p-8 text-center text-stone-600">{t.nothingMatched}</p>
              ) : (
                <ul>
                  {results.map((i) => (
                    <Row key={i.id} item={i} />
                  ))}
                </ul>
              )
            ) : (
              <>
                {mostUsed.length > 0 && (
                  <>
                    <p className="eyebrow px-4 pb-1 pt-3">{t.mostUsed}</p>
                    <ul>
                      {mostUsed.map((i) => (
                        <Row key={i.id} item={i} />
                      ))}
                    </ul>
                  </>
                )}
                <p className="eyebrow px-4 pb-1 pt-4">{t.allItems}</p>
                <ul>
                  {rest.map((i) => (
                    <Row key={i.id} item={i} />
                  ))}
                </ul>
              </>
            )}
          </div>

          <div className="border-t border-line bg-white p-3">
            <button
              type="button"
              className="btn-primary w-full disabled:opacity-50"
              disabled={chosen.length === 0}
              onClick={() => {
                onPick(chosen);
                close();
              }}
            >
              {chosen.length === 1
                ? t.addOneItem
                : t.addNItems.replace("{n}", String(chosen.length || 0))}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
