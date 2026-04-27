"use client";

import { useState, useTransition } from "react";
import {
  Archive,
  ArchiveRestore,
  MoreHorizontal,
  Pencil,
  Trash2,
  TrendingUp,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { BudgetSummary } from "@/lib/budgets/queries";
import { describePeriod } from "@/lib/budgets/period";
import { deleteBudget, setBudgetArchived } from "@/actions/budgets";
import { formatMoney } from "./constants";

interface BudgetCardProps {
  budget: BudgetSummary;
  onEdit: (budget: BudgetSummary) => void;
}

/**
 * Single budget envelope with a live progress bar and row-level actions.
 * Colour transitions: emerald (on track) → amber (approaching limit) → rose
 * (over limit). The threshold for the amber state comes from the budget's
 * own `alertThreshold`.
 */
export function BudgetCard({ budget, onEdit }: BudgetCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const percent = Math.min(100, Math.round(budget.progress * 100));
  const overLimit = budget.progress > 1;
  const approaching = !overLimit && budget.progress >= budget.alertThreshold;

  const barClass = overLimit
    ? "bg-rose-500"
    : approaching
      ? "bg-amber-500"
      : "bg-emerald-500";

  const tone = overLimit
    ? "text-rose-600 dark:text-rose-400"
    : approaching
      ? "text-amber-600 dark:text-amber-400"
      : "text-emerald-600 dark:text-emerald-400";

  const handleArchiveToggle = () => {
    setMenuOpen(false);
    startTransition(async () => {
      await setBudgetArchived(budget.id, !budget.archived);
    });
  };

  const handleDelete = () => {
    setMenuOpen(false);
    const ok = window.confirm(
      `Delete budget "${budget.name}"? This cannot be undone.`
    );
    if (!ok) return;
    startTransition(async () => {
      await deleteBudget(budget.id);
    });
  };

  return (
    <div
      className={cn(
        "relative rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition dark:border-slate-800 dark:bg-slate-900",
        budget.archived && "opacity-70",
        pending && "pointer-events-none opacity-60"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-base font-semibold tracking-tight">
              {budget.name}
            </h3>
            {budget.archived ? (
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                Archived
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
            {budget.category} · {describePeriod(budget.period)} · {budget.periodLabel}
          </p>
        </div>

        <div className="relative shrink-0">
          <button
            type="button"
            aria-label="Budget actions"
            onClick={() => setMenuOpen((v) => !v)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
          {menuOpen ? (
            <>
              <button
                type="button"
                aria-hidden
                tabIndex={-1}
                onClick={() => setMenuOpen(false)}
                className="fixed inset-0 z-10 cursor-default"
              />
              <div className="absolute right-0 z-20 mt-1 w-40 overflow-hidden rounded-lg border border-slate-200 bg-white text-sm shadow-lg dark:border-slate-700 dark:bg-slate-900">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onEdit(budget);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </button>
                <button
                  type="button"
                  onClick={handleArchiveToggle}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  {budget.archived ? (
                    <>
                      <ArchiveRestore className="h-3.5 w-3.5" /> Unarchive
                    </>
                  ) : (
                    <>
                      <Archive className="h-3.5 w-3.5" /> Archive
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="flex w-full items-center gap-2 border-t border-slate-100 px-3 py-2 text-left text-rose-600 hover:bg-rose-50 dark:border-slate-800 dark:text-rose-400 dark:hover:bg-rose-950/40"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>

      <div className="mt-5 flex items-end justify-between gap-2">
        <div>
          <p className="text-2xl font-bold tracking-tight">
            {formatMoney(budget.spent, budget.baseCurrency)}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            of {formatMoney(budget.limit, budget.currency)} {budget.currency}
          </p>
        </div>
        <div className={cn("flex items-center gap-1 text-sm font-medium", tone)}>
          {overLimit ? (
            <AlertTriangle className="h-3.5 w-3.5" />
          ) : (
            <TrendingUp className="h-3.5 w-3.5" />
          )}
          {Math.round(budget.progress * 100)}%
        </div>
      </div>

      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label={`${budget.name} budget progress`}
        className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
      >
        <div
          className={cn("h-full rounded-full transition-all", barClass)}
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <span>
          {overLimit
            ? `Over by ${formatMoney(budget.spent - budget.limit, budget.baseCurrency)}`
            : `${formatMoney(budget.remaining, budget.baseCurrency)} left`}
        </span>
        {budget.currencyMismatch ? (
          <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
            <AlertTriangle className="h-3 w-3" />
            Limit in {budget.currency}, spend in {budget.baseCurrency}
          </span>
        ) : null}
      </div>
    </div>
  );
}
