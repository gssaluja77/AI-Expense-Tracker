"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { LogOut, Waves } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { signOutAction } from "@/actions/auth";

interface MobileTopBarProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

export function MobileTopBar({ user }: MobileTopBarProps) {
  const [accountOpen, setAccountOpen] = useState(false);
  const accountWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!accountOpen) return;
    const close = (e: MouseEvent | TouchEvent) => {
      const el = accountWrapRef.current;
      if (el && !el.contains(e.target as Node)) {
        setAccountOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAccountOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close, { passive: true });
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("touchstart", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [accountOpen]);

  return (
    <header className="fixed inset-x-0 top-0 z-20 bg-white/95 pt-[max(0.75rem,env(safe-area-inset-top,0px))] backdrop-blur md:hidden dark:bg-slate-950/95">
      <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white shadow shadow-brand-600/30">
              <Waves className="h-4 w-4" />
            </span>
            <span className="text-base font-semibold tracking-tight">
              TrackFlow
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle className="h-9 w-9" />
            <div className="relative" ref={accountWrapRef}>
              <button
                type="button"
                onClick={() => setAccountOpen((o) => !o)}
                aria-expanded={accountOpen}
                aria-haspopup="menu"
                className="rounded-full ring-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:ring-offset-slate-950"
              >
                {user.image ? (
                  <Image
                    src={user.image}
                    alt={user.name || "User avatar"}
                    width={32}
                    height={32}
                    className="h-8 w-8 rounded-full object-cover"
                  />
                ) : (
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white">
                    {(user.name || user.email || "?").charAt(0).toUpperCase()}
                  </span>
                )}
              </button>
              {accountOpen ? (
                <div
                  className="absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border border-slate-200 bg-white py-2 shadow-lg dark:border-slate-700 dark:bg-slate-900"
                  role="menu"
                >
                  <div className="border-b border-slate-100 px-3 pb-2 dark:border-slate-800">
                    <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                      {user.name || user.email || "Account"}
                    </p>
                    {user.email ? (
                      <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                        {user.email}
                      </p>
                    ) : null}
                  </div>
                  <form action={signOutAction} className="px-2 pt-2">
                    <button
                      type="submit"
                      className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 active:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign out
                    </button>
                  </form>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
