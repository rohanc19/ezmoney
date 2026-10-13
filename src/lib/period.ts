import { addDays, formatDate, formatMonth, mondayOf, todayISO } from "@/lib/format";

// A stretch of dates picked from a URL — ?from=&to= when he has chosen
// his own, otherwise a whole month (?month=yyyy-mm, defaulting to this
// one). Both ends are inclusive, because "1 Oct to 11 Oct" on paper
// means the 11th too. Server-only: the bill form never needs it.

export type Period = {
  from: string; // yyyy-mm-dd, inclusive
  to: string; // yyyy-mm-dd, inclusive
  /** The whole calendar month, when that is what this is. */
  monthKey: string | null;
};

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const MONTH = /^\d{4}-\d{2}$/;

export function shiftMonth(key: string, by: number): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1 + by, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function monthPeriod(key: string): Period {
  return { from: `${key}-01`, to: addDays(`${shiftMonth(key, 1)}-01`, -1), monthKey: key };
}

export function periodFromParams(p: { from?: string; to?: string; month?: string }): Period {
  if (ISO.test(p.from ?? "") && ISO.test(p.to ?? "")) {
    // Typed the wrong way round is still a perfectly clear request.
    const [from, to] = p.from! <= p.to! ? [p.from!, p.to!] : [p.to!, p.from!];
    const key = from.slice(0, 7);
    const whole = monthPeriod(key);
    return { from, to, monthKey: whole.from === from && whole.to === to ? key : null };
  }
  return monthPeriod(MONTH.test(p.month ?? "") ? p.month! : todayISO().slice(0, 7));
}

/** "Oct 2026", or "06-Oct-2026 to 11-Oct-2026". */
export function periodLabel(p: Period): string {
  if (p.monthKey) return formatMonth(`${p.monthKey}-01`);
  if (p.from === p.to) return formatDate(p.from);
  return `${formatDate(p.from)} to ${formatDate(p.to)}`;
}

/** His working week: Monday to Saturday, settled on Saturday. */
export function weekPeriod(anyDay: string): Period {
  const mon = mondayOf(anyDay);
  return { from: mon, to: addDays(mon, 5), monthKey: null };
}
