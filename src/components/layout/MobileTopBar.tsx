"use client";

import Link from "next/link";
import Image from "next/image";
import { Waves } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

interface MobileTopBarProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

export function MobileTopBar({ user }: MobileTopBarProps) {
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur md:hidden dark:border-slate-800 dark:bg-slate-950/90">
      <Link href="/dashboard" className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white shadow shadow-brand-600/30">
          <Waves className="h-4 w-4" />
        </span>
        <span className="text-base font-semibold tracking-tight">TrackFlow</span>
      </Link>
      <div className="flex items-center gap-2">
        <ThemeToggle className="h-9 w-9" />
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
      </div>
    </header>
  );
}
