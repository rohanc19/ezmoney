import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Manual backup: download any table as CSV. RLS means the user only
// ever gets their own rows.
const TABLES: Record<string, { table: string; order: string }> = {
  documents: { table: "documents", order: "doc_date" },
  line_items: { table: "line_items", order: "document_id" },
  expenses: { table: "expenses", order: "date" },
  clients: { table: "clients", order: "name" },
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
  const spec = TABLES[what];
  if (!spec) return NextResponse.json({ error: "unknown export" }, { status: 400 });

  const supabase = supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not logged in" }, { status: 401 });

  const { data, error } = await supabase.from(spec.table).select("*").order(spec.order);
  if (error) return NextResponse.json({ error: "export failed" }, { status: 500 });

  const csv = toCsv((data ?? []) as Record<string, unknown>[]);
  const today = new Date().toISOString().slice(0, 10);
  return new NextResponse("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ezmoney-${what}-${today}.csv"`,
    },
  });
}
