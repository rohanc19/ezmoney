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
