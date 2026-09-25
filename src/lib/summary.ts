// The year at a glance. Pure functions only — no database, so the
// arithmetic behind the numbers he shows his accountant can be reasoned
// about and tested on its own.

import { daysBetween } from "@/lib/format";
import { round2 } from "@/lib/payments";

export interface SummaryDoc {
  id: string;
  doc_date: string;
  total: number;
  client_id: string | null;
}

export interface SummaryPayment {
  document_id: string;
  paid_on: string;
  amount: number;
}

/**
 * How long a bill took to be settled in full, in days.
 *
 * Part-payments mean a bill is settled by whichever instalment finally
 * covers it, not by the first one — an advance on day 1 followed by the
 * balance on day 60 is a sixty-day customer, not a one-day customer.
 * Returns null while a bill is still owed, so a half-paid invoice never
 * flatters the average.
 */
export function daysToSettle(doc: SummaryDoc, payments: SummaryPayment[]): number | null {
  const total = Number(doc.total);
  if (total <= 0) return null;

  const mine = payments
    .filter((p) => p.document_id === doc.id)
    .sort((a, b) => a.paid_on.localeCompare(b.paid_on));

  let running = 0;
  for (const p of mine) {
    running = round2(running + Number(p.amount));
    if (running >= total - 0.005) {
      return daysBetween(doc.doc_date, new Date(p.paid_on + "T00:00:00"));
    }
  }
  return null;
}

/** Average days to settle across every bill that has actually been settled. */
export function averageDaysToPay(
  docs: SummaryDoc[],
  payments: SummaryPayment[]
): number | null {
  const spans = docs
    .map((d) => daysToSettle(d, payments))
    .filter((n): n is number => n !== null);
  if (spans.length === 0) return null;
  return Math.round(spans.reduce((s, n) => s + n, 0) / spans.length);
}

/**
 * His work splits into service calls, ordinary jobs and contracts, and the
 * split matters: most of his week can go on the small ones while most of
 * the money comes from the few large ones.
 */
export const JOB_BUCKETS = [
  { key: "small", upTo: 5000 },
  { key: "medium", upTo: 25000 },
  { key: "large", upTo: Infinity },
] as const;

export interface Bucket {
  key: string;
  count: number;
  total: number;
}

export function jobSizeBuckets(totals: number[]): Bucket[] {
  const out: Bucket[] = JOB_BUCKETS.map((b) => ({ key: b.key, count: 0, total: 0 }));
  for (const raw of totals) {
    const value = Number(raw);
    if (!(value > 0)) continue; // a ₹0 bill is not a job
    const idx = JOB_BUCKETS.findIndex((b) => value <= b.upTo);
    out[idx].count += 1;
    out[idx].total = round2(out[idx].total + value);
  }
  return out;
}

/** Twelve months of a year, Jan first, zero where nothing was billed. */
export function monthSeries(docs: SummaryDoc[], year: number): number[] {
  const months = new Array(12).fill(0);
  for (const d of docs) {
    const [y, m] = d.doc_date.split("-").map(Number);
    if (y !== year || !m || m < 1 || m > 12) continue;
    months[m - 1] = round2(months[m - 1] + Number(d.total));
  }
  return months;
}

/** Rank anything by a number, biggest first, keeping only what is worth showing. */
export function topBy<T>(rows: T[], value: (r: T) => number, limit: number): T[] {
  return rows
    .filter((r) => value(r) > 0)
    .sort((a, b) => value(b) - value(a))
    .slice(0, limit);
}

/** The minimum a bill needs for the duplicate check to judge it. */
export interface DupCandidate {
  id: string;
  type: string;
  client_id: string | null;
  doc_date: string;
  total: number;
}

/**
 * Bills that look like the same bill entered twice, in the order they
 * were given, each group's members adjacent.
 *
 * Two *invoices* agreeing on the customer, the day and the amount to the
 * paisa is not a coincidence — he had ₹38,062 of one apartment job on the
 * books as both INV-2026-013 and -014, and neither looked wrong on its
 * own. Estimates are excluded on purpose: quoting the same job twice,
 * once revised, is an ordinary week.
 *
 * A bill with no customer is matched only against other bills with no
 * customer, never lumped in with everything else that lacks one.
 */
export function findDuplicateBills<T extends DupCandidate>(docs: T[]): T[] {
  const out: T[] = [];
  const seen = new Map<string, T>();
  for (const d of docs) {
    if (d.type !== "invoice") continue;
    const who = d.client_id ?? `none:${d.id}`;
    const key = `${who}|${d.doc_date}|${Number(d.total).toFixed(2)}`;
    const first = seen.get(key);
    if (!first) {
      seen.set(key, d);
    } else {
      if (!out.includes(first)) out.push(first);
      out.push(d);
    }
  }
  return out;
}

/** One line of a worker's book, as the labour total needs it. */
export interface LabourLine {
  worker_id: string;
  kind: string;
  amount: number;
}

/**
 * What he still owes his men, all told.
 *
 * Per person, then only the positive balances: a man he has overpaid is
 * not credit against a man he owes, and netting them would quietly
 * understate what has to leave his pocket on Saturday.
 *
 * Home and the labour book both show this figure, so it lives here —
 * two screens disagreeing about what he owes is worse than neither
 * showing it.
 */
export function labourDue(entries: LabourLine[]): number {
  const book = new Map<string, number>();
  for (const e of entries) {
    const owed = book.get(e.worker_id) ?? 0;
    book.set(e.worker_id, owed + (e.kind === "work" ? Number(e.amount) : -Number(e.amount)));
  }
  let total = 0;
  for (const balance of book.values()) total += Math.max(0, balance);
  return Math.round(total * 100) / 100;
}

/** A bill, as the ageing needs it. */
export interface AgeingBill {
  type: string;
  doc_date: string;
  total: number;
  amount_received: number;
}

/**
 * The date of the oldest *invoice* he is still owed money on, or null.
 *
 * The oldest one is what decides whether a customer needs chasing: a
 * client with a bill from three weeks ago and one from yesterday is a
 * three-week problem, and taking the latest date would hide that every
 * time he does a second job for them. Drafts count — an unsent bill is
 * still work he has not been paid for, and the age is the argument for
 * sending it.
 */
export function oldestUnpaidDate(bills: AgeingBill[]): string | null {
  let oldest: string | null = null;
  for (const b of bills) {
    if (b.type !== "invoice") continue;
    if (Number(b.total) - Number(b.amount_received) <= 0.005) continue;
    if (oldest === null || b.doc_date < oldest) oldest = b.doc_date;
  }
  return oldest;
}
