"use client";

import { useEffect, useState, useTransition } from "react";
import { X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { toDateInputValue } from "@/lib/utils/format";
import {
  createTransactionAction,
  updateTransactionAction,
  type ActionResult,
} from "@/actions/transactions";
import type { TransactionListItem } from "@/lib/transactions/queries";

type PaymentMethod = NonNullable<TransactionListItem["paymentMethod"]>;
type TxType = TransactionListItem["type"];

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
  { value: "upi", label: "UPI" },
  { value: "bank", label: "Bank transfer" },
  { value: "wallet", label: "Wallet" },
  { value: "other", label: "Other" },
];

interface TransactionFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  /** When provided the dialog acts as an editor, otherwise a creator. */
  transaction?: TransactionListItem | null;
  baseCurrency: string;
  categorySuggestions: string[];
}

export function TransactionFormDialog({
  open,
  onClose,
  onSaved,
  transaction,
  baseCurrency,
  categorySuggestions,
}: TransactionFormDialogProps) {
  const isEdit = !!transaction;
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) {
      setError(null);
      setFieldErrors({});
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pending) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, pending, onClose]);

  if (!open) return null;

  const defaults = {
    type: (transaction?.type ?? "expense") as TxType,
    amount: transaction?.amount?.toString() ?? "",
    currency: transaction?.currency ?? baseCurrency,
    category: transaction?.category ?? "",
    merchant: transaction?.merchant ?? "",
    description: transaction?.description ?? "",
    notes: transaction?.notes ?? "",
    tags: (transaction?.tags ?? []).join(", "),
    date: toDateInputValue(transaction?.date ?? new Date()),
    paymentMethod: transaction?.paymentMethod ?? "",
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);

    startTransition(async () => {
      let res: ActionResult<{ id: string }>;
      if (isEdit && transaction) {
        data.set("id", transaction.id);
        res = await updateTransactionAction(data);
      } else {
        res = await createTransactionAction(data);
      }

      if (!res.ok) {
        setError(res.error);
        setFieldErrors(res.fieldErrors ?? {});
        return;
      }
      setError(null);
      setFieldErrors({});
      onSaved();
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tx-form-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !pending) onClose();
      }}
    >
      <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-2xl border border-slate-200 bg-white shadow-2xl sm:rounded-2xl dark:border-slate-800 dark:bg-slate-950">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
          <h2 id="tx-form-title" className="text-lg font-semibold">
            {isEdit ? "Edit transaction" : "New transaction"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50 dark:hover:bg-slate-900 dark:hover:text-slate-100"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-5">
          <TypeSelector defaultValue={defaults.type} />

          <div className="grid grid-cols-3 gap-3">
            <Field
              label="Amount"
              className="col-span-2"
              error={fieldErrors.amount?.[0]}
            >
              <input
                name="amount"
                type="number"
                step="0.01"
                min="0"
                required
                inputMode="decimal"
                defaultValue={defaults.amount}
                className={inputClass(!!fieldErrors.amount)}
                placeholder="0.00"
                autoFocus
              />
            </Field>
            <Field label="Currency" error={fieldErrors.currency?.[0]}>
              <input
                name="currency"
                type="text"
                maxLength={3}
                defaultValue={defaults.currency}
                className={cn(inputClass(!!fieldErrors.currency), "uppercase")}
                placeholder="INR"
              />
            </Field>
          </div>

          <Field label="Category" error={fieldErrors.category?.[0]}>
            <input
              name="category"
              list="tx-categories"
              required
              defaultValue={defaults.category}
              className={inputClass(!!fieldErrors.category)}
              placeholder="e.g. Food"
            />
            <datalist id="tx-categories">
              {categorySuggestions.map((c) => (
                <option key={c} value={c} />
              ))}
              {DEFAULT_CATEGORIES.filter(
                (c) => !categorySuggestions.includes(c)
              ).map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Merchant" error={fieldErrors.merchant?.[0]}>
              <input
                name="merchant"
                type="text"
                defaultValue={defaults.merchant}
                className={inputClass(!!fieldErrors.merchant)}
                placeholder="Where did you spend?"
              />
            </Field>
            <Field label="Date" error={fieldErrors.date?.[0]}>
              <input
                name="date"
                type="date"
                defaultValue={defaults.date}
                className={inputClass(!!fieldErrors.date)}
              />
            </Field>
          </div>

          <Field label="Payment method" error={fieldErrors.paymentMethod?.[0]}>
            <select
              name="paymentMethod"
              defaultValue={defaults.paymentMethod}
              className={inputClass(!!fieldErrors.paymentMethod)}
            >
              <option value="">—</option>
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Description" error={fieldErrors.description?.[0]}>
            <input
              name="description"
              type="text"
              defaultValue={defaults.description}
              className={inputClass(!!fieldErrors.description)}
              placeholder="Optional"
            />
          </Field>

          <Field
            label="Tags"
            hint="Comma-separated, e.g. work, reimbursable"
            error={fieldErrors.tags?.[0]}
          >
            <input
              name="tags"
              type="text"
              defaultValue={defaults.tags}
              className={inputClass(!!fieldErrors.tags)}
            />
          </Field>

          <Field label="Notes" error={fieldErrors.notes?.[0]}>
            <textarea
              name="notes"
              rows={2}
              defaultValue={defaults.notes}
              className={cn(inputClass(!!fieldErrors.notes), "resize-y")}
              placeholder="Anything else?"
            />
          </Field>

          {error ? (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
              {error}
            </p>
          ) : null}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-60"
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isEdit ? "Save changes" : "Add transaction"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const DEFAULT_CATEGORIES = [
  "Food",
  "Groceries",
  "Transport",
  "Rent",
  "Utilities",
  "Shopping",
  "Entertainment",
  "Health",
  "Travel",
  "Subscriptions",
  "Salary",
  "Investments",
  "Transfers",
  "Uncategorized",
];

function TypeSelector({ defaultValue }: { defaultValue: TxType }) {
  const [value, setValue] = useState<TxType>(defaultValue);
  const options: { value: TxType; label: string }[] = [
    { value: "expense", label: "Expense" },
    { value: "income", label: "Income" },
    { value: "transfer", label: "Transfer" },
  ];
  return (
    <div>
      <input type="hidden" name="type" value={value} />
      <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100/60 p-1 text-xs font-medium dark:border-slate-800 dark:bg-slate-900/60">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setValue(opt.value)}
            className={cn(
              "rounded-lg px-3 py-1.5 transition",
              value === opt.value
                ? "bg-white text-slate-900 shadow-sm dark:bg-slate-950 dark:text-slate-100"
                : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  error,
  className,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={cn("flex flex-col gap-1", className)}>
      <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
        {label}
      </span>
      {children}
      {error ? (
        <span className="text-xs text-rose-600 dark:text-rose-400">{error}</span>
      ) : hint ? (
        <span className="text-xs text-slate-500 dark:text-slate-500">{hint}</span>
      ) : null}
    </label>
  );
}

function inputClass(hasError: boolean) {
  return cn(
    "w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:ring-2 dark:bg-slate-950 dark:text-slate-200",
    hasError
      ? "border-rose-400 focus:border-rose-500 focus:ring-rose-200 dark:border-rose-700 dark:focus:ring-rose-900/50"
      : "border-slate-200 focus:border-brand-500 focus:ring-brand-200 dark:border-slate-800 dark:focus:ring-brand-900/50"
  );
}
