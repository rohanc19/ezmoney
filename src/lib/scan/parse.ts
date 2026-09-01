import type { ScanResult, ScannedItem } from "@/lib/types";

// Turns the raw text of a photographed shop bill into candidate line
// items. Deliberately conservative: it is better to offer four correct
// rows he ticks than twelve wrong ones he has to fix. He always sees and
// edits the result before anything is saved.

const NOISE = [
  "total", "sub total", "subtotal", "grand total", "gst", "cgst", "sgst", "igst",
  "tax", "invoice", "bill no", "bill date", "date", "gstin", "thank", "signature",
  "amount in words", "rupees", "discount", "round off", "roundoff", "balance",
  "cash", "change", "phone", "mobile", "address", "terms", "e&oe", "hsn",
  "qty", "rate", "amount", "particulars", "description", "sl no", "s.no",
];

const UNIT_WORDS: Record<string, string> = {
  nos: "Nos", no: "Nos", pcs: "Nos", pc: "Nos", piece: "Nos", pieces: "Nos",
  mtr: "Mtr", mtrs: "Mtr", m: "Mtr", meter: "Mtr", metre: "Mtr", mts: "Mtr",
  ft: "Ft", feet: "Ft", foot: "Ft",
  set: "Set", sets: "Set", box: "Set", pkt: "Set", packet: "Set", coil: "Set",
  hrs: "Hrs", hr: "Hrs", hour: "Hrs", day: "Day", days: "Day",
  point: "Point", points: "Point", job: "Job", lump: "Lump", roll: "Set",
};

function isNoise(line: string): boolean {
  const l = line.toLowerCase().trim();
  if (l.length < 3) return true;
  // A line that is only digits/punctuation carries no description.
  if (!/[a-zಀ-೿]/i.test(l)) return true;
  return NOISE.some((n) => l.startsWith(n) || l === n || l.includes(` ${n} :`));
}

function toNumber(token: string): number {
  return Number(token.replace(/,/g, ""));
}

/** All numbers in a line, with where they sit. */
function numberTokens(line: string): { value: number; index: number; raw: string }[] {
  const out: { value: number; index: number; raw: string }[] = [];
  const re = /(\d[\d,]*\.?\d*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) {
    const value = toNumber(m[1]);
    if (!Number.isNaN(value)) out.push({ value, index: m.index, raw: m[1] });
  }
  return out;
}

function findUnit(line: string): string | null {
  const words = line.toLowerCase().split(/[^a-z]+/);
  for (const w of words) {
    if (UNIT_WORDS[w]) return UNIT_WORDS[w];
  }
  return null;
}

function cleanDescription(text: string): string {
  return text
    .replace(/^\s*\d{1,3}\s*[).\-:]\s*/, "")      // "1)" "2." "3 -"
    .replace(/^\s*\d{1,3}\s+(?=[A-Za-z])/, "")    // a bare serial column
    .replace(/\s{2,}/g, " ")
    .replace(/[|:;,\-]+$/, "")
    .trim();
}

// Address and contact lines carry big numbers (a PIN, a phone) that would
// otherwise read as money.
const ADDRESSY =
  /\b(road|rd|street|st|nagar|layout|cross|main|colony|complex|market|bengaluru|bangalore|mysuru|mysore|pin|pincode|phone|ph|mob|mobile|tel|email|www|gstin)\b/i;

