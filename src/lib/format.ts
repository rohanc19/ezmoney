// Formatting helpers: Indian rupees, Indian number grouping,
// dd-mmm-yyyy dates, and amounts in words (lakh/crore).

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** 28-Aug-2026 */
export function formatDate(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso + (iso.length === 10 ? "T00:00:00" : "")) : iso;
  if (isNaN(d.getTime())) return "";
  return `${String(d.getDate()).padStart(2, "0")}-${MONTHS[d.getMonth()]}-${d.getFullYear()}`;
}

/** "Sep 2026" — the heading over a month's bills. */
export function formatMonth(isoMonth: string): string {
  const [y, m] = isoMonth.split("-").map(Number);
  if (!y || !m || m < 1 || m > 12) return isoMonth;
  return `${MONTHS[m - 1]} ${y}`;
}

/** Whole days between two dates, for "unpaid for 47 days". */
export function daysBetween(iso: string, from: Date = new Date()): number {
  const then = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
  if (isNaN(then.getTime())) return 0;
  return Math.max(0, Math.floor((from.getTime() - then.getTime()) / 86400000));
}

/** today's date as yyyy-mm-dd for <input type=date> defaults (IST) */
export function todayISO(): string {
  const now = new Date();
  const ist = new Date(now.getTime() + (330 + now.getTimezoneOffset()) * 60000);
  return ist.toISOString().slice(0, 10);
}

/** 1234567.5 → "12,34,567.50" (Indian grouping) */
export function formatIndianNumber(n: number, decimals = 2): string {
  const neg = n < 0;
  const fixed = Math.abs(n).toFixed(decimals);
  const [intPart, decPart] = fixed.split(".");
  let grouped = "";
  if (intPart.length <= 3) {
    grouped = intPart;
  } else {
    const last3 = intPart.slice(-3);
    let rest = intPart.slice(0, -3);
    const parts: string[] = [];
    while (rest.length > 2) {
      parts.unshift(rest.slice(-2));
      rest = rest.slice(0, -2);
    }
    if (rest) parts.unshift(rest);
    grouped = parts.join(",") + "," + last3;
  }
  return (neg ? "-" : "") + grouped + (decPart ? "." + decPart : "");
}

/** ₹12,34,567.50 — and -₹5,040 for a loss, never ₹-5,040. */
export function formatINR(n: number, decimals = 2): string {
  if (n < 0) return "-₹" + formatIndianNumber(Math.abs(n), decimals);
  return "₹" + formatIndianNumber(n, decimals);
}

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
  "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function twoDigits(n: number): string {
  if (n < 20) return ONES[n];
  return TENS[Math.floor(n / 10)] + (n % 10 ? " " + ONES[n % 10] : "");
}

function threeDigits(n: number): string {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  let out = "";
  if (h) out = ONES[h] + " Hundred";
  if (rest) out += (out ? " " : "") + twoDigits(rest);
  return out;
}

/** Indian system: 12,34,56,789 → "Twelve Crore Thirty Four Lakh Fifty Six Thousand Seven Hundred Eighty Nine" */
export function numberToIndianWords(n: number): string {
  if (n === 0) return "Zero";
  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const rest = n % 1000;
  const parts: string[] = [];
  if (crore) parts.push(numberToIndianWords(crore) + " Crore");
  if (lakh) parts.push(twoDigits(lakh) + " Lakh");
  if (thousand) parts.push(twoDigits(thousand) + " Thousand");
  if (rest) parts.push(threeDigits(rest));
  return parts.join(" ");
}

/** 28150 → "Rupees Twenty Eight Thousand One Hundred Fifty Only" */
export function amountInWords(amount: number): string {
  const rupees = Math.floor(Math.abs(amount));
  const paise = Math.round((Math.abs(amount) - rupees) * 100);
  let out = "Rupees " + numberToIndianWords(rupees);
  if (paise > 0) out += " and " + twoDigits(paise) + " Paise";
  return out + " Only";
}
