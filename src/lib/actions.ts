"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { computeTotals } from "@/lib/gst";
import { supabaseServer } from "@/lib/supabase/server";
import { STATES } from "@/lib/types";

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
  hsn_sac: string;
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
        hsn_sac: String(o.hsn_sac ?? "").trim(),
      };
    })
    .filter((i) => i.description.length > 0);
}

function stateName(code: string): string {
  return STATES.find((s) => s.code === code)?.name ?? "";
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
      const code = String(formData.get("new_client_state") ?? "").trim();
      const { data: c, error } = await supabase
        .from("clients")
        .insert({
          user_id: user.id,
          name,
          phone: String(formData.get("new_client_phone") ?? "").trim(),
          address: String(formData.get("new_client_address") ?? "").trim(),
          state_code: code,
          state_name: stateName(code),
        })
        .select("id")
        .single();
      if (error) throw error;
      client_id = c.id;
    } else {
      client_id = null;
    }
  }

  const { data: profile } = await supabase
    .from("business_profile")
    .select("gst_enabled, gst_rate, state_code, default_hsn_sac")
    .eq("user_id", user.id)
    .maybeSingle();

  // Place of supply: the client's state, falling back to his own.
  let placeOfSupply = profile?.state_code ?? "";
  if (client_id) {
    const { data: client } = await supabase
      .from("clients")
      .select("state_code")
      .eq("id", client_id)
      .maybeSingle();
    if (client?.state_code) placeOfSupply = client.state_code;
  }

  const gstRate = Number(profile?.gst_rate ?? 0.18);
  const taxLines = items.map((i) => ({
    description: i.description,
    qty: i.qty,
    unit: i.unit,
    rate: i.rate,
    amount: i.qty * i.rate,
    hsn_sac: i.hsn_sac || (profile?.default_hsn_sac ?? ""),
    gst_rate: gstRate,
  }));

  const totals = computeTotals(taxLines, {
    gstEnabled: profile?.gst_enabled ?? false,
    sellerStateCode: profile?.state_code ?? "",
    placeOfSupplyCode: placeOfSupply,
    fallbackRate: gstRate,
  });

  const docFields = {
    doc_date,
    client_id,
    site_job,
    status,
    subtotal: totals.subtotal,
    taxable_value: totals.taxableValue,
    gst_amount: totals.gstAmount,
    cgst_amount: totals.cgst,
    sgst_amount: totals.sgst,
    igst_amount: totals.igst,
    place_of_supply: placeOfSupply,
    total: totals.total,
    notes,
  };

  let docId = id;
  if (!id) {
    const { data: serial, error: serialError } = await supabase.rpc("next_serial", {
      p_type: type,
    });
    if (serialError) throw serialError;
    const { data: doc, error } = await supabase
      .from("documents")
      .insert({ user_id: user.id, type, serial_no: serial as string, ...docFields })
      .select("id")
      .single();
    if (error) throw error;
    docId = doc.id;
  } else {
    const { error } = await supabase
      .from("documents")
      .update(docFields)
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) throw error;
    await supabase.from("line_items").delete().eq("document_id", id).eq("user_id", user.id);
  }

  if (taxLines.length > 0) {
    const { error } = await supabase.from("line_items").insert(
      taxLines.map((i, idx) => ({
        user_id: user.id,
        document_id: docId,
        position: idx + 1,
        description: i.description,
        qty: i.qty,
        unit: i.unit,
        rate: i.rate,
        amount: i.amount,
        hsn_sac: i.hsn_sac,
        gst_rate: i.gst_rate,
      }))
    );
    if (error) throw error;

    // Learn his rates: anything billed gets remembered for next time.
    await learnRateCard(
      user.id,
      taxLines.map((i) => ({
        description: i.description,
        unit: i.unit,
        rate: i.rate,
        hsn_sac: i.hsn_sac,
      }))
    );
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
      taxable_value: est.taxable_value,
      gst_amount: est.gst_amount,
      cgst_amount: est.cgst_amount,
      sgst_amount: est.sgst_amount,
      igst_amount: est.igst_amount,
      place_of_supply: est.place_of_supply,
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
        hsn_sac: i.hsn_sac ?? "",
        gst_rate: i.gst_rate ?? 0,
      }))
    );
    if (e5) throw e5;
  }

  revalidatePath("/");
  redirect(`/documents/${inv.id}/edit`);
}

// ---------- rate card ----------

