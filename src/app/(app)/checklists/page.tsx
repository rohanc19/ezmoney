import Link from "next/link";
import { createFromTemplate } from "@/lib/actions";
import { formatDate } from "@/lib/format";
import { getDict } from "@/lib/i18n";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// The sections he works in, each a fixed set of materials. Tapping one
// makes a list he puts quantities on and hands to the shop.

export default async function ChecklistsPage() {
  const t = getDict();
  const supabase = supabaseServer();

  const [{ data: rows }, { data: counts }] = await Promise.all([
    supabase
      .from("checklists")
      .select("id, name, is_template, site_job, list_date, clients(name)")
      .order("is_template", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("checklist_items").select("checklist_id"),
  ]);

  const itemCount = new Map<string, number>();
  for (const c of counts ?? []) {
    itemCount.set(c.checklist_id, (itemCount.get(c.checklist_id) ?? 0) + 1);
  }

  const all = (rows ?? []) as unknown as {
    id: string;
    name: string;
    is_template: boolean;
    site_job: string;
    list_date: string;
    clients?: { name: string } | null;
  }[];
  const templates = all.filter((r) => r.is_template);
  const lists = all.filter((r) => !r.is_template);

  return (
    <main>
      <h1 className="text-2xl font-extrabold">{t.checklists}</h1>
      <p className="mt-1 text-sm text-stone-500">{t.checklistsHint}</p>

      <h2 className="eyebrow mt-6">{t.sections}</h2>
      <ul className="mt-2 space-y-2">
        {templates.map((tpl) => (
          <li key={tpl.id}>
            <form action={createFromTemplate}>
              <input type="hidden" name="template_id" value={tpl.id} />
              <button
                type="submit"
                className="card flex w-full items-center justify-between gap-3 p-4 text-left"
              >
                <span className="min-w-0">
                  <span className="block font-extrabold">{tpl.name}</span>
                  <span className="block text-sm text-stone-500">
                    {t.itemsWanted.replace("{n}", String(itemCount.get(tpl.id) ?? 0))}
                  </span>
                </span>
                <span className="shrink-0 text-sm font-bold text-accent">{t.makeList} →</span>
              </button>
            </form>
          </li>
        ))}
      </ul>

      <h2 className="eyebrow mt-7">{t.yourLists}</h2>
      {lists.length === 0 ? (
        <p className="card mt-2 p-6 text-center text-stone-600">{t.noListsYet}</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {lists.map((l) => (
            <li key={l.id}>
              <Link href={`/checklists/${l.id}`} className="card block p-4">
                <span className="block font-bold">{l.name}</span>
                <span className="mt-0.5 block truncate text-sm text-stone-500">
                  {[l.clients?.name, l.site_job].filter(Boolean).join(" · ") || "—"}
                  {" · "}
                  {formatDate(l.list_date)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
