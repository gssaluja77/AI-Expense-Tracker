"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  ArrowDownRight,
  ArrowLeftRight,
  ArrowUpRight,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  ScanText,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { deleteTransactionAction } from "@/actions/transactions";
import type { TransactionListItem } from "@/lib/transactions/queries";
import { TransactionFormDialog } from "./TransactionFormDialog";
import { ReceiptScannerDialog } from "./ReceiptScannerDialog";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

interface TransactionsViewProps {
  items: TransactionListItem[];
  baseCurrency: string;
  categorySuggestions: string[];
  /** True when *any* transaction exists for this user (not just this page). */
  hasAnyTransactions: boolean;
}

type DialogState =
  | { mode: "create" }
  | { mode: "edit"; transaction: TransactionListItem }
  | null;

export function TransactionsView({
  items,
  baseCurrency,
  categorySuggestions,
  hasAnyTransactions,
}: TransactionsViewProps) {
  const router = useRouter();
  const [dialog, setDialog] = useState<DialogState>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<TransactionListItem | null>(
    null
  );
  const [pendingDelete, startDelete] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);

  const onSaved = () => {
    setDialog(null);
    setFeedback("Saved.");
    router.refresh();
    setTimeout(() => setFeedback(null), 2000);
  };

  const onScanSaved = () => {
    setScannerOpen(false);
    setFeedback("Transaction added from receipt.");
    router.refresh();
    setTimeout(() => setFeedback(null), 2500);
  };

  const requestDelete = (tx: TransactionListItem) => {
    setConfirmTarget(tx);
  };

  const confirmDelete = () => {
    const tx = confirmTarget;
    if (!tx) return;
    setDeletingId(tx.id);
    startDelete(async () => {
      const fd = new FormData();
      fd.set("id", tx.id);
      const res = await deleteTransactionAction(fd);
      setDeletingId(null);
      setConfirmTarget(null);
      if (!res.ok) {
        setFeedback(res.error);
        setTimeout(() => setFeedback(null), 3000);
        return;
      }
      setFeedback("Transaction deleted.");
      router.refresh();
      setTimeout(() => setFeedback(null), 2000);
    });
  };

  const isEmpty = items.length === 0;

  const dialogTransaction = useMemo(
    () => (dialog?.mode === "edit" ? dialog.transaction : null),
    [dialog]
  );

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800 sm:px-5">
        <div>
          <h2 className="text-sm font-semibold">
            {items.length > 0
              ? `Showing ${items.length} ${items.length === 1 ? "entry" : "entries"}`
              : "No entries"}
          </h2>
          {feedback ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {feedback}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setScannerOpen(true)}
            className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium leading-none text-slate-700 shadow-sm transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-brand-700 dark:hover:bg-brand-950/40 dark:hover:text-brand-300"
          >
            <ScanText className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">Scan receipt</span>
            <span className="sm:hidden">Scan</span>
          </button>
          <button
            type="button"
            onClick={() => setDialog({ mode: "create" })}
            className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold leading-none text-white shadow-sm hover:bg-brand-700"
          >
            <Plus className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">Add transaction</span>
            <span className="sm:hidden">Add</span>
          </button>
        </div>
      </div>

      {isEmpty ? (
        <EmptyState
          hasAnyTransactions={hasAnyTransactions}
          onCreate={() => setDialog({ mode: "create" })}
          onScan={() => setScannerOpen(true)}
        />
      ) : (
        <>
          {/* Mobile: cards */}
          <ul className="divide-y divide-slate-100 sm:hidden dark:divide-slate-800">
            {items.map((t) => (
              <li key={t.id} className="px-4 py-3">
                <MobileRow
                  tx={t}
                  onEdit={() => setDialog({ mode: "edit", transaction: t })}
                  onDelete={() => requestDelete(t)}
                  disabled={pendingDelete && deletingId === t.id}
                />
              </li>
            ))}
          </ul>

          {/* Desktop: table */}
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs font-medium uppercase tracking-wide text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-2.5 text-left">Date</th>
                  <th className="px-3 py-2.5 text-left">Description</th>
                  <th className="px-3 py-2.5 text-left">Category</th>
                  <th className="px-3 py-2.5 text-left">Type</th>
                  <th className="px-3 py-2.5 text-right">Amount</th>
                  <th className="px-5 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {items.map((t) => (
                  <DesktopRow
                    key={t.id}
                    tx={t}
                    onEdit={() => setDialog({ mode: "edit", transaction: t })}
                    onDelete={() => requestDelete(t)}
                    disabled={pendingDelete && deletingId === t.id}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <TransactionFormDialog
        open={dialog !== null}
        onClose={() => setDialog(null)}
        onSaved={onSaved}
        transaction={dialogTransaction}
        baseCurrency={baseCurrency}
        categorySuggestions={categorySuggestions}
      />

      <ReceiptScannerDialog
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onSaved={onScanSaved}
        baseCurrency={baseCurrency}
      />

      <ConfirmDialog
        open={confirmTarget !== null}
        title="Delete this transaction?"
        description={
          confirmTarget ? (
            <>
              <span className="font-medium text-slate-700 dark:text-slate-200">
                {confirmTarget.merchant ||
                  confirmTarget.description ||
                  confirmTarget.category}
              </span>{" "}
              — {formatCurrency(confirmTarget.amount, confirmTarget.currency)}{" "}
              on {formatDate(confirmTarget.date)}. This can&apos;t be undone.
            </>
          ) : null
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        tone="danger"
        pending={pendingDelete}
        onConfirm={confirmDelete}
        onClose={() => {
          if (!pendingDelete) setConfirmTarget(null);
        }}
      />
    </div>
  );
}

function DesktopRow({
  tx,
  onEdit,
  onDelete,
  disabled,
}: {
  tx: TransactionListItem;
  onEdit: () => void;
  onDelete: () => void;
  disabled: boolean;
}) {
  return (
    <tr className="transition hover:bg-slate-50 dark:hover:bg-slate-900/60">
      <td className="whitespace-nowrap px-5 py-3 text-slate-500 dark:text-slate-400">
        {formatDate(tx.date)}
      </td>
      <td className="max-w-xs px-3 py-3">
        <div className="flex flex-col">
          <span className="truncate font-medium">
            {tx.merchant || tx.description || tx.category}
          </span>
          {tx.merchant && tx.description ? (
            <span className="truncate text-xs text-slate-500 dark:text-slate-400">
              {tx.description}
            </span>
          ) : null}
        </div>
      </td>
      <td className="px-3 py-3">
        <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
          {tx.category}
        </span>
      </td>
      <td className="px-3 py-3">
        <TypeBadge type={tx.type} />
      </td>
      <td
        className={cn(
          "whitespace-nowrap px-3 py-3 text-right font-semibold tabular-nums",
          tx.type === "income"
            ? "text-emerald-600 dark:text-emerald-400"
            : tx.type === "expense"
              ? "text-slate-900 dark:text-slate-200"
              : "text-slate-600 dark:text-slate-300"
        )}
      >
        {tx.type === "income" ? "+" : tx.type === "expense" ? "−" : ""}
        {formatCurrency(tx.amount, tx.currency)}
      </td>
      <td className="whitespace-nowrap px-5 py-3 text-right">
        <div className="inline-flex items-center gap-1">
          <IconButton label="Edit" onClick={onEdit} disabled={disabled}>
            <Pencil className="h-4 w-4" />
          </IconButton>
          <IconButton
            label="Delete"
            onClick={onDelete}
            disabled={disabled}
            tone="danger"
          >
            {disabled ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </IconButton>
        </div>
      </td>
    </tr>
  );
}

function MobileRow({
  tx,
  onEdit,
  onDelete,
  disabled,
}: {
  tx: TransactionListItem;
  onEdit: () => void;
  onDelete: () => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5">
        <TypeIcon type={tx.type} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {tx.merchant || tx.description || tx.category}
            </p>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">
              {formatDate(tx.date)} · {tx.category}
            </p>
          </div>
          <p
            className={cn(
              "whitespace-nowrap text-sm font-semibold tabular-nums",
              tx.type === "income"
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-slate-900 dark:text-slate-200"
            )}
          >
            {tx.type === "income" ? "+" : tx.type === "expense" ? "−" : ""}
            {formatCurrency(tx.amount, tx.currency)}
          </p>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={onEdit}
            disabled={disabled}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <Pencil className="h-3.5 w-3.5" /> Edit
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={disabled}
            className="inline-flex items-center gap-1 rounded-md border border-rose-200 px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/50"
          >
            {disabled ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function TypeBadge({ type }: { type: TransactionListItem["type"] }) {
  const map = {
    expense: {
      label: "Expense",
      cls: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
    },
    income: {
      label: "Income",
      cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    },
    transfer: {
      label: "Transfer",
      cls: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
    },
  } as const;
  const meta = map[type];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        meta.cls
      )}
    >
      {meta.label}
    </span>
  );
}

function TypeIcon({ type }: { type: TransactionListItem["type"] }) {
  const common = "h-5 w-5";
  if (type === "income") {
    return (
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
        <ArrowDownRight className={common} />
      </span>
    );
  }
  if (type === "transfer") {
    return (
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
        <ArrowLeftRight className={common} />
      </span>
    );
  }
  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
      <ArrowUpRight className={common} />
    </span>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  tone = "default",
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "default" | "danger";
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-lg border transition disabled:opacity-50",
        tone === "danger"
          ? "border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/50"
          : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
      )}
    >
      {children}
    </button>
  );
}

