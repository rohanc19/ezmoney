import Link from "next/link";
import { getDict } from "@/lib/i18n";

export default function NewChooserPage() {
  const t = getDict();
  return (
    <main>
      <h1 className="text-2xl font-extrabold">{t.whatToMake}</h1>
      <div className="mt-6 space-y-4">
        <Link
          href="/documents/new?type=estimate"
          className="hero block rounded-3xl p-6 text-white shadow-lift"
        >
          <span className="text-2xl font-extrabold">{t.newEstimate}</span>
          <p className="mt-1 text-teal-100">{t.estimateHint}</p>
        </Link>
        <Link href="/documents/new?type=invoice" className="card block p-6">
          <span className="text-2xl font-extrabold">{t.newInvoice}</span>
          <p className="mt-1 text-stone-500">{t.invoiceHint}</p>
        </Link>
      </div>
    </main>
  );
}
