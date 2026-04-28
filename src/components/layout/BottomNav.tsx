"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/components/layout/nav-items";
import { cn } from "@/lib/utils/cn";

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="safe-area-bottom fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/90 backdrop-blur md:hidden dark:border-slate-800 dark:bg-slate-950/90"
    >
      <ul className="mx-auto flex max-w-screen-sm items-stretch justify-between px-2">
        {NAV_ITEMS.map(({ href, activePath, label, icon: Icon }) => {
          const match = activePath ?? href;
          const active =
            match === "/dashboard"
              ? pathname === match
              : pathname.startsWith(match);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-2 py-2 text-[11px] font-medium transition",
                  active
                    ? "text-brand-600 dark:text-brand-300"
                    : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                )}
              >
                <Icon className="h-5 w-5" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
