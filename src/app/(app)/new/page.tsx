import Link from "next/link";
import { getDict } from "@/lib/i18n";

export default function NewChooserPage() {
  const t = getDict();
  return (
    <main>
      <h1 className="text-2xl font-bold">{t.whatToMake}</h1>
      <div className="mt-6 space-y-4">
        <Link
          href="/documents/new?type=estimate"
          className="block rounded-2xl bg-accent p-6 text-white shadow-sm active:bg-accent-dark"
        >
          <span className="text-2xl font-bold">{t.newEstimate}</span>
          <p className="mt-1 text-teal-100">{t.estimateHint}</p>
        </Link>
        <Link
          href="/documents/new?type=invoice"
          className="block rounded-2xl border-2 border-stone-300 bg-white p-6 shadow-sm active:bg-stone-100"
        >
          <span className="text-2xl font-bold">{t.newInvoice}</span>
          <p className="mt-1 text-stone-500">{t.invoiceHint}</p>
        </Link>
      </div>
    </main>
  );
}
