"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

// ---------- auth ----------

export async function login(formData: FormData) {
  const supabase = supabaseServer();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect("/login?error=1");
  redirect("/");
}

export async function logout() {
  const supabase = supabaseServer();
  await supabase.auth.signOut();
  redirect("/login");
}

// ---------- language ----------

export async function setLanguage(formData: FormData) {
  const lang = formData.get("lang") === "kn" ? "kn" : "en";
  cookies().set("lang", lang, { maxAge: 60 * 60 * 24 * 365 * 5, path: "/" });
  revalidatePath("/", "layout");
  redirect("/settings?saved=1");
}

// ---------- helpers ----------

async function requireUser() {
  const supabase = supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

interface ItemInput {
  description: string;
  qty: number;
  unit: string;
  rate: number;
}

function parseItems(json: string): ItemInput[] {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r) => {
      const o = r as Record<string, unknown>;
      return {
        description: String(o.description ?? "").trim(),
        qty: Number(o.qty) || 0,
        unit: String(o.unit ?? "Nos"),
        rate: Number(o.rate) || 0,
      };
    })
    .filter((i) => i.description.length > 0);
}

// ---------- documents ----------

export async function saveDocument(formData: FormData) {
  const { supabase, user } = await requireUser();

  const id = String(formData.get("id") ?? "");
  const type = formData.get("type") === "invoice" ? "invoice" : "estimate";
  const doc_date = String(formData.get("doc_date") ?? "") || new Date().toISOString().slice(0, 10);
  const site_job = String(formData.get("site_job") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const status = String(formData.get("status") ?? "draft");
  const items = parseItems(String(formData.get("items_json") ?? "[]"));

  // client: existing id, or create a new one inline
  let client_id: string | null = String(formData.get("client_id") ?? "") || null;
  if (client_id === "__new") {
    const name = String(formData.get("new_client_name") ?? "").trim();
    if (name) {
      const { data: c, error } = await supabase
        .from("clients")
        .insert({
          user_id: user.id,
          name,
          phone: String(formData.get("new_client_phone") ?? "").trim(),
          address: String(formData.get("new_client_address") ?? "").trim(),
        })
        .select("id")
        .single();
      if (error) throw error;
      client_id = c.id;
    } else {
      client_id = null;
    }
  }

  // totals — source of truth is the line items
  const { data: profile } = await supabase
    .from("business_profile")
    .select("gst_enabled, gst_rate")
    .eq("user_id", user.id)
    .maybeSingle();
  const subtotal = items.reduce((s, i) => s + i.qty * i.rate, 0);
  const gst_amount = profile?.gst_enabled ? subtotal * Number(profile.gst_rate ?? 0.18) : 0;
  const total = subtotal + gst_amount;

  let docId = id;
  if (!id) {
    const { data: serial, error: serialError } = await supabase.rpc("next_serial", {
      p_type: type,
    });
    if (serialError) throw serialError;
    const { data: doc, error } = await supabase
      .from("documents")
      .insert({
        user_id: user.id,
        type,
        serial_no: serial as string,
        doc_date,
        client_id,
        site_job,
        status,
        subtotal,
        gst_amount,
        total,
        notes,
      })
      .select("id")
      .single();
    if (error) throw error;
    docId = doc.id;
  } else {
    const { error } = await supabase
      .from("documents")
      .update({ doc_date, client_id, site_job, status, subtotal, gst_amount, total, notes })
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) throw error;
    await supabase.from("line_items").delete().eq("document_id", id).eq("user_id", user.id);
  }

  if (items.length > 0) {
    const { error } = await supabase.from("line_items").insert(
      items.map((i, idx) => ({
        user_id: user.id,
        document_id: docId,
        position: idx + 1,
        description: i.description,
        qty: i.qty,
        unit: i.unit,
        rate: i.rate,
        amount: i.qty * i.rate,
      }))
    );
    if (error) throw error;
  }

  revalidatePath("/");
  redirect(`/documents/${docId}?saved=1`);
}

export async function setDocumentStatus(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!["draft", "sent", "approved", "rejected", "paid"].includes(status)) return;
  const { error } = await supabase
    .from("documents")
    .update({ status })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw error;
  revalidatePath("/");
  redirect(`/documents/${id}?saved=1`);
}

