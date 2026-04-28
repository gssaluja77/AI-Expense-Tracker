"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus, ScanText } from "lucide-react";
import { TransactionFormDialog } from "@/components/transactions/TransactionFormDialog";
import { ReceiptScannerDialog } from "@/components/transactions/ReceiptScannerDialog";

interface DashboardQuickActionsProps {
  baseCurrency: string;
  categorySuggestions: string[];
}

type OpenDialog = "transaction" | "receipt" | null;

/**
 * Primary call-to-action row on the dashboard overview. Both shortcuts
 * reuse the same dialogs that power /dashboard/transactions so the
 * creation flows stay consistent across the app.
 */
export function DashboardQuickActions({
  baseCurrency,
  categorySuggestions,
}: DashboardQuickActionsProps) {
  const router = useRouter();
  const [open, setOpen] = useState<OpenDialog>(null);

  const close = () => setOpen(null);
  const onSaved = () => {
    setOpen(null);
    router.refresh();
  };

  return (
    <>
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setOpen("transaction")}
          className="group flex items-center gap-4 rounded-2xl bg-brand-600 p-5 text-left text-white shadow-lg shadow-brand-600/25 transition hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-950"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm transition group-hover:bg-white/25">
            <Plus className="h-5 w-5" />
          </span>
          <span className="flex flex-col">
            <span className="text-base font-semibold">Add transaction</span>
            <span className="text-xs text-white/80">
              Log an expense, income, or transfer
            </span>
          </span>
        </button>

        <button
          type="button"
          onClick={() => setOpen("receipt")}
          className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 text-left text-slate-900 shadow-sm transition hover:border-brand-300 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:ring-offset-white dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-brand-700 dark:hover:bg-slate-800 dark:focus:ring-offset-slate-950"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 transition group-hover:bg-brand-100 dark:bg-brand-950/50 dark:text-brand-300 dark:group-hover:bg-brand-900/60">
            <ScanText className="h-5 w-5" />
          </span>
          <span className="flex flex-col">
            <span className="text-base font-semibold">Scan receipt</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Snap or upload a receipt — AI fills the details
            </span>
          </span>
        </button>
      </section>

      <TransactionFormDialog
        open={open === "transaction"}
        onClose={close}
        onSaved={onSaved}
        baseCurrency={baseCurrency}
        categorySuggestions={categorySuggestions}
      />

      <ReceiptScannerDialog
        open={open === "receipt"}
        onClose={close}
        onSaved={onSaved}
        baseCurrency={baseCurrency}
      />
    </>
  );
}
