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

export default async function EditExpensePage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { from?: string };
}) {
  const t = getDict();
  const supabase = supabaseServer();
  const [{ data: expense }, { data: clients }, { data: shops }] = await Promise.all([
    supabase.from("expenses").select("*").eq("id", params.id).maybeSingle(),
    supabase.from("clients").select("id, name").order("name"),
    supabase.from("shops").select("id, name, area").order("name"),
  ]);
  if (!expense) notFound();

  const photoUrl = await receiptUrl(expense.receipt_path ?? null);

  // Back to the day he came from. `from` carries it so a line opened on
  // the 3rd does not return him to today.
  const back = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.from ?? "")
    ? `/day?d=${searchParams.from}`
    : `/day?d=${String(expense.date)}`;

  return (
    <main>
      <div className="mb-4 flex items-center gap-3">
        <Link href={back} className="btn-secondary px-3">
          ← {t.back}
        </Link>
        <h1 className="text-2xl font-extrabold">{t.edit}</h1>
      </div>
      <ExpenseForm
        t={t}
        today={todayISO()}
        clients={clients ?? []}
        shops={shops ?? []}
        expense={expense as Expense}
        receiptUrl={photoUrl}
        action={saveExpense}
      />
      <form action={deleteExpense} className="mt-6">
        <input type="hidden" name="id" value={expense.id} />
        <input type="hidden" name="receipt_path" value={expense.receipt_path ?? ""} />
        <input type="hidden" name="from" value={searchParams.from ?? String(expense.date)} />
        <ConfirmButton message={t.confirmDeleteExpense}
                      confirmLabel={t.tapAgain} className="btn-danger w-full">
          {t.delete}
        </ConfirmButton>
      </form>
    </main>
  );
}