function parseLine(line: string): ScannedItem | null {
  if (ADDRESSY.test(line)) return null;

  // Read from the right: item rows end in a run of numbers
  // (qty, rate, amount), while the description in front of them may itself
  // contain sizes like "1.5 sq mm" or "8 way".
  const m = line.match(/^(.*?)((?:\s+\d[\d,]*(?:\.\d+)?){1,4})\s*$/);
  if (!m) return null;

  let description = cleanDescription(m[1]);
  const tail = m[2]
    .trim()
    .split(/\s+/)
    .map((raw) => ({ value: toNumber(raw), raw }))
    .filter((n) => !Number.isNaN(n.value));
  if (tail.length === 0 || description.length < 3) return null;

  const unit = findUnit(line) ?? "Nos";

  const finish = (qty: number, rate: number, amount: number): ScannedItem => {
    // If the quantity was sitting at the end of the description
    // ("PVC pipe 25mm 20 Mtr"), take it back out.
    const trailingQty = new RegExp(`\\s+${qty}\\s*[a-z]{0,5}\\.?$`, "i");
    const trimmed = description.replace(trailingQty, "").trim();
    if (trimmed.length >= 3) description = trimmed;
    return { description, qty, unit, rate, amount };
  };

  // Three trailing numbers that multiply out: qty × rate = amount.
  if (tail.length >= 3) {
    const [q, r, a] = tail.slice(-3).map((t) => t.value);
    if (q > 0 && r > 0 && a > 0 && Math.abs(q * r - a) <= Math.max(1, a * 0.02)) {
      return finish(q, r, a);
    }
  }
  // Two trailing numbers: qty × rate, or a rate repeated as the amount.
  if (tail.length >= 2) {
    const a = tail[tail.length - 1].value;
    const r = tail[tail.length - 2].value;
    if (r > 0 && a > 0) {
      if (Math.abs(r - a) < 0.01) return finish(1, r, a);
      const qty = Math.round((a / r) * 100) / 100;
      if (qty > 0 && qty < 1000 && Math.abs(qty * r - a) <= Math.max(0.5, a * 0.02)) {
        return finish(qty, r, a);
      }
      return finish(1, a, a);
    }
  }
  // A lone number is only money if it reads like money — this is what keeps
  // PIN codes and phone numbers out.
  const only = tail[tail.length - 1];
  const looksLikeMoney = only.raw.includes(".") || only.raw.includes(",") || only.value < 100000;
  if (only.value > 0 && looksLikeMoney) return finish(1, only.value, only.value);
  return null;
}

function findDate(text: string): string | null {
  const m = text.match(/(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  let year = Number(m[3]);
  if (year < 100) year += 2000;
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function findVendor(lines: string[]): string {
  // Shop name is nearly always in the first couple of lines, in caps,
  // with no prices on it.
  for (const line of lines.slice(0, 4)) {
    const l = line.trim();
    if (l.length < 4) continue;
    if (/\d{4,}/.test(l)) continue;
    if (/gstin|invoice|bill|tax/i.test(l)) continue;
    if (/[a-z]/i.test(l)) return l.replace(/\s{2,}/g, " ").slice(0, 60);
  }
  return "";
}

function findGrandTotal(lines: string[]): number | null {
  let best: number | null = null;
  for (const line of lines) {
    if (!/total|grand|net\s*(amount|payable)/i.test(line)) continue;
    if (/sub\s*total/i.test(line) && best !== null) continue;
    const nums = numberTokens(line);
    if (nums.length === 0) continue;
    const v = nums[nums.length - 1].value;
    if (v > 0 && (best === null || v > best)) best = v;
  }
  return best;
}

export function parseBillText(text: string): ScanResult {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const items: ScannedItem[] = [];
  for (const line of lines) {
    if (isNoise(line)) continue;
    const item = parseLine(line);
    if (!item) continue;
    // Junk filter: implausible money.
    if (item.amount <= 0 || item.amount > 10_00_000) continue;
    if (item.description.length > 90) item.description = item.description.slice(0, 90);
    items.push(item);
  }

  // Drop exact duplicates that OCR sometimes emits twice.
  const seen = new Set<string>();
  const unique = items.filter((i) => {
    const key = `${i.description.toLowerCase()}|${i.amount}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    items: unique.slice(0, 30),
    vendor: findVendor(lines),
    date: findDate(text),
    grandTotal: findGrandTotal(lines),
    rawLines: lines.length,
  };
}
