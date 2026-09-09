import Link from "next/link";
import ExpenseForm from "@/components/ExpenseForm";
import { saveExpense } from "@/lib/actions";
import { getDict } from "@/lib/i18n";
import { todayISO } from "@/lib/format";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function NewExpensePage() {
  const t = getDict();
  const supabase = supabaseServer();
  const [{ data: clients }, { data: shops }] = await Promise.all([
    supabase.from("clients").select("id, name").order("name"),
    supabase.from("shops").select("id, name, area").order("name"),
  ]);

  return (
    <main>
      <div className="mb-4 flex items-center gap-3">
        <Link href="/expenses" className="btn-secondary px-3">
          ← {t.back}
        </Link>
        <h1 className="text-2xl font-extrabold">{t.addExpense}</h1>
      </div>
      <ExpenseForm
        t={t}
        today={todayISO()}
        clients={clients ?? []}
        shops={shops ?? []}
        action={saveExpense}
      />
    </main>
  );
}
