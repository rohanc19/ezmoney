import { saveExpense } from "@/lib/actions";
import type { Dict } from "@/lib/i18n";
import { EXPENSE_CATEGORIES, PAID_VIA, type Expense } from "@/lib/types";

// Server-rendered form — zero client JS. Works on the oldest of PCs.
export default function ExpenseForm({
  t,
  today,
  clients,
  expense,
}: {
  t: Dict;
  today: string;
  clients: { id: string; name: string }[];
  expense?: Expense | null;
}) {
  return (
    <form action={saveExpense} className="space-y-5">
      {expense && <input type="hidden" name="id" value={expense.id} />}
      <div>
        <label htmlFor="item" className="label">
          {t.item}
        </label>
        <input
          id="item"
          name="item"
          required
          defaultValue={expense?.item ?? ""}
          className="field"
        />
      </div>
      <div>
        <label htmlFor="amount" className="label">
          {t.amount} (₹)
        </label>
        <input
          id="amount"
          name="amount"
          inputMode="decimal"
          required
          defaultValue={expense ? String(expense.amount) : ""}
          className="field"
        />
      </div>
      <div className="flex gap-3">
        <div className="flex-1">
          <label htmlFor="date" className="label">
            {t.date}
          </label>
          <input
            id="date"
            type="date"
            name="date"
            defaultValue={expense?.date ?? today}
            className="field"
          />
        </div>
        <div className="flex-1">
          <label htmlFor="category" className="label">
            {t.category}
          </label>
          <select
            id="category"
            name="category"
            defaultValue={expense?.category ?? "Materials"}
            className="field"
          >
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex gap-3">
        <div className="flex-1">
          <label htmlFor="paid_via" className="label">
            {t.paidVia}
          </label>
          <select
            id="paid_via"
            name="paid_via"
            defaultValue={expense?.paid_via ?? "Cash"}
            className="field"
          >
            {PAID_VIA.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label htmlFor="client_id" className="label">
            {t.forClient}
          </label>
          <select
            id="client_id"
            name="client_id"
            defaultValue={expense?.client_id ?? ""}
            className="field"
          >
            <option value="">—</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label htmlFor="vendor" className="label">
          {t.vendor}
        </label>
        <input id="vendor" name="vendor" defaultValue={expense?.vendor ?? ""} className="field" />
      </div>
      <div>
        <label htmlFor="notes" className="label">
          {t.notes}
        </label>
        <input id="notes" name="notes" defaultValue={expense?.notes ?? ""} className="field" />
      </div>
      <button type="submit" className="btn-primary w-full text-xl">
        {t.save}
      </button>
    </form>
  );
}
