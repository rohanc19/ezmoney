"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Six fixed destinations, always visible, always in the same order.
// The current one is filled in — he should never have to wonder where
// he is or how to get out.
//
// Icons are inline SVG, not emoji: his old Windows PC has gaps in its
// emoji font and draws tofu boxes instead.

export type NavIcon = "home" | "new" | "clients" | "labour" | "expenses" | "settings";

const paths: Record<NavIcon, React.ReactNode> = {
  home: <path d="M3 10.5 12 3l9 7.5M5.5 9.5V20h13V9.5M9.5 20v-6h5v6" />,
  new: <path d="M12 5v14M5 12h14" />,
  clients: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20c0-3.2 2.7-5 6-5s6 1.8 6 5" />
      <path d="M16 5.5a3 3 0 0 1 0 5.4M17.5 14.6c2 .7 3.5 2.2 3.5 4.4" />
    </>
  ),
  labour: (
    <>
      <path d="M4 14a8 8 0 0 1 16 0" />
      <path d="M2.5 14h19" />
      <path d="M12 6v8M8.5 7.2 10 14M15.5 7.2 14 14" />
      <path d="M6 18h12" />
    </>
  ),
  expenses: (
    <>
      <path d="M6 3.5v17l2-1.4 2 1.4 2-1.4 2 1.4 2-1.4 2 1.4v-17l-2 1.4-2-1.4-2 1.4-2-1.4-2 1.4z" />
      <path d="M9.5 9h5M9.5 13h5" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5v2.2M12 19.3v2.2M21.5 12h-2.2M4.7 12H2.5M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6M18.7 18.7l-1.6-1.6M6.9 6.9 5.3 5.3" />
    </>
  ),
};

export default function NavBar({
  items,
}: {
  items: { href: string; label: string; icon: NavIcon }[];
}) {
  const pathname = usePathname();

  return (
    // Solid white, not translucent + blurred: a backdrop-filter is
    // re-computed on every scroll frame, and his PC would do that in software.
    <nav className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white">
      <div className="mx-auto flex max-w-3xl">
        {items.map((i) => {
          const active = i.href === "/" ? pathname === "/" : pathname.startsWith(i.href);
          return (
            <Link
              key={i.href}
              href={i.href}
              aria-current={active ? "page" : undefined}
              className={`relative flex min-h-[62px] flex-1 flex-col items-center justify-center gap-0.5 px-0.5 text-[0.64rem] font-bold leading-tight ${
                active ? "text-accent" : "text-stone-500"
              }`}
            >
              {active && <span className="absolute inset-x-3 top-0 h-[3px] rounded-b bg-accent" />}
              <svg
                aria-hidden
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={active ? 2.2 : 1.9}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-[21px] w-[21px]"
              >
                {paths[i.icon]}
              </svg>
              <span className="w-full truncate text-center">{i.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
