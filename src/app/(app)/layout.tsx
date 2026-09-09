import NavBar, { type NavIcon } from "@/components/NavBar";
import { getDict } from "@/lib/i18n";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const t = getDict();
  const items: { href: string; label: string; icon: NavIcon }[] = [
    { href: "/", label: t.home, icon: "home" },
    { href: "/new", label: t.newDoc, icon: "new" },
    { href: "/clients", label: t.clients, icon: "clients" },
    { href: "/labour", label: t.labour, icon: "labour" },
    { href: "/expenses", label: t.expenses, icon: "expenses" },
    { href: "/settings", label: t.settings, icon: "settings" },
  ];
  return (
    <div className="mx-auto min-h-screen max-w-3xl">
      <div className="rise px-4 pb-28 pt-4">{children}</div>
      <NavBar items={items} />
    </div>
  );
}
