import Link from "next/link";
import {
  ArrowDownRight,
  ArrowUpRight,
  ArrowRight,
  PiggyBank,
  Wallet,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { listUserCategories } from "@/lib/transactions/queries";
import { getDashboardOverview } from "@/lib/dashboard/queries";
import { DashboardQuickActions } from "@/components/dashboard/DashboardQuickActions";
import { DashboardNlpEntry } from "@/components/dashboard/DashboardNlpEntry";
import { formatCurrency, formatDate } from "@/lib/utils/format";

// The overview is dynamic per user and cached in Redis (5 min TTL). No need
// to additionally rely on Next's full-route cache.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();
  const name =
    user.name?.split(" ")[0] || user.email.split("@")[0] || "there";

  const [categorySuggestions, overview] = await Promise.all([
    listUserCategories(user.appUserId),
    getDashboardOverview(user.appUserId, user.baseCurrency),
  ]);

  const { baseCurrency, thisMonth, deltas, totals, recentTransactions, topBudgets } =
    overview;
  const hasAnyData = totals.count > 0;

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
        <DashboardNlpEntry baseCurrency={baseCurrency} />
      </div>

      <div className="mt-4">
        <DashboardQuickActions
          baseCurrency={baseCurrency}
          categorySuggestions={categorySuggestions}
        />
      </div>

      <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Wallet}
          label={thisMonth.label}
          value={formatCurrency(thisMonth.savings, baseCurrency)}
          delta={formatDelta(deltas.savings, "net vs last month")}
          deltaTone={deltaTone(deltas.savings)}
          tone="neutral"
          emptyHint={!hasAnyData ? "No transactions yet" : undefined}
        />
        <StatCard
          icon={ArrowDownRight}
          label="Income"
          value={formatCurrency(thisMonth.income, baseCurrency)}
          delta={formatDelta(deltas.income, "vs last month")}
          deltaTone={deltaTone(deltas.income)}
          tone="positive"
        />
        <StatCard
          icon={ArrowUpRight}
          label="Expenses"
          value={formatCurrency(thisMonth.expense, baseCurrency)}
          // For expenses, an increase is bad — flip the tone relative to deltas.
          delta={formatDelta(deltas.expense, "vs last month")}
          deltaTone={deltaTone(deltas.expense, /*invert*/ true)}
          tone="negative"
        />
        <StatCard
          icon={PiggyBank}
          label="Savings rate"
          value={savingsRateLabel(thisMonth.income, thisMonth.savings)}
          delta={
            thisMonth.income > 0
              ? `${formatCurrency(thisMonth.savings, baseCurrency)} saved`
              : "Log income to calculate"
          }
          deltaTone="neutral"
          tone="neutral"
        />
      </section>

      <section className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <RecentTransactionsCard
          transactions={recentTransactions}
          fallbackCurrency={baseCurrency}
        />

        <BudgetsHighlightCard
          budgets={topBudgets}
          fallbackCurrency={baseCurrency}
        />
      </section>
    </div>
  );
}

/* ------------------------------ Subcomponents ----------------------------- */

