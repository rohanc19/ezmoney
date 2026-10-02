import NavBar, { type NavIcon } from "@/components/NavBar";
import { getDict } from "@/lib/i18n";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const t = getDict();
  // Five, and they are his day in order: who owes me, write a bill, write
  // up the evening, pay the men, everything else.
  //
  // It was seven. "Expenses" was a junk drawer — a second way to add a
  // shop run, the only door to the shop lists and the price book, a year
  // total that /month already gave, and a flat list of every expense ever
  // — under a word that described only the last and least useful of them.
  // "Month" is something he reads once a month, which is not what a
  // permanent tab is for; it hangs off /day now, where the money is.
  //
  // Seven also did not fit: at 360px, the commonest Android width, there
  // is 47.4px for a label and "Expenses" measures 47.8px in Manrope bold,
  // so it truncated. Six or fewer fits every phone down to 320px.
  const items: { href: string; label: string; icon: NavIcon }[] = [
    { href: "/", label: t.home, icon: "home" },
    { href: "/new", label: t.newDoc, icon: "new" },
    { href: "/day", label: t.today, icon: "today" },
    { href: "/labour", label: t.labour, icon: "labour" },
    { href: "/settings", label: t.settings, icon: "settings" },
  ];
  return (
    <div className="mx-auto min-h-screen max-w-3xl">
      <div className="rise px-4 pb-28 pt-4">{children}</div>
      <NavBar items={items} />
    </div>
  );
}
