"use client";

import { useActionState, useEffect, useId, useState } from "react";
import { useFormStatus } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  createBudget,
  updateBudget,
  type BudgetActionResult,
} from "@/actions/budgets";
import type { BudgetSummary } from "@/lib/budgets/queries";
import {
  BUDGET_PERIODS,
  COMMON_CURRENCIES,
  SUGGESTED_CATEGORIES,
} from "./constants";

interface BudgetFormDialogProps {
  open: boolean;
  onClose: () => void;
  initial?: BudgetSummary | null;
  defaultCurrency: string;
}

const EMPTY_RESULT: BudgetActionResult = { ok: false };

/**
 * Modal form used for both creating a new envelope and editing an existing
 * one. The form binds directly to the matching server action via
 * {@link useActionState} so the submission happens without any custom fetch
 * or JSON plumbing.
 */
export function BudgetFormDialog({
  open,
  onClose,
  initial,
  defaultCurrency,
}: BudgetFormDialogProps) {
  const isEdit = Boolean(initial);
  const action = isEdit ? updateBudget.bind(null, initial!.id) : createBudget;
  const [state, formAction] = useActionState(action, EMPTY_RESULT);
  const [period, setPeriod] = useState<BudgetSummary["period"]>(
    initial?.period ?? "monthly"
  );
  const titleId = useId();

  useEffect(() => {
    if (open) setPeriod(initial?.period ?? "monthly");
  }, [open, initial]);

  useEffect(() => {
    if (state?.ok) onClose();
  }, [state, onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const fe = state?.fieldErrors ?? {};

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-slate-950/40 p-4 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <h2 id={titleId} className="text-base font-semibold tracking-tight">
            {isEdit ? "Edit budget" : "New budget"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form action={formAction} className="space-y-4 px-5 py-5">
          <Field label="Name" error={fe.name}>
            <input
              name="name"
              type="text"
              required
              maxLength={80}
              placeholder="e.g. Weekend dining"
              defaultValue={initial?.name ?? ""}
              className={inputClass(!!fe.name)}
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Category" error={fe.category}>
              <input
                name="category"
                type="text"
                required
                list="budget-category-options"
                defaultValue={initial?.category ?? ""}
                placeholder="Pick or type"
                className={inputClass(!!fe.category)}
              />
              <datalist id="budget-category-options">
                {SUGGESTED_CATEGORIES.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </Field>

            <Field label="Period" error={fe.period}>
              <select
                name="period"
                required
                value={period}
                onChange={(e) =>
                  setPeriod(e.target.value as BudgetSummary["period"])
                }
                className={inputClass(!!fe.period)}
              >
                {BUDGET_PERIODS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Limit" error={fe.limit}>
              <input
                name="limit"
                type="number"
                min={1}
                step="0.01"
                required
                placeholder="5000"
                defaultValue={initial?.limit ?? ""}
                className={inputClass(!!fe.limit)}
              />
            </Field>

            <Field label="Currency" error={fe.currency}>
              <input
                name="currency"
                list="budget-currency-options"
                defaultValue={initial?.currency ?? defaultCurrency}
                maxLength={3}
                className={cn(inputClass(!!fe.currency), "uppercase")}
              />
              <datalist id="budget-currency-options">
                {COMMON_CURRENCIES.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Start date" error={fe.startDate}>
              <input
                name="startDate"
                type="date"
                required
                defaultValue={toDateInput(initial?.startDate) ?? todayIso()}
                className={inputClass(!!fe.startDate)}
              />
            </Field>

            {period === "custom" ? (
              <Field label="End date" error={fe.endDate}>
                <input
                  name="endDate"
                  type="date"
                  required
                  defaultValue={toDateInput(initial?.endDate) ?? ""}
                  className={inputClass(!!fe.endDate)}
                />
              </Field>
            ) : (
              <Field
                label="Alert at"
                hint="0.8 = alert at 80% of the limit"
                error={fe.alertThreshold}
              >
                <input
                  name="alertThreshold"
                  type="number"
                  min={0}
                  max={1}
                  step="0.05"
                  defaultValue={initial?.alertThreshold ?? 0.8}
                  className={inputClass(!!fe.alertThreshold)}
                />
              </Field>
            )}
          </div>

          {period === "custom" ? (
            <Field
              label="Alert at"
              hint="0.8 = alert at 80% of the limit"
              error={fe.alertThreshold}
            >
              <input
                name="alertThreshold"
                type="number"
                min={0}
                max={1}
                step="0.05"
                defaultValue={initial?.alertThreshold ?? 0.8}
                className={inputClass(!!fe.alertThreshold)}
              />
            </Field>
          ) : null}

          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              name="rolloverUnused"
              defaultChecked={initial?.rolloverUnused ?? false}
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-800"
            />
            Roll over unused amount to next period
          </label>

          {state?.error ? (
            <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
              {state.error}
            </p>
          ) : null}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <SubmitButton isEdit={isEdit} />
          </div>
        </form>
      </div>
    </div>
  );
}

function SubmitButton({ isEdit }: { isEdit: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Saving..." : isEdit ? "Save changes" : "Create budget"}
    </button>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-slate-700 dark:text-slate-300">
        {label}
      </span>
      {children}
      {error ? (
        <span className="mt-1 block text-xs text-rose-600 dark:text-rose-400">
          {error}
        </span>
      ) : hint ? (
        <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
          {hint}
        </span>
      ) : null}
    </label>
  );
}

function inputClass(hasError: boolean): string {
  return cn(
    "block w-full rounded-lg border bg-white px-3 py-2 text-sm shadow-sm transition placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/40 dark:bg-slate-900",
    hasError
      ? "border-rose-400 dark:border-rose-500"
      : "border-slate-200 dark:border-slate-700"
  );
}

function todayIso(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function toDateInput(value?: string | null): string | null {
  if (!value) return null;
  try {
    return new Date(value).toISOString().slice(0, 10);
  } catch {
    return null;
  }
}
