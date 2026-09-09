import Link from "next/link";
import { notFound } from "next/navigation";
import WorkerForm from "@/components/WorkerForm";
import { getDict } from "@/lib/i18n";
import { supabaseServer } from "@/lib/supabase/server";
import type { Worker } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function EditWorkerPage({ params }: { params: { id: string } }) {
  const t = getDict();
  const supabase = supabaseServer();
  const { data: worker } = await supabase
    .from("workers")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();
  if (!worker) notFound();

  return (
    <main>
      <div className="mb-4 flex items-center gap-3">
        <Link href={`/labour/${worker.id}`} className="btn-secondary px-3">
          ← {t.back}
        </Link>
        <h1 className="truncate text-2xl font-extrabold">{t.edit}</h1>
      </div>
      <WorkerForm t={t} worker={worker as Worker} />
    </main>
  );
}
