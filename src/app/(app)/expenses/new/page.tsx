import Link from "next/link";
import ExpenseForm from "@/components/ExpenseForm";
import { getDict } from "@/lib/i18n";
import { todayISO } from "@/lib/format";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function NewExpensePage() {
  const t = getDict();
  const supabase = supabaseServer();
  const { data: clients } = await supabase.from("clients").select("id, name").order("name");

  return (
    <main>
      <div className="mb-4 flex items-center gap-3">
        <Link href="/expenses" className="btn-secondary px-3">
          ← {t.back}
        </Link>
        <h1 className="text-2xl font-bold">{t.addExpense}</h1>
      </div>
      <ExpenseForm t={t} today={todayISO()} clients={clients ?? []} />
    </main>
  );
}