async function learnRateCard(
  userId: string,
  items: { description: string; unit: string; rate: number; hsn_sac: string }[]
) {
  const supabase = supabaseServer();
  for (const i of items) {
    if (!i.description || i.rate <= 0) continue;
    const { data: existing } = await supabase
      .from("rate_card_items")
      .select("id, times_used")
      .eq("user_id", userId)
      .eq("description", i.description)
      .maybeSingle();
    if (existing) {
      await supabase
        .from("rate_card_items")
        .update({
          rate: i.rate,
          unit: i.unit,
          times_used: (existing.times_used ?? 0) + 1,
          last_used_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
    } else {
      await supabase.from("rate_card_items").insert({
        user_id: userId,
        description: i.description,
        unit: i.unit,
        rate: i.rate,
        hsn_sac: i.hsn_sac,
        times_used: 1,
        last_used_at: new Date().toISOString(),
      });
    }
  }
}

export async function saveRateCardItem(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = String(formData.get("id") ?? "");
  const row = {
    description: String(formData.get("description") ?? "").trim(),
    unit: String(formData.get("unit") ?? "Nos"),
    rate: Number(formData.get("rate")) || 0,
    hsn_sac: String(formData.get("hsn_sac") ?? "").trim(),
    category: String(formData.get("category") ?? "Work"),
  };
  if (!row.description) redirect("/rate-card");

  if (id) {
    const { error } = await supabase
      .from("rate_card_items")
      .update(row)
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("rate_card_items")
      .upsert({ user_id: user.id, ...row }, { onConflict: "user_id,description" });
    if (error) throw error;
  }
  revalidatePath("/rate-card");
  redirect("/rate-card?saved=1");
}

export async function deleteRateCardItem(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = String(formData.get("id") ?? "");
  const { error } = await supabase
    .from("rate_card_items")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw error;
  revalidatePath("/rate-card");
  redirect("/rate-card");
}

// ---------- expenses ----------

async function storeReceipt(userId: string, file: File | null): Promise<string | null> {
  if (!file || file.size === 0) return null;
  const supabase = supabaseServer();
  const ext = file.type === "image/png" ? "png" : "jpg";
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage
    .from("receipts")
    .upload(path, file, { contentType: file.type || "image/jpeg", upsert: false });
  if (error) {
    console.error("receipt upload failed", error);
    return null;
  }
  return path;
}

export async function saveExpense(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = String(formData.get("id") ?? "");

  const photo = formData.get("receipt");
  const uploadedPath = await storeReceipt(user.id, photo instanceof File ? photo : null);
  const removePhoto = formData.get("remove_receipt") === "1";
  const existingPath = String(formData.get("existing_receipt") ?? "") || null;

  let receipt_path: string | null = existingPath;
  if (uploadedPath) receipt_path = uploadedPath;
  if (removePhoto && !uploadedPath) receipt_path = null;

  if ((removePhoto || uploadedPath) && existingPath) {
    await supabase.storage.from("receipts").remove([existingPath]);
  }

  const row = {
    date: String(formData.get("date") ?? "") || new Date().toISOString().slice(0, 10),
    category: String(formData.get("category") ?? "Materials"),
    item: String(formData.get("item") ?? "").trim(),
    vendor: String(formData.get("vendor") ?? "").trim(),
    amount: Number(formData.get("amount")) || 0,
    client_id: String(formData.get("client_id") ?? "") || null,
    paid_via: String(formData.get("paid_via") ?? "Cash"),
    notes: String(formData.get("notes") ?? "").trim(),
    receipt_path,
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
  const path = String(formData.get("receipt_path") ?? "");
  if (path) await supabase.storage.from("receipts").remove([path]);
  const { error } = await supabase.from("expenses").delete().eq("id", id).eq("user_id", user.id);
  if (error) throw error;
  revalidatePath("/expenses");
  redirect("/expenses");
}

// ---------- clients ----------

export async function saveClient(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = String(formData.get("id") ?? "");
  const code = String(formData.get("state_code") ?? "").trim();
  const row = {
    name: String(formData.get("name") ?? "").trim(),
    phone: String(formData.get("phone") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim(),
    address: String(formData.get("address") ?? "").trim(),
    notes: String(formData.get("notes") ?? "").trim(),
    state_code: code,
    state_name: stateName(code),
    gstin: String(formData.get("gstin") ?? "").trim() || null,
  };
  if (!row.name) redirect("/clients");

  if (id) {
    const { error } = await supabase
      .from("clients")
      .update(row)
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) throw error;
    revalidatePath(`/clients/${id}`);
    redirect(`/clients/${id}?saved=1`);
  }
  const { data, error } = await supabase
    .from("clients")
    .insert({ user_id: user.id, ...row })
    .select("id")
    .single();
  if (error) throw error;
  revalidatePath("/clients");
  redirect(`/clients/${data.id}?saved=1`);
}

// ---------- business profile ----------

export async function saveProfile(formData: FormData) {
  const { supabase, user } = await requireUser();
  const code = String(formData.get("state_code") ?? "29").trim();
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
    state_code: code,
    state_name: stateName(code) || "Karnataka",
    default_hsn_sac: String(formData.get("default_hsn_sac") ?? "").trim(),
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
