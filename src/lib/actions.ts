"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { computeServiceCharge, computeTotals } from "@/lib/gst";
import { itemKey } from "@/lib/prices";
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
    .select("gst_enabled, gst_rate, state_code, default_hsn_sac, service_charge_label")
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

  // Service charge — his fee for the job, on top of the items.
  const scModeRaw = String(formData.get("service_charge_mode") ?? "none");
  const service_charge_mode = ["percent", "amount"].includes(scModeRaw) ? scModeRaw : "none";
  const service_charge_value = Math.max(0, Number(formData.get("service_charge_value")) || 0);
  const service_charge_label =
    String(formData.get("service_charge_label") ?? "").trim() ||
    profile?.service_charge_label ||
    "Service Charge";

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

  const itemsSubtotal = taxLines.reduce((s, i) => s + i.amount, 0);
  const service_charge_amount = computeServiceCharge(
    itemsSubtotal,
    service_charge_mode,
    service_charge_value
  );

  const totals = computeTotals(taxLines, {
    gstEnabled: profile?.gst_enabled ?? false,
    sellerStateCode: profile?.state_code ?? "",
    placeOfSupplyCode: placeOfSupply,
    fallbackRate: gstRate,
    serviceCharge: service_charge_amount,
  });

  const docFields = {
    doc_date,
    client_id,
    site_job,
    status,
    service_charge_mode,
    service_charge_value,
    service_charge_amount,
    service_charge_label,
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
      service_charge_mode: est.service_charge_mode ?? "none",
      service_charge_value: est.service_charge_value ?? 0,
      service_charge_amount: est.service_charge_amount ?? 0,
      service_charge_label: est.service_charge_label ?? "Service Charge",
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
    default_service_charge_percent: Number(formData.get("default_service_charge_percent")) || 0,
    service_charge_label:
      String(formData.get("service_charge_label") ?? "").trim() || "Service Charge",
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

// ---------- labour: the people he hires ----------

export async function saveWorker(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = String(formData.get("id") ?? "");
  const row = {
    name: String(formData.get("name") ?? "").trim(),
    phone: String(formData.get("phone") ?? "").trim(),
    skill: String(formData.get("skill") ?? "Helper"),
    daily_rate: Number(formData.get("daily_rate")) || 0,
    address: String(formData.get("address") ?? "").trim(),
    notes: String(formData.get("notes") ?? "").trim(),
    active: formData.get("active") !== "off",
  };
  if (!row.name) redirect("/labour");

  if (id) {
    const { error } = await supabase
      .from("workers")
      .update(row)
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) throw error;
    revalidatePath(`/labour/${id}`);
    redirect(`/labour/${id}?saved=1`);
  }
  const { data, error } = await supabase
    .from("workers")
    .insert({ user_id: user.id, ...row })
    .select("id")
    .single();
  if (error) throw error;
  revalidatePath("/labour");
  redirect(`/labour/${data.id}?saved=1`);
}

export async function deleteWorker(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = String(formData.get("id") ?? "");
  // The entries go with the person (cascade in the schema).
  const { error } = await supabase.from("workers").delete().eq("id", id).eq("user_id", user.id);
  if (error) throw error;
  revalidatePath("/labour");
  redirect("/labour");
}

/**
 * One line in a person's book. Work rows carry days x rate; payment and
 * advance rows carry the money handed over. Either way `amount` holds the
 * rupee figure, so a balance is a single sum.
 */
export async function saveWorkerEntry(formData: FormData) {
  const { supabase, user } = await requireUser();
  const worker_id = String(formData.get("worker_id") ?? "");
  if (!worker_id) redirect("/labour");

  const kindRaw = String(formData.get("kind") ?? "work");
  const kind = ["work", "payment", "advance"].includes(kindRaw) ? kindRaw : "work";
  const entry_date =
    String(formData.get("entry_date") ?? "") || new Date().toISOString().slice(0, 10);

  let days = 0;
  let rate = 0;
  let amount = 0;
  if (kind === "work") {
    days = Number(formData.get("days")) || 0;
    rate = Number(formData.get("rate")) || 0;
    // A typed total wins over the arithmetic — some jobs are a lump sum.
    const typed = Number(formData.get("amount")) || 0;
    amount = typed > 0 ? typed : days * rate;
  } else {
    amount = Number(formData.get("amount")) || 0;
  }
  if (amount <= 0) redirect(`/labour/${worker_id}`);

  const { error } = await supabase.from("worker_entries").insert({
    user_id: user.id,
    worker_id,
    entry_date,
    kind,
    days,
    rate,
    site_job: String(formData.get("site_job") ?? "").trim(),
    client_id: String(formData.get("client_id") ?? "") || null,
    paid_via: kind === "work" ? "Cash" : String(formData.get("paid_via") ?? "Cash"),
    amount: Math.round(amount * 100) / 100,
    notes: String(formData.get("notes") ?? "").trim(),
  });
  if (error) throw error;

  revalidatePath(`/labour/${worker_id}`);
  revalidatePath("/labour");
  redirect(`/labour/${worker_id}?saved=1`);
}

export async function deleteWorkerEntry(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = String(formData.get("id") ?? "");
  const worker_id = String(formData.get("worker_id") ?? "");
  const { error } = await supabase
    .from("worker_entries")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw error;
  revalidatePath(`/labour/${worker_id}`);
  redirect(`/labour/${worker_id}`);
}

