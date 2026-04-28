"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { toDateInputValue } from "@/lib/utils/format";
import { createTransactionFromDraftAction } from "@/actions/transactions";
import type {
  ConfirmedTransaction,
  DraftSource,
  DraftTransaction,
} from "@/types/draft-transaction";
import {
  SUPPORTED_CURRENCIES,
  normalizeCurrency,
} from "@/lib/constants/currencies";

/**
 * The review-and-confirm UI shared by:
 *   • the receipt scanner dialog (OCR draft), and
 *   • the in-chat `proposeTransaction` tool (NLP draft).
 *
 * Every field is editable — the AI's extraction is a starting point,
 * not a verdict. Submitting calls `createTransactionFromDraftAction` and
 * notifies the caller on success with the persisted transaction id.
 */

const PAYMENT_METHODS: { value: ConfirmedTransaction["paymentMethod"]; label: string }[] = [
  { value: undefined, label: "—" },
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
  { value: "upi", label: "UPI" },
  { value: "bank", label: "Bank" },
  { value: "wallet", label: "Wallet" },
  { value: "other", label: "Other" },
];

const SUGGESTED_CATEGORIES = [
  "Food",
  "Groceries",
  "Transport",
  "Rent",
  "Utilities",
  "Shopping",
  "Electronics",
  "Entertainment",
  "Health",
  "Travel",
  "Subscriptions",
  "Salary",
  "Investments",
  "Transfers",
  "Uncategorized",
];

interface DraftReviewFormProps {
  draft: DraftTransaction;
  baseCurrency: string;
  source: DraftSource;
  receipt?: ConfirmedTransaction["receipt"];
  onSaved?: (result: { id: string; confirmed: ConfirmedTransaction }) => void;
  onCancel?: () => void;
  /** Label for the confirm button. Defaults to "Save transaction". */
  confirmLabel?: string;
  /** Compact variant removes the outer card chrome (for embedding in chat bubbles). */
  compact?: boolean;
}

