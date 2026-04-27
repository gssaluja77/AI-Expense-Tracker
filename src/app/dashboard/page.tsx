import { ArrowDownRight, ArrowUpRight, PiggyBank, Wallet } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { listUserCategories } from "@/lib/transactions/queries";
import { DashboardQuickActions } from "@/components/dashboard/DashboardQuickActions";

export default async function DashboardPage() {
  const user = await requireUser();
  const name =
    user.name?.split(" ")[0] || user.email.split("@")[0] || "there";
  const categorySuggestions = await listUserCategories(user.appUserId);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
          Hi, {name}
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Here&apos;s a snapshot of your money. Add an expense by typing, scanning a
          receipt, or importing a statement.
        </p>
      </div>

      <div className="mt-6">
        <DashboardQuickActions
          baseCurrency={user.baseCurrency}
          categorySuggestions={categorySuggestions}
        />
      </div>

      <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Wallet}
          label="This month"
          value="₹0"
          delta="No transactions yet"
          tone="neutral"
        />
        <StatCard
          icon={ArrowDownRight}
          label="Income"
          value="₹0"
          delta="—"
          tone="positive"
        />
        <StatCard
          icon={ArrowUpRight}
          label="Expenses"
          value="₹0"
          delta="—"
          tone="negative"
        />
        <StatCard
          icon={PiggyBank}
          label="Savings"
          value="₹0"
          delta="—"
          tone="neutral"
        />
      </section>

      <section className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:col-span-2">
          <h2 className="text-lg font-semibold">Recent transactions</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Your transaction feed will appear here once you add your first
            expense.
          </p>
          <div className="mt-6 rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
            No transactions yet.
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-lg font-semibold">Budget envelopes</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Create category limits to see progress bars here.
          </p>
          <div className="mt-6 rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
            No budgets yet.
          </div>
        </div>
      </section>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  delta,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  delta: string;
  tone: "positive" | "negative" | "neutral";
}) {
  const toneClass =
    tone === "positive"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "negative"
        ? "text-rose-600 dark:text-rose-400"
        : "text-slate-500 dark:text-slate-400";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {label}
        </span>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-950/50 dark:text-brand-300">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-3 text-2xl font-bold tracking-tight">{value}</p>
      <p className={`mt-1 text-xs font-medium ${toneClass}`}>{delta}</p>
    </div>
  );
}
