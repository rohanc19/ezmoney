import Link from "next/link";
import { notFound } from "next/navigation";
import ConfirmButton from "@/components/ConfirmButton";
import ExpenseForm from "@/components/ExpenseForm";
import { deleteExpense, saveExpense } from "@/lib/actions";
import { getDict } from "@/lib/i18n";
import { todayISO } from "@/lib/format";
import { receiptUrl } from "@/lib/queries";
import { supabaseServer } from "@/lib/supabase/server";
import type { Expense } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function EditExpensePage({ params }: { params: { id: string } }) {
  const t = getDict();
  const supabase = supabaseServer();
  const [{ data: expense }, { data: clients }] = await Promise.all([
    supabase.from("expenses").select("*").eq("id", params.id).maybeSingle(),
    supabase.from("clients").select("id, name").order("name"),
  ]);
  if (!expense) notFound();

  const photoUrl = await receiptUrl(expense.receipt_path ?? null);

  return (
    <main>
      <div className="mb-4 flex items-center gap-3">
        <Link href="/expenses" className="btn-secondary px-3">
          ← {t.back}
        </Link>
        <h1 className="text-2xl font-extrabold">{t.edit}</h1>
      </div>
      <ExpenseForm
        t={t}
        today={todayISO()}
        clients={clients ?? []}
        expense={expense as Expense}
        receiptUrl={photoUrl}
        action={saveExpense}
      />
      <form action={deleteExpense} className="mt-6">
        <input type="hidden" name="id" value={expense.id} />
        <input type="hidden" name="receipt_path" value={expense.receipt_path ?? ""} />
        <ConfirmButton message={t.confirmDeleteExpense} className="btn-danger w-full">
          🗑 {t.delete}
        </ConfirmButton>
      </form>
    </main>
  );
}
