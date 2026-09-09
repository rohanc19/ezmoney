import Link from "next/link";
import WorkerForm from "@/components/WorkerForm";
import { getDict } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default function NewWorkerPage() {
  const t = getDict();
  return (
    <main>
      <div className="mb-4 flex items-center gap-3">
        <Link href="/labour" className="btn-secondary px-3">
          ← {t.back}
        </Link>
        <h1 className="text-2xl font-extrabold">{t.addWorker}</h1>
      </div>
      <WorkerForm t={t} />
    </main>
  );
}
