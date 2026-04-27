import { Sparkles } from "lucide-react";

interface ComingSoonProps {
  title: string;
  description: string;
}

export function ComingSoon({ title, description }: ComingSoonProps) {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{title}</h1>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        {description}
      </p>

      <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center dark:border-slate-700 dark:bg-slate-900">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-950/50 dark:text-brand-300">
          <Sparkles className="h-6 w-6" />
        </div>
        <p className="mt-4 text-base font-semibold">Coming soon</p>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          This module is being wired up next. The schema and APIs that power
          it are already in place.
        </p>
      </div>
    </div>
  );
}
