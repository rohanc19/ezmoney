import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Manual backup: download any table as CSV. RLS means the user only
// ever gets their own rows.
// Every table he owns. If something is added to the schema and not added
// here, his backup silently stops being a backup.
const TABLES: Record<string, { table: string; order: string }> = {
  documents: { table: "documents", order: "doc_date" },
  line_items: { table: "line_items", order: "document_id" },
  payments: { table: "payments", order: "paid_on" },
  expenses: { table: "expenses", order: "date" },
  clients: { table: "clients", order: "name" },
  workers: { table: "workers", order: "name" },
  worker_entries: { table: "worker_entries", order: "entry_date" },
  shops: { table: "shops", order: "name" },
  item_prices: { table: "item_prices", order: "seen_on" },
  rate_card_items: { table: "rate_card_items", order: "description" },
  business_profile: { table: "business_profile", order: "user_id" },
};

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    if (v === null || v === undefined) return "";
    const s = typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(",")),
  ].join("\n");
}

export async function GET(request: NextRequest) {
  const what = request.nextUrl.searchParams.get("what") ?? "";

  const supabase = supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not logged in" }, { status: 401 });

  const today = new Date().toISOString().slice(0, 10);

  // One file with everything in it. A pile of CSVs is for his accountant;
  // this is the one to keep if he only keeps one, because it can actually
  // be read back into a database.
  if (what === "all") {
    const dump: Record<string, unknown[]> = {};
    for (const [key, s] of Object.entries(TABLES)) {
      const { data } = await supabase.from(s.table).select("*").order(s.order);
      dump[key] = data ?? [];
    }
    const body = JSON.stringify(
      { exported_at: new Date().toISOString(), app: "EzMoney", tables: dump },
      null,
      2
    );
    return new NextResponse(body, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="ezmoney-backup-${today}.json"`,
      },
    });
  }

  const spec = TABLES[what];
  if (!spec) return NextResponse.json({ error: "unknown export" }, { status: 400 });

  const { data, error } = await supabase.from(spec.table).select("*").order(spec.order);
  if (error) return NextResponse.json({ error: "export failed" }, { status: 500 });

  const csv = toCsv((data ?? []) as Record<string, unknown>[]);
  return new NextResponse("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ezmoney-${what}-${today}.csv"`,
    },
  });
}
