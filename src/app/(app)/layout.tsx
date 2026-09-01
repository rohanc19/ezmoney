import NavBar from "@/components/NavBar";
import { getDict } from "@/lib/i18n";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const t = getDict();
  const items = [
    { href: "/", label: t.home, icon: "🏠" },
    { href: "/new", label: t.newDoc, icon: "➕" },
    { href: "/clients", label: t.clients, icon: "👥" },
    { href: "/expenses", label: t.expenses, icon: "🧾" },
    { href: "/settings", label: t.settings, icon: "⚙️" },
  ];
  return (
    <div className="mx-auto min-h-screen max-w-3xl">
      <div className="rise px-4 pb-28 pt-4">{children}</div>
      <NavBar items={items} />
    </div>
  );
}