function RecentTransactionsCard({
  transactions,
  fallbackCurrency,
}: {
  transactions: Awaited<ReturnType<typeof getDashboardOverview>>["recentTransactions"];
  fallbackCurrency: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:col-span-2">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Recent transactions</h2>
        <Link
          href="/dashboard/transactions"
          className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-300"
        >
          View all
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {transactions.length === 0 ? (
        <>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Your transaction feed will appear here once you add your first
            expense.
          </p>
          <div className="mt-6 rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
            No transactions yet.
          </div>
        </>
      ) : (
        <ul className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
          {transactions.map((tx) => {
            const isIncome = tx.type === "income";
            return (
              <li
                key={tx.id}
                className="flex items-center justify-between gap-3 py-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className={`flex h-9 w-9 flex-none items-center justify-center rounded-full ${
                      isIncome
                        ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-300"
                        : "bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-300"
                    }`}
                  >
                    {isIncome ? (
                      <ArrowDownRight className="h-4 w-4" />
                    ) : (
                      <ArrowUpRight className="h-4 w-4" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                      {tx.merchant || tx.description || tx.category}
                    </p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                      {tx.category} · {formatDate(tx.date)}
                    </p>
                  </div>
                </div>
                <span
                  className={`flex-none text-sm font-semibold tabular-nums ${
                    isIncome
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-slate-900 dark:text-slate-100"
                  }`}
                >
                  {isIncome ? "+" : "−"}
                  {formatCurrency(tx.baseAmount, tx.baseCurrency || fallbackCurrency)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function BudgetsHighlightCard({
  budgets,
  fallbackCurrency,
}: {
  budgets: Awaited<ReturnType<typeof getDashboardOverview>>["topBudgets"];
  fallbackCurrency: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Budget envelopes</h2>
        <Link
          href="/dashboard/budgets"
          className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-300"
        >
          Manage
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {budgets.length === 0 ? (
        <>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Create category limits to see progress bars here.
          </p>
          <div className="mt-6 rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
            No budgets yet.
          </div>
        </>
      ) : (
        <ul className="mt-4 space-y-4">
          {budgets.map((b) => {
            const pct = Math.min(1, b.progress);
            const over = b.progress > 1;
            const barColor = over
              ? "bg-rose-500"
              : b.progress >= 0.8
                ? "bg-amber-500"
                : "bg-emerald-500";
            return (
              <li key={b.id}>
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    {b.name}
                  </span>
                  <span
                    className={`text-xs tabular-nums ${
                      over
                        ? "text-rose-600 dark:text-rose-400"
                        : "text-slate-500 dark:text-slate-400"
                    }`}
                  >
                    {formatCurrency(b.spent, b.currency || fallbackCurrency)} /{" "}
                    {formatCurrency(b.limit, b.currency || fallbackCurrency)}
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className={`h-full rounded-full transition-[width] ${barColor}`}
                    style={{ width: `${pct * 100}%` }}
                  />
                </div>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  {b.category} · {b.periodLabel}
                  {over ? ` · over by ${Math.round((b.progress - 1) * 100)}%` : ""}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  delta,
  deltaTone,
  tone,
  emptyHint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  delta: string;
  deltaTone: "positive" | "negative" | "neutral";
  tone: "positive" | "negative" | "neutral";
  emptyHint?: string;
}) {
  const iconTone =
    tone === "positive"
      ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-300"
      : tone === "negative"
        ? "bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-300"
        : "bg-brand-50 text-brand-600 dark:bg-brand-950/50 dark:text-brand-300";

  const deltaCls =
    deltaTone === "positive"
      ? "text-emerald-600 dark:text-emerald-400"
      : deltaTone === "negative"
        ? "text-rose-600 dark:text-rose-400"
        : "text-slate-500 dark:text-slate-400";

  const DeltaIcon =
    deltaTone === "positive"
      ? TrendingUp
      : deltaTone === "negative"
        ? TrendingDown
        : Minus;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {label}
        </span>
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-lg ${iconTone}`}
        >
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-3 text-2xl font-bold tracking-tight tabular-nums">
        {value}
      </p>
      <p className={`mt-1 flex items-center gap-1 text-xs font-medium ${deltaCls}`}>
        <DeltaIcon className="h-3.5 w-3.5" />
        {emptyHint ?? delta}
      </p>
    </div>
  );
}

/* ------------------------------ Pure helpers ----------------------------- */

function formatDelta(pct: number | null, suffix: string): string {
  if (pct === null) return `New ${suffix.replace(/^vs /, "this month vs ")}`;
  const rounded = Math.round(pct);
  const sign = rounded > 0 ? "+" : rounded < 0 ? "" : "";
  return `${sign}${rounded}% ${suffix}`;
}

function deltaTone(
  pct: number | null,
  invert = false
): "positive" | "negative" | "neutral" {
  if (pct === null || pct === 0) return "neutral";
  const isUp = pct > 0;
  const positive = invert ? !isUp : isUp;
  return positive ? "positive" : "negative";
}

function savingsRateLabel(income: number, savings: number): string {
  if (income <= 0) return "—";
  const rate = Math.round((savings / income) * 100);
  return `${rate}%`;
}