export function DraftReviewForm({
  draft,
  baseCurrency,
  source,
  receipt,
  onSaved,
  onCancel,
  confirmLabel = "Save transaction",
  compact,
}: DraftReviewFormProps) {
  const [form, setForm] = useState(() => draftToForm(draft, baseCurrency));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const confidencePct =
    typeof draft.confidence === "number"
      ? Math.round(draft.confidence * 100)
      : null;

  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const confirmed = formToConfirmed(form, source, receipt);
    if (!confirmed) {
      setError("Amount and category are required.");
      return;
    }
    startTransition(async () => {
      const res = await createTransactionFromDraftAction(confirmed);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSavedId(res.data.id);
      onSaved?.({ id: res.data.id, confirmed });
    });
  }

  if (savedId) {
    return (
      <div
        className={cn(
          "flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200",
          compact ? "" : "shadow-sm"
        )}
      >
        <span className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-white">
          <Check className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0">
          <p className="font-semibold">Transaction saved.</p>
          <p className="text-xs opacity-80">
            {form.amount ? `${form.currency} ${form.amount} · ` : ""}
            {form.category || "Uncategorized"}
            {form.merchant ? ` · ${form.merchant}` : ""}
          </p>
        </div>
      </div>
    );
  }

  const chrome = compact
    ? "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/80"
    : "border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900";

  return (
    <form
      onSubmit={handleSubmit}
      className={cn("space-y-3 rounded-2xl border p-4", chrome)}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-950/50 dark:text-brand-300">
            <Sparkles className="h-3.5 w-3.5" />
          </span>
          <div>
            <p className="text-sm font-semibold">
              {source === "ocr"
                ? "Review extracted details"
                : "Review the suggested transaction"}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              AI-prefilled · every field is editable
              {confidencePct != null
                ? ` · confidence ${confidencePct}%`
                : ""}
            </p>
          </div>
        </div>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            aria-label="Discard draft"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </header>

      <TypeToggle
        value={form.type}
        onChange={(v) => update("type", v)}
      />

      <div className="grid grid-cols-3 gap-2">
        <Field label="Amount" className="col-span-2">
          <input
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            required
            value={form.amount}
            onChange={(e) => update("amount", e.target.value)}
            className={inputClass()}
            placeholder="0.00"
          />
        </Field>
        <Field label="Currency">
          <select
            value={form.currency}
            onChange={(e) => update("currency", e.target.value)}
            className={inputClass()}
          >
            {SUPPORTED_CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.symbol} {c.code}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Category">
        <input
          list="draft-review-categories"
          required
          value={form.category}
          onChange={(e) => update("category", e.target.value)}
          className={inputClass()}
          placeholder="Food"
        />
        <datalist id="draft-review-categories">
          {SUGGESTED_CATEGORIES.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </Field>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Field label="Merchant">
          <input
            type="text"
            value={form.merchant}
            onChange={(e) => update("merchant", e.target.value)}
            className={inputClass()}
            placeholder="Where?"
          />
        </Field>
        <Field label="Date">
          <input
            type="date"
            value={form.date}
            onChange={(e) => update("date", e.target.value)}
            className={inputClass()}
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Field label="Payment method">
          <select
            value={form.paymentMethod ?? ""}
            onChange={(e) =>
              update(
                "paymentMethod",
                (e.target.value || undefined) as typeof form.paymentMethod
              )
            }
            className={inputClass()}
          >
            {PAYMENT_METHODS.map((m) => (
              <option key={m.label} value={m.value ?? ""}>
                {m.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Description">
          <input
            type="text"
            value={form.description}
            onChange={(e) => update("description", e.target.value)}
            className={inputClass()}
            placeholder="Optional"
          />
        </Field>
      </div>

      {draft.items && draft.items.length ? (
        <details className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-900/50">
          <summary className="cursor-pointer font-medium text-slate-600 dark:text-slate-300">
            {draft.items.length} line item{draft.items.length === 1 ? "" : "s"}
          </summary>
          <ul className="mt-2 space-y-1 text-slate-600 dark:text-slate-400">
            {draft.items.map((it, i) => (
              <li key={i} className="flex items-center justify-between gap-2">
                <span className="truncate">
                  {it.quantity ? `${it.quantity}× ` : ""}
                  {it.name}
                </span>
                {typeof it.total === "number" ? (
                  <span className="tabular-nums">{it.total.toFixed(2)}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
          {error}
        </p>
      ) : null}

      <div className="flex items-center justify-end gap-2 pt-1">
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Discard
          </button>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-60"
        >
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Check className="h-3.5 w-3.5" />
          )}
          {confirmLabel}
        </button>
      </div>
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/*                                  Helpers                                   */
/* -------------------------------------------------------------------------- */

interface FormState {
  type: ConfirmedTransaction["type"];
  amount: string;
  currency: string;
  category: string;
  merchant: string;
  description: string;
  date: string;
  paymentMethod: ConfirmedTransaction["paymentMethod"];
}

function draftToForm(draft: DraftTransaction, fallbackCurrency: string): FormState {
  return {
    type: draft.type ?? "expense",
    amount:
      typeof draft.amount === "number" && !Number.isNaN(draft.amount)
        ? String(draft.amount)
        : "",
    currency: normalizeCurrency(draft.currency, normalizeCurrency(fallbackCurrency)),
    category: draft.category || "",
    merchant: draft.merchant ?? "",
    description: draft.description ?? "",
    date: toDateInputValue(draft.date || new Date()),
    paymentMethod: draft.paymentMethod,
  };
}

function formToConfirmed(
  form: FormState,
  source: DraftSource,
  receipt: ConfirmedTransaction["receipt"]
): ConfirmedTransaction | null {
  const amount = Number(form.amount);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  if (!form.category.trim()) return null;

  const dateIso = (() => {
    if (!form.date) return new Date().toISOString();
    const d = new Date(form.date);
    return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
  })();

  return {
    type: form.type,
    amount,
    currency: form.currency.toUpperCase() || "INR",
    category: form.category.trim(),
    merchant: form.merchant.trim() || undefined,
    description: form.description.trim() || undefined,
    date: dateIso,
    paymentMethod: form.paymentMethod,
    source,
    receipt,
  };
}

/* -------------------------------------------------------------------------- */
/*                              Tiny form atoms                               */
/* -------------------------------------------------------------------------- */

function TypeToggle({
  value,
  onChange,
}: {
  value: ConfirmedTransaction["type"];
  onChange: (v: ConfirmedTransaction["type"]) => void;
}) {
  const options: { value: ConfirmedTransaction["type"]; label: string }[] = [
    { value: "expense", label: "Expense" },
    { value: "income", label: "Income" },
    { value: "transfer", label: "Transfer" },
  ];
  return (
    <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100/60 p-0.5 text-xs font-medium dark:border-slate-800 dark:bg-slate-900/60">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-lg px-2.5 py-1 transition",
            value === o.value
              ? "bg-white text-slate-900 shadow-sm dark:bg-slate-950 dark:text-white"
              : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("flex flex-col gap-1", className)}>
      <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
        {label}
      </span>
      {children}
    </label>
  );
}

function inputClass() {
  return "w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:focus:ring-brand-900/50";
}
