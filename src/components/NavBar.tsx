"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Five fixed destinations, always visible, always in the same order.
// The current one is filled in — he should never have to wonder where
// he is or how to get out.
export default function NavBar({
  items,
}: {
  items: { href: string; label: string; icon: string }[];
}) {
  const pathname = usePathname();

  return (
    <nav className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-3xl">
        {items.map((i) => {
          const active = i.href === "/" ? pathname === "/" : pathname.startsWith(i.href);
          return (
            <Link
              key={i.href}
              href={i.href}
              aria-current={active ? "page" : undefined}
              className={`relative flex min-h-[62px] flex-1 flex-col items-center justify-center gap-0.5 text-[0.78rem] font-bold ${
                active ? "text-accent" : "text-stone-500"
              }`}
            >
              {active && (
                <span className="absolute inset-x-4 top-0 h-[3px] rounded-b bg-accent" />
              )}
              <span aria-hidden className="text-lg leading-none">
                {i.icon}
              </span>
              {i.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