// ---------- bill scanner ----------

/**
 * Runs one tiny live request against the scanner and reports back in
 * plain words. It is the difference between "not set up yet" and knowing
 * that billing needs switching on in Google Cloud.
 */
export async function checkScanner() {
  await requireUser();
  const { probeProvider } = await import("@/lib/scan/providers");
  const status = await probeProvider();
  cookies().set("scan_check", JSON.stringify(status), { maxAge: 300, path: "/" });
  redirect("/settings?scan=1#scanner");
}

// ---------- shops & prices ----------

export async function saveShop(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = String(formData.get("id") ?? "");
  const row = {
    name: String(formData.get("name") ?? "").trim(),
    area: String(formData.get("area") ?? "").trim(),
    phone: String(formData.get("phone") ?? "").trim(),
    address: String(formData.get("address") ?? "").trim(),
    notes: String(formData.get("notes") ?? "").trim(),
  };
  if (!row.name) redirect("/shops");

  if (id) {
    const { error } = await supabase
      .from("shops")
      .update(row)
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) throw error;
    revalidatePath(`/shops/${id}`);
    redirect(`/shops/${id}?saved=1`);
  }
  const { data, error } = await supabase
    .from("shops")
    .insert({ user_id: user.id, ...row })
    .select("id")
    .single();
  if (error) throw error;
  revalidatePath("/shops");
  redirect(`/shops/${data.id}?saved=1`);
}

export async function deleteShop(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = String(formData.get("id") ?? "");
  const { error } = await supabase.from("shops").delete().eq("id", id).eq("user_id", user.id);
  if (error) throw error;
  revalidatePath("/shops");
  redirect("/shops");
}

/** One price, seen today (or on a day he picks), at one shop. */
export async function savePrice(formData: FormData) {
  const { supabase, user } = await requireUser();
  const shop_id = String(formData.get("shop_id") ?? "");
  const item = String(formData.get("item") ?? "").trim();
  const rate = Number(formData.get("rate")) || 0;
  if (!shop_id || !item || rate <= 0) redirect(shop_id ? `/shops/${shop_id}` : "/shops");

  const { error } = await supabase.from("item_prices").insert({
    user_id: user.id,
    shop_id,
    item,
    item_key: itemKey(item),
    unit: String(formData.get("unit") ?? "Nos"),
    rate,
    seen_on: String(formData.get("seen_on") ?? "") || new Date().toISOString().slice(0, 10),
    source: "manual",
    notes: String(formData.get("notes") ?? "").trim(),
  });
  if (error) throw error;
  revalidatePath(`/shops/${shop_id}`);
  redirect(`/shops/${shop_id}?saved=1`);
}

export async function deletePrice(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = String(formData.get("id") ?? "");
  const shop_id = String(formData.get("shop_id") ?? "");
  const { error } = await supabase
    .from("item_prices")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw error;
  revalidatePath(`/shops/${shop_id}`);
  redirect(`/shops/${shop_id}`);
}

/**
 * The one that makes the price book worth having: the lines just read off
 * a photographed supplier bill, saved as today's prices at that shop, in
 * one tap. A price book nobody fills is a price book nobody reads.
 */
export async function savePricesFromScan(payload: {
  shopId: string;
  newShopName: string;
  newShopArea: string;
  seenOn: string;
  items: { item: string; unit: string; rate: number }[];
}): Promise<{ saved: number; shopName: string }> {
  const { supabase, user } = await requireUser();

  let shopId = payload.shopId;
  let shopName = "";
  if (shopId === "__new" || !shopId) {
    const name = payload.newShopName.trim();
    if (!name) return { saved: 0, shopName: "" };

    // He may have bought here before under the same name. Reuse that shop
    // rather than upserting over it — an upsert would blank the area he
    // typed in the first time.
    const { data: existing } = await supabase
      .from("shops")
      .select("id, name")
      .eq("user_id", user.id)
      .eq("name", name)
      .maybeSingle();

    if (existing) {
      shopId = existing.id;
      shopName = existing.name;
    } else {
      const { data: shop, error } = await supabase
        .from("shops")
        .insert({ user_id: user.id, name, area: payload.newShopArea.trim() })
        .select("id, name")
        .single();
      if (error) throw error;
      shopId = shop.id;
      shopName = shop.name;
    }
  } else {
    const { data: shop } = await supabase
      .from("shops")
      .select("name")
      .eq("id", shopId)
      .maybeSingle();
    shopName = shop?.name ?? "";
  }

  const rows = payload.items
    .filter((i) => i.item.trim().length > 1 && Number(i.rate) > 0)
    .map((i) => ({
      user_id: user.id,
      shop_id: shopId,
      item: i.item.trim().slice(0, 120),
      item_key: itemKey(i.item),
      unit: i.unit || "Nos",
      rate: Number(i.rate),
      seen_on: payload.seenOn || new Date().toISOString().slice(0, 10),
      source: "scan",
    }));
  if (rows.length === 0) return { saved: 0, shopName };

  const { error } = await supabase.from("item_prices").insert(rows);
  if (error) throw error;

  revalidatePath("/shops");
  return { saved: rows.length, shopName };
}