function EmptyState({
  hasAnyTransactions,
  onCreate,
  onScan,
}: {
  hasAnyTransactions: boolean;
  onCreate: () => void;
  onScan: () => void;
}) {
  return (
    <div className="px-6 py-14 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-950/50 dark:text-brand-300">
        <Sparkles className="h-6 w-6" />
      </div>
      <p className="mt-4 text-base font-semibold">
        {hasAnyTransactions ? "No results match your filters" : "No transactions yet"}
      </p>
      <p className="mx-auto mt-1 max-w-md text-sm text-slate-600 dark:text-slate-400">
        {hasAnyTransactions
          ? "Try clearing a filter or broadening the date range."
          : "Start by adding your first expense, income, or transfer. You can also snap a receipt and we'll fill in the details for you."}
      </p>
      {!hasAnyTransactions ? (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={onCreate}
            className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold leading-none text-white shadow-sm hover:bg-brand-700"
          >
            <Plus className="h-4 w-4 shrink-0" />
            Add transaction
          </button>
          <button
            type="button"
            onClick={onScan}
            className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold leading-none text-slate-700 shadow-sm transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-brand-700 dark:hover:bg-brand-950/40 dark:hover:text-brand-300"
          >
            <ScanText className="h-4 w-4 shrink-0" />
            Scan receipt
          </button>
        </div>
      ) : null}
    </div>
  );
}
