"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { TrackFlowLogo } from "@/components/brand/TrackFlowLogo";
import { NAV_ITEMS } from "@/components/layout/nav-items";
import { signOutAction } from "@/actions/auth";
import { ThemeToggle } from "@/components/ThemeToggle";
import { cn } from "@/lib/utils/cn";

interface SidebarProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-slate-200 bg-white px-4 py-6 dark:border-slate-800 dark:bg-slate-950 md:flex">
      <Link href="/dashboard" className="flex items-center gap-2 px-2">
        <TrackFlowLogo size={36} className="shrink-0 shadow-lg shadow-brand-600/30 rounded-xl" />
        <span className="text-lg font-semibold tracking-tight">TrackFlow</span>
      </Link>

      <nav className="mt-8 flex flex-1 flex-col gap-1">
        {NAV_ITEMS.map(({ href, activePath, label, icon: Icon }) => {
          const match = activePath ?? href;
          const active =
            match === "/dashboard"
              ? pathname === match
              : pathname.startsWith(match);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                active
                  ? "bg-brand-50 text-brand-700 dark:bg-brand-950/50 dark:text-brand-300"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-100"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-4 flex flex-col gap-3 border-t border-slate-200 pt-4 dark:border-slate-800">
        <div className="flex items-center gap-3 px-2">
          <UserAvatar user={user} />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {user.name || user.email || "Account"}
            </p>
            {user.email ? (
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                {user.email}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 px-1">
          <ThemeToggle />
          <form action={signOutAction} className="flex-1">
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}

function UserAvatar({ user }: { user: SidebarProps["user"] }) {
  if (user.image) {
    return (
      <Image
        src={user.image}
        alt={user.name || "User avatar"}
        width={36}
        height={36}
        className="h-9 w-9 rounded-full object-cover"
      />
    );
  }
  const initial = (user.name || user.email || "?").charAt(0).toUpperCase();
  return (
    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white">
      {initial}
    </span>
  );
}
