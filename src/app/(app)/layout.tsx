import Link from "next/link";
import { getDict } from "@/lib/i18n";

// Fixed, always-visible navigation: Home, New, Expenses, Settings.
// Bottom bar on phones, same bar centred on desktop. Icons + words.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const t = getDict();
  const items = [
    { href: "/", label: t.home, icon: "🏠" },
    { href: "/new", label: t.newDoc, icon: "➕" },
    { href: "/expenses", label: t.expenses, icon: "🧾" },
    { href: "/settings", label: t.settings, icon: "⚙️" },
  ];
  return (
    <div className="mx-auto min-h-screen max-w-3xl">
      <div className="px-4 pb-28 pt-4">{children}</div>
      <nav className="no-print fixed inset-x-0 bottom-0 border-t border-stone-200 bg-white">
        <div className="mx-auto flex max-w-3xl">
          {items.map((i) => (
            <Link
              key={i.href}
              href={i.href}
              className="flex min-h-[60px] flex-1 flex-col items-center justify-center gap-0.5 text-sm font-medium text-stone-700 active:bg-stone-100"
            >
              <span aria-hidden className="text-xl leading-none">
                {i.icon}
              </span>
              {i.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