export async function deleteDocument(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = String(formData.get("id") ?? "");
  const { error } = await supabase.from("documents").delete().eq("id", id).eq("user_id", user.id);
  if (error) throw error;
  revalidatePath("/");
  redirect("/");
}

// One click: approved estimate → draft invoice with a fresh INV serial,
// everything copied, linked back to the estimate. Editable before sending.
export async function convertToInvoice(formData: FormData) {
  const { supabase, user } = await requireUser();
  const estimateId = String(formData.get("id") ?? "");

  const { data: est, error: e1 } = await supabase
    .from("documents")
    .select("*")
    .eq("id", estimateId)
    .eq("user_id", user.id)
    .single();
  if (e1) throw e1;
  const { data: items, error: e2 } = await supabase
    .from("line_items")
    .select("*")
    .eq("document_id", estimateId)
    .order("position");
  if (e2) throw e2;

  const { data: serial, error: e3 } = await supabase.rpc("next_serial", { p_type: "invoice" });
  if (e3) throw e3;

  const { data: inv, error: e4 } = await supabase
    .from("documents")
    .insert({
      user_id: user.id,
      type: "invoice",
      serial_no: serial as string,
      doc_date: new Date().toISOString().slice(0, 10),
      client_id: est.client_id,
      site_job: est.site_job,
      status: "draft",
      linked_estimate_id: est.id,
      subtotal: est.subtotal,
      gst_amount: est.gst_amount,
      total: est.total,
      notes: est.notes,
    })
    .select("id")
    .single();
  if (e4) throw e4;

  if (items && items.length > 0) {
    const { error: e5 } = await supabase.from("line_items").insert(
      items.map((i) => ({
        user_id: user.id,
        document_id: inv.id,
        position: i.position,
        description: i.description,
        qty: i.qty,
        unit: i.unit,
        rate: i.rate,
        amount: i.amount,
      }))
    );
    if (e5) throw e5;
  }

  revalidatePath("/");
  redirect(`/documents/${inv.id}/edit`);
}

// ---------- expenses ----------

export async function saveExpense(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = String(formData.get("id") ?? "");
  const row = {
    date: String(formData.get("date") ?? "") || new Date().toISOString().slice(0, 10),
    category: String(formData.get("category") ?? "Materials"),
    item: String(formData.get("item") ?? "").trim(),
    vendor: String(formData.get("vendor") ?? "").trim(),
    amount: Number(formData.get("amount")) || 0,
    client_id: String(formData.get("client_id") ?? "") || null,
    paid_via: String(formData.get("paid_via") ?? "Cash"),
    notes: String(formData.get("notes") ?? "").trim(),
  };
  if (!row.item) redirect("/expenses");

  if (id) {
    const { error } = await supabase
      .from("expenses")
      .update(row)
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("expenses").insert({ user_id: user.id, ...row });
    if (error) throw error;
  }
  revalidatePath("/expenses");
  redirect("/expenses?saved=1");
}

export async function deleteExpense(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = String(formData.get("id") ?? "");
  const { error } = await supabase.from("expenses").delete().eq("id", id).eq("user_id", user.id);
  if (error) throw error;
  revalidatePath("/expenses");
  redirect("/expenses");
}

// ---------- business profile ----------

export async function saveProfile(formData: FormData) {
  const { supabase, user } = await requireUser();
  const row = {
    user_id: user.id,
    business_name: String(formData.get("business_name") ?? "").trim(),
    proprietor_name: String(formData.get("proprietor_name") ?? "").trim(),
    address: String(formData.get("address") ?? "").trim(),
    city_pin: String(formData.get("city_pin") ?? "").trim(),
    phone: String(formData.get("phone") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim(),
    gstin: String(formData.get("gstin") ?? "").trim() || null,
    gst_enabled: formData.get("gst_enabled") === "on",
    gst_rate: Number(formData.get("gst_rate")) || 0.18,
    bank_name: String(formData.get("bank_name") ?? "").trim(),
    account_no: String(formData.get("account_no") ?? "").trim(),
    ifsc: String(formData.get("ifsc") ?? "").trim(),
    upi_id: String(formData.get("upi_id") ?? "").trim(),
    payment_terms: String(formData.get("payment_terms") ?? "").trim(),
    estimate_validity_note: String(formData.get("estimate_validity_note") ?? "").trim(),
  };
  const { error } = await supabase.from("business_profile").upsert(row);
  if (error) throw error;
  revalidatePath("/", "layout");
  redirect("/settings?saved=1");
}
