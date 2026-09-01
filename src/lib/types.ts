export type DocType = "estimate" | "invoice";
export type DocStatus = "draft" | "sent" | "approved" | "rejected" | "paid";

export const UNITS = ["Nos", "Mtr", "Ft", "Hrs", "Day", "Job", "Set", "Point", "Lump"] as const;
export const EXPENSE_CATEGORIES = [
  "Materials", "Tools", "Transport", "Labour", "Fuel", "Consumables", "Rent", "Misc",
] as const;
export const PAID_VIA = ["Cash", "UPI", "Card", "Bank", "Credit"] as const;

// GST state codes — used to decide CGST+SGST (same state) vs IGST.
export const STATES: { code: string; name: string }[] = [
  { code: "29", name: "Karnataka" },
  { code: "27", name: "Maharashtra" },
  { code: "33", name: "Tamil Nadu" },
  { code: "36", name: "Telangana" },
  { code: "37", name: "Andhra Pradesh" },
  { code: "32", name: "Kerala" },
  { code: "24", name: "Gujarat" },
  { code: "07", name: "Delhi" },
  { code: "06", name: "Haryana" },
  { code: "08", name: "Rajasthan" },
  { code: "09", name: "Uttar Pradesh" },
  { code: "19", name: "West Bengal" },
  { code: "23", name: "Madhya Pradesh" },
  { code: "03", name: "Punjab" },
  { code: "10", name: "Bihar" },
  { code: "21", name: "Odisha" },
  { code: "02", name: "Himachal Pradesh" },
  { code: "04", name: "Chandigarh" },
  { code: "05", name: "Uttarakhand" },
  { code: "20", name: "Jharkhand" },
  { code: "22", name: "Chhattisgarh" },
  { code: "30", name: "Goa" },
  { code: "34", name: "Puducherry" },
  { code: "18", name: "Assam" },
];

export interface BusinessProfile {
  user_id: string;
  business_name: string;
  proprietor_name: string;
  address: string;
  city_pin: string;
  phone: string;
  email: string;
  gstin: string | null;
  gst_enabled: boolean;
  gst_rate: number;
  bank_name: string;
  account_no: string;
  ifsc: string;
  upi_id: string;
  payment_terms: string;
  estimate_validity_note: string;
  logo_url: string | null;
  serial_year_basis: "calendar" | "fiscal";
  state_code: string;
  state_name: string;
  default_hsn_sac: string;
  invoice_footer_note: string;
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  state_code: string;
  state_name: string;
  gstin: string | null;
}

export interface LineItem {
  id?: string;
  position: number;
  description: string;
  qty: number;
  unit: string;
  rate: number;
  amount: number;
  hsn_sac: string;
  gst_rate: number;
}

export interface DocumentRow {
  id: string;
  type: DocType;
  serial_no: string;
  doc_date: string;
  client_id: string | null;
  site_job: string;
  status: DocStatus;
  linked_estimate_id: string | null;
  subtotal: number;
  taxable_value: number;
  gst_amount: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  place_of_supply: string;
  total: number;
  notes: string;
  clients?: { name: string; phone: string; address: string } | null;
}

export interface Expense {
  id: string;
  date: string;
  category: string;
  item: string;
  vendor: string;
  amount: number;
  client_id: string | null;
  paid_via: string;
  notes: string;
  receipt_path: string | null;
}

export interface RateCardItem {
  id: string;
  description: string;
  unit: string;
  rate: number;
  hsn_sac: string;
  category: string;
  times_used: number;
}

/** One item read off a photographed bill, before he confirms it. */
export interface ScannedItem {
  description: string;
  qty: number;
  unit: string;
  rate: number;
  amount: number;
}

export interface ScanResult {
  items: ScannedItem[];
  vendor: string;
  date: string | null;
  grandTotal: number | null;
  rawLines: number;
}
