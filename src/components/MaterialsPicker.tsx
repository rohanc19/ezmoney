"use client";

import { useMemo, useState } from "react";
import Icon from "@/components/Icon";
import { formatDate, formatINR } from "@/lib/format";
import type { Dict } from "@/lib/i18n";
import type { UnbilledPurchase } from "@/lib/types";

// What he bought for this client, ready to put on their bill.
//
// He already writes every shop run down on /day against the client it was
// for. Until now the bill ignored all of it: he scrolled back through the
// day book, read out what he had bought, and typed it again — which is
// the one bit of double entry left in the app.
//
// Cost is never what he charges, so the markup is asked for up front and
// shown per line before he commits to it. He can still edit any rate
// afterwards; this only has to get him close.

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export default function MaterialsPicker({
  purchases,
  clientId,
  t,
  onPick,
}: {
  purchases: UnbilledPurchase[];
  clientId: string;
  t: Dict;
  onPick: (
    rows: { description: string; qty: string; unit: string; rate: string }[],
    expenseIds: string[]
  ) => void;
}) {
  const [open, setOpen] = useState(false);
  const [markup, setMarkup] = useState("20");
  const [picked, setPicked] = useState<Record<string, boolean>>({});

  const mine = useMemo(
    () => purchases.filter((p) => p.client_id === clientId),
    [purchases, clientId]
  );

  // Cost per unit, not per purchase: he buys 20 metres and bills 20 metres.
  const unitCost = (p: UnbilledPurchase) => {
    const q = Number(p.qty) || 0;
    return q > 0 ? Number(p.amount) / q : Number(p.amount);
  };
  const pct = Number(markup) || 0;
  const sell = (p: UnbilledPurchase) => round2(unitCost(p) * (1 + pct / 100));

  const chosen = mine.filter((p) => picked[p.id]);
  const cost = round2(chosen.reduce((s, p) => s + Number(p.amount), 0));
  const charge = round2(
    chosen.reduce((s, p) => s + sell(p) * (Number(p.qty) || 1), 0)
  );

  const close = () => {
    setOpen(false);
    setPicked({});
  };

  // Nothing bought for them, or no client chosen yet: say nothing at all.
  if (!clientId || mine.length === 0) return null;

  return (
    <>
      <button type="button" className="btn-secondary w-full" onClick={() => setOpen(true)}>
        <Icon name="list" /> {t.billWhatIBought.replace("{n}", String(mine.length))}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-paper">
          <div className="border-b border-line bg-white px-4 pb-3 pt-3">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-lg font-extrabold">{t.whatIBought}</h2>
              <button type="button" className="btn-ghost px-3" onClick={close}>
                {t.cancel}
              </button>
            </div>
            <label className="flex items-center gap-3">
              <span className="shrink-0 text-sm font-semibold text-stone-600">
                {t.markup}
              </span>
              <input
                value={markup}
                onChange={(e) => setMarkup(e.target.value)}
                inputMode="decimal"
                aria-label={t.markup}
                className="field field-tight tnum w-20"
              />
              <span className="text-sm text-stone-500">%</span>
            </label>
          </div>

          <div className="flex-1 overflow-y-auto pb-2">
            <ul>
              {mine.map((p) => {
                const on = picked[p.id];
                const q = Number(p.qty) || 0;
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => setPicked((x) => ({ ...x, [p.id]: !x[p.id] }))}
                      className={`flex min-h-[56px] w-full items-center gap-3 border-b border-line px-4 py-2 text-left ${
                        on ? "bg-accent-wash" : "bg-white"
                      }`}
                    >
                      <span
                        aria-hidden
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 text-sm font-extrabold ${
                          on ? "border-accent bg-accent text-white" : "border-line text-transparent"
                        }`}
                      >
                        ✓
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold leading-snug">
                          {p.item}
                        </span>
                        <span className="block text-xs text-stone-500">
                          {formatDate(p.date)}
                          {p.vendor ? ` · ${p.vendor}` : ""}
                          {q > 0 ? ` · ${q} ${p.unit}` : ""}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="tnum block text-xs text-stone-500">
                          {t.costWord} {formatINR(unitCost(p), 0)}
                        </span>
                        <span className="tnum block font-bold text-accent-dark">
                          {formatINR(sell(p), 0)}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="border-t border-line bg-white p-3">
            {chosen.length > 0 && (
              <p className="mb-2 flex justify-between text-sm">
                <span className="text-stone-600">
                  {t.costWord} {formatINR(cost, 0)}
                </span>
                <span className="font-bold">
                  {t.billWord} {formatINR(charge, 0)}
                </span>
              </p>
            )}
            <button
              type="button"
              className="btn-primary w-full disabled:opacity-50"
              disabled={chosen.length === 0}
              onClick={() => {
                onPick(
                  chosen.map((p) => ({
                    description: p.item,
                    qty: String(Number(p.qty) || 1),
                    unit: p.unit || "Nos",
                    rate: String(sell(p)),
                  })),
                  chosen.map((p) => p.id)
                );
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
