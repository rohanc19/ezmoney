export type DocType = "estimate" | "invoice";
export type DocStatus = "draft" | "sent" | "approved" | "rejected" | "paid";

export const UNITS = ["Nos", "Mtr", "Ft", "Hrs", "Day", "Job", "Set", "Point", "Lump"] as const;
export const EXPENSE_CATEGORIES = [
  "Materials", "Tools", "Transport", "Labour", "Fuel", "Consumables", "Rent", "Misc",
] as const;
export const PAID_VIA = ["Cash", "UPI", "Card", "Bank", "Credit"] as const;

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
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
}

export interface LineItem {
  id?: string;
  position: number;
  description: string;
  qty: number;
  unit: string;
  rate: number;
  amount: number;
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
  gst_amount: number;
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
}
