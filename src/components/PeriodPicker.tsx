import Link from "next/link";
import type { Dict } from "@/lib/i18n";
import { periodLabel, shiftMonth, type Period } from "@/lib/period";

// Which dates a sheet covers: ‹ month › for the usual case, a row of
// one-tap shortcuts, and "Choose dates" folded away for the occasional
// odd stretch. A plain GET form — no JavaScript, so nothing for the old
// PC to load.

export default function PeriodPicker({
  path,
  period,
  shortcuts,
  t,
}: {
  path: string;
  period: Period;
  shortcuts: { label: string; period: Period }[];
  t: Dict;
}) {
  const href = (p: Period) =>
    p.monthKey ? `${path}?month=${p.monthKey}` : `${path}?from=${p.from}&to=${p.to}`;
  const isSame = (p: Period) => p.from === period.from && p.to === period.to;
  // A custom stretch steps by the month it starts in.
  const key = period.monthKey ?? period.from.slice(0, 7);

  return (
    <div className="no-print">
      <div className="flex items-center justify-between gap-2">
        <Link
          href={`${path}?month=${shiftMonth(key, -1)}`}
          aria-label={t.prevMonth}
          className="btn-secondary min-h-[44px] px-3 text-xl font-bold"
        >
          ‹
        </Link>
        <p className="text-center font-extrabold leading-tight">{periodLabel(period)}</p>
        <Link
          href={`${path}?month=${shiftMonth(key, period.monthKey ? 1 : 0)}`}
          aria-label={t.nextMonth}
          className="btn-secondary min-h-[44px] px-3 text-xl font-bold"
        >
          ›
        </Link>
      </div>

      <div className="mt-3 flex flex-wrap justify-center gap-2">
        {shortcuts.map((s) => (
          <Link
            key={s.label}
            href={href(s.period)}
            className={`btn min-h-[40px] px-3 text-sm ${
              isSame(s.period)
                ? "bg-accent text-white"
                : "border-2 border-line bg-white text-stone-700"
            }`}
          >
            {s.label}
          </Link>
        ))}
      </div>

      <details className="mt-3" open={!period.monthKey}>
        <summary className="cursor-pointer text-center text-sm font-bold text-accent">
          {t.chooseDates}
        </summary>
        <form method="get" action={path} className="mt-3 grid grid-cols-2 gap-2">
          <label className="text-sm font-semibold text-stone-600">
            {t.fromDate}
            <input type="date" name="from" defaultValue={period.from} required className="field mt-1" />
          </label>
          <label className="text-sm font-semibold text-stone-600">
            {t.toDate}
            <input type="date" name="to" defaultValue={period.to} required className="field mt-1" />
          </label>
          <button type="submit" className="btn-secondary col-span-2">
            {t.showDates}
          </button>
        </form>
      </details>
    </div>
  );
}
