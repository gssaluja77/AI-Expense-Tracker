"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, PiggyBank, Plus } from "lucide-react";
import type { BudgetSummary } from "@/lib/budgets/queries";
import { BudgetCard } from "./BudgetCard";
import { BudgetFormDialog } from "./BudgetFormDialog";
import { formatMoney } from "./constants";

interface BudgetsViewProps {
  budgets: BudgetSummary[];
  defaultCurrency: string;
}

/**
 * Client orchestrator for the Budgets page. Hosts the new/edit modal,
 * splits active vs archived envelopes, and renders a lightweight summary
 * strip above the grid.
 */
export function BudgetsView({ budgets, defaultCurrency }: BudgetsViewProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BudgetSummary | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const { active, archived, totals } = useMemo(() => {
    const active = budgets.filter((b) => !b.archived);
    const archived = budgets.filter((b) => b.archived);
    const totals = active.reduce(
      (acc, b) => {
        if (b.currencyMismatch) return acc;
        acc.limit += b.limit;
        acc.spent += b.spent;
        return acc;
      },
      { limit: 0, spent: 0 }
    );
    return { active, archived, totals };
  }, [budgets]);

  const overall = totals.limit > 0 ? totals.spent / totals.limit : 0;
  const overallPercent = Math.min(100, Math.round(overall * 100));

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (b: BudgetSummary) => {
    setEditing(b);
    setDialogOpen(true);
  };

  return (
    <div className="mx-auto max-w-6xl">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Budgets</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Set per-category spending limits and watch them update live as you
            transact. We&apos;ll warn you before you overshoot and flag
            anything that already has.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex shrink-0 items-center justify-center gap-2 self-start whitespace-nowrap rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
        >
          <Plus className="h-4 w-4 shrink-0" />
          New budget
        </button>
      </header>

      {active.length > 0 ? (
        <section
          aria-label="Budgets summary"
          className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                This period
              </p>
              <p className="mt-1 text-2xl font-bold tracking-tight">
                {formatMoney(totals.spent, defaultCurrency)}
                <span className="ml-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                  of {formatMoney(totals.limit, defaultCurrency)}
                </span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {active.length} active {active.length === 1 ? "envelope" : "envelopes"}
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-700 dark:text-slate-300">
                {overallPercent}% used
              </p>
            </div>
          </div>
          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className={
                overall > 1
                  ? "h-full rounded-full bg-rose-500"
                  : overall > 0.8
                    ? "h-full rounded-full bg-amber-500"
                    : "h-full rounded-full bg-emerald-500"
              }
              style={{ width: `${overallPercent}%` }}
            />
          </div>
        </section>
      ) : null}

      {active.length === 0 ? (
        <EmptyState onCreate={openCreate} />
      ) : (
        <section className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {active.map((b) => (
            <BudgetCard key={b.id} budget={b} onEdit={openEdit} />
          ))}
        </section>
      )}

      {archived.length > 0 ? (
        <section className="mt-10">
          <button
            type="button"
            onClick={() => setShowArchived((v) => !v)}
            className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
          >
            {showArchived ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            Archived ({archived.length})
          </button>
          {showArchived ? (
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {archived.map((b) => (
                <BudgetCard key={b.id} budget={b} onEdit={openEdit} />
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      <BudgetFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        initial={editing}
        defaultCurrency={defaultCurrency}
      />
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center dark:border-slate-700 dark:bg-slate-900">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-950/50 dark:text-brand-300">
        <PiggyBank className="h-6 w-6" />
      </div>
      <p className="mt-4 text-base font-semibold">No budgets yet</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-slate-600 dark:text-slate-400">
        Create a category envelope to track spending in real time. We&apos;ll
        warn you when you approach the limit.
      </p>
      <button
        type="button"
        onClick={onCreate}
        className="mt-5 inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
      >
        <Plus className="h-4 w-4" />
        Create your first budget
      </button>
    </div>
  );
}
