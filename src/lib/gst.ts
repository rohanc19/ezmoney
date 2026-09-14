// Tax calculation. Line items are the source of truth; everything else
// is derived here and then stored on the document row.
//
// Indian rules applied:
//  - Supplier and customer in the SAME state  → CGST + SGST, half each.
//  - Different states                          → IGST, the full rate.
//  - Place of supply is the customer's state (services at their site).
// When GST is off in Settings, all of this collapses to zero and the
// bill prints as a plain invoice.

export interface TaxLine {
  description: string;
  qty: number;
  unit: string;
  rate: number;
  amount: number;
  hsn_sac: string;
  gst_rate: number;
  /** Which part of the job this line sits under. Tax ignores it. */
  section?: string;
}

export interface SlabSummary {
  rate: number;          // 0.18
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
}

export interface Totals {
  subtotal: number;
  /** His fee for the job, on top of the items. Taxed like a service. */
  serviceCharge: number;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  gstAmount: number;
  total: number;
  interState: boolean;
  slabs: SlabSummary[];
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * The service charge in rupees.
 *   percent → that percentage of the items
 *   amount  → the figure he typed
 * Rounded here, once, so the same number is stored, shown and printed.
 */
export function computeServiceCharge(
  itemsSubtotal: number,
  mode: string,
  value: number
): number {
  const v = Number(value) || 0;
  if (mode === "percent") return round2((itemsSubtotal * v) / 100);
  if (mode === "amount") return round2(v);
  return 0;
}

export function computeTotals(
  items: TaxLine[],
  opts: {
    gstEnabled: boolean;
    sellerStateCode: string;
    placeOfSupplyCode: string;
    fallbackRate: number;
    /** Already in rupees — see computeServiceCharge. */
    serviceCharge?: number;
  }
): Totals {
  const subtotal = round2(items.reduce((s, i) => s + i.qty * i.rate, 0));
  const serviceCharge = round2(Number(opts.serviceCharge) || 0);

  if (!opts.gstEnabled) {
    return {
      subtotal,
      serviceCharge,
      taxableValue: round2(subtotal + serviceCharge),
      cgst: 0,
      sgst: 0,
      igst: 0,
      gstAmount: 0,
      total: round2(subtotal + serviceCharge),
      interState: false,
      slabs: [],
    };
  }

  // No place of supply recorded yet → assume same state (the common case).
  const interState =
    !!opts.placeOfSupplyCode &&
    !!opts.sellerStateCode &&
    opts.placeOfSupplyCode !== opts.sellerStateCode;

  // The service charge is a supply like any other, so it is taxed at the
  // standard rate and joins its slab in the summary table.
  const taxed: { taxable: number; gst_rate: number }[] = items.map((i) => ({
    taxable: i.qty * i.rate,
    gst_rate: i.gst_rate,
  }));
  if (serviceCharge !== 0) {
    taxed.push({ taxable: serviceCharge, gst_rate: opts.fallbackRate });
  }

  const bySlab = new Map<number, SlabSummary>();
  for (const item of taxed) {
    const rate = item.gst_rate > 0 ? item.gst_rate : opts.fallbackRate;
    const taxable = item.taxable;
    const tax = taxable * rate;
    const slab = bySlab.get(rate) ?? {
      rate,
      taxable: 0,
      cgst: 0,
      sgst: 0,
      igst: 0,
    };
    slab.taxable += taxable;
    if (interState) {
      slab.igst += tax;
    } else {
      slab.cgst += tax / 2;
      slab.sgst += tax / 2;
    }
    bySlab.set(rate, slab);
  }

  const slabs = [...bySlab.values()]
    .map((s) => ({
      rate: s.rate,
      taxable: round2(s.taxable),
      cgst: round2(s.cgst),
      sgst: round2(s.sgst),
      igst: round2(s.igst),
    }))
    .sort((a, b) => a.rate - b.rate);

  const cgst = round2(slabs.reduce((s, x) => s + x.cgst, 0));
  const sgst = round2(slabs.reduce((s, x) => s + x.sgst, 0));
  const igst = round2(slabs.reduce((s, x) => s + x.igst, 0));
  const gstAmount = round2(cgst + sgst + igst);

  const taxableValue = round2(subtotal + serviceCharge);

  return {
    subtotal,
    serviceCharge,
    taxableValue,
    cgst,
    sgst,
    igst,
    gstAmount,
    total: round2(taxableValue + gstAmount),
    interState,
    slabs,
  };
}

/** One printed row of the tax invoice grid. */
export interface LineTax {
  /** The row as printed: description, qty, unit, rate. */
  description: string;
  qty: number;
  unit: string;
  rate: number;
  hsn_sac: string;
  section?: string;
  /** The GST rate applied to this row, e.g. 0.18. */
  gstRate: number;
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  /** taxable + tax — the row's own Total column. */
  total: number;
}

/**
 * The line items as the rows of a GST grid, with the tax split out per row.
 *
 * A column of rounded rows does not generally add up to a total that was
 * rounded once at the end, and on a tax invoice a column that does not add
 * up is the first thing an accountant notices. So every column here is
 * reconciled against `computeTotals` — the paisa of difference is pushed
 * onto the largest row — which makes the printed column sum to the printed
 * footer by construction, not by luck. `computeTotals` stays the authority;
 * this only ever redistributes its own rounding.
 *
 * The service charge is a taxed supply, so it comes back as a final row.
 */
export function computeLineTaxes(
  items: TaxLine[],
  totals: Totals,
  opts: { serviceChargeLabel?: string; fallbackRate: number }
): LineTax[] {
  const rows: LineTax[] = items.map((i) => ({
    description: i.description,
    qty: i.qty,
    unit: i.unit,
    rate: i.rate,
    hsn_sac: i.hsn_sac,
    section: i.section,
    gstRate: i.gst_rate > 0 ? i.gst_rate : opts.fallbackRate,
    taxable: round2(i.qty * i.rate),
    cgst: 0,
    sgst: 0,
    igst: 0,
    total: 0,
  }));

  if (totals.serviceCharge !== 0) {
    rows.push({
      description: opts.serviceChargeLabel || "Service Charge",
      qty: 1,
      unit: "Job",
      rate: totals.serviceCharge,
      hsn_sac: "",
      gstRate: opts.fallbackRate,
      taxable: totals.serviceCharge,
      cgst: 0,
      sgst: 0,
      igst: 0,
      total: 0,
    });
  }

  if (rows.length === 0) return rows;

  // The row that absorbs each column's rounding: the biggest one, where a
  // paisa is least visible.
  let anchor = 0;
  for (let n = 1; n < rows.length; n++) {
    if (Math.abs(rows[n].taxable) > Math.abs(rows[anchor].taxable)) anchor = n;
  }

  const settle = (key: "taxable" | "cgst" | "sgst" | "igst", target: number) => {
    const sum = round2(rows.reduce((s, r) => s + r[key], 0));
    rows[anchor][key] = round2(rows[anchor][key] + round2(target - sum));
  };

  settle("taxable", totals.taxableValue);

  for (const r of rows) {
    const tax = r.taxable * r.gstRate;
    if (totals.gstAmount === 0) continue;
    if (totals.interState) {
      r.igst = round2(tax);
    } else {
      r.cgst = round2(tax / 2);
      r.sgst = round2(tax / 2);
    }
  }
  if (totals.gstAmount !== 0) {
    settle("cgst", totals.cgst);
    settle("sgst", totals.sgst);
    settle("igst", totals.igst);
  }

  for (const r of rows) {
    r.total = round2(r.taxable + r.cgst + r.sgst + r.igst);
  }

  return rows;
}
