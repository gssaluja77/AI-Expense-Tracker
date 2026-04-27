import Link from "next/link";
import {
  ArrowDownRight,
  ArrowUpRight,
  ReceiptText,
  Wallet,
} from "lucide-react";

import { requireUser } from "@/lib/auth/session";
import {
  listTransactions,
  listUserCategories,
  getTransactionStats,
} from "@/lib/transactions/queries";
import { formatCurrency } from "@/lib/utils/format";
import { TransactionsFilterBar } from "@/components/transactions/TransactionsFilterBar";
import { TransactionsView } from "@/components/transactions/TransactionsView";
import type { TransactionType } from "@/types/transaction";

export const metadata = { title: "Transactions · TrackFlow" };

type SearchParams = Record<string, string | string[] | undefined>;

interface TransactionsPageProps {
  // Next.js 15: searchParams is a Promise.
  searchParams: Promise<SearchParams>;
}

function getStr(params: SearchParams, key: string): string | undefined {
  const raw = params[key];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseType(value: string | undefined): TransactionType | undefined {
  if (value === "expense" || value === "income" || value === "transfer") {
    return value;
  }
  return undefined;
}

function parseDate(value: string | undefined, endOfDay = false): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return undefined;
  if (endOfDay) d.setHours(23, 59, 59, 999);
  else d.setHours(0, 0, 0, 0);
  return d;
}

function parsePage(value: string | undefined): number {
  const n = value ? Number.parseInt(value, 10) : 1;
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function buildHref(base: string, params: Record<string, string | undefined>) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") qs.set(k, v);
  }
  const query = qs.toString();
  return query ? `${base}?${query}` : base;
}

export default async function TransactionsPage({
  searchParams,
}: TransactionsPageProps) {
  const user = await requireUser();
  const params = await searchParams;

  const filters = {
    search: getStr(params, "q"),
    type: parseType(getStr(params, "type")),
    category: getStr(params, "category"),
    from: getStr(params, "from"),
    to: getStr(params, "to"),
  };

  const page = parsePage(getStr(params, "page"));
  const pageSize = 20;

  const queryInput = {
    userId: user.appUserId,
    search: filters.search,
    type: filters.type,
    category: filters.category,
    from: parseDate(filters.from),
    to: parseDate(filters.to, true),
  };

  const [result, categories, stats] = await Promise.all([
    listTransactions({ ...queryInput, page, pageSize }),
    listUserCategories(user.appUserId),
    getTransactionStats({ ...queryInput, baseCurrency: user.baseCurrency }),
  ]);

  const hasActiveFilters = Boolean(
    filters.search ||
      filters.type ||
      filters.category ||
      filters.from ||
      filters.to
  );

  // If the filtered stats show zero entries but the user has categories,
  // they likely have data somewhere — disambiguate empty states.
  const hasAnyTransactions = categories.length > 0 || result.total > 0;

  const baseCurrency = user.baseCurrency || "INR";
  const net = stats.incomeTotal - stats.expenseTotal;

  const hrefForPage = (p: number) =>
    buildHref("/dashboard/transactions", {
      q: filters.search,
      type: filters.type,
      category: filters.category,
      from: filters.from,
      to: filters.to,
      page: p > 1 ? String(p) : undefined,
    });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
          Transactions
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Search, filter, and manage every expense, income, and transfer. Your
          AI-powered entry, receipt OCR, and chat are plugged into this same
          feed.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          icon={ReceiptText}
          label="Entries"
          value={stats.count.toLocaleString()}
          sub={hasActiveFilters ? "In filtered view" : "All time"}
          tone="neutral"
        />
        <StatCard
          icon={ArrowDownRight}
          label="Income"
          value={formatCurrency(stats.incomeTotal, baseCurrency)}
          sub={hasActiveFilters ? "In filtered view" : "All time"}
          tone="positive"
        />
        <StatCard
          icon={ArrowUpRight}
          label="Expenses"
          value={formatCurrency(stats.expenseTotal, baseCurrency)}
          sub={hasActiveFilters ? "In filtered view" : "All time"}
          tone="negative"
        />
        <StatCard
          icon={Wallet}
          label="Net"
          value={formatCurrency(net, baseCurrency)}
          sub={net >= 0 ? "Positive flow" : "Spending outpaces income"}
          tone={net >= 0 ? "positive" : "negative"}
        />
      </section>

      <TransactionsFilterBar
        filters={filters}
        categories={categories}
        hasActiveFilters={hasActiveFilters}
      />

      <TransactionsView
        items={result.items}
        baseCurrency={baseCurrency}
        categorySuggestions={categories}
        hasAnyTransactions={hasAnyTransactions}
      />

      {result.pageCount > 1 ? (
        <Pagination
          page={result.page}
          pageCount={result.pageCount}
          total={result.total}
          hrefForPage={hrefForPage}
        />
      ) : null}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub: string;
  tone: "positive" | "negative" | "neutral";
}) {
  const toneClass =
    tone === "positive"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "negative"
        ? "text-rose-600 dark:text-rose-400"
        : "text-slate-500 dark:text-slate-400";
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {label}
        </span>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-950/50 dark:text-brand-300">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-3 truncate text-xl font-bold tracking-tight sm:text-2xl">
        {value}
      </p>
      <p className={`mt-1 truncate text-xs font-medium ${toneClass}`}>{sub}</p>
    </div>
  );
}

function Pagination({
  page,
  pageCount,
  total,
  hrefForPage,
}: {
  page: number;
  pageCount: number;
  total: number;
  hrefForPage: (page: number) => string;
}) {
  const canPrev = page > 1;
  const canNext = page < pageCount;
  return (
    <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <p className="text-slate-500 dark:text-slate-400">
        Page <span className="font-semibold text-slate-800 dark:text-slate-200">{page}</span> of{" "}
        <span className="font-semibold text-slate-800 dark:text-slate-200">{pageCount}</span>
        <span className="hidden sm:inline"> · {total.toLocaleString()} total</span>
      </p>
      <div className="flex items-center gap-2">
        <PagerLink href={hrefForPage(page - 1)} disabled={!canPrev}>
          Previous
        </PagerLink>
        <PagerLink href={hrefForPage(page + 1)} disabled={!canNext}>
          Next
        </PagerLink>
      </div>
    </div>
  );
}

function PagerLink({
  href,
  disabled,
  children,
}: {
  href: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <span className="cursor-not-allowed rounded-lg border border-slate-200 px-3 py-1.5 text-slate-400 dark:border-slate-700 dark:text-slate-600">
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className="rounded-lg border border-slate-200 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
    >
      {children}
    </Link>
  );
}
