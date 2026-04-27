"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface TransactionFilters {
  search?: string;
  type?: "expense" | "income" | "transfer";
  category?: string;
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD
}

interface TransactionsFilterBarProps {
  filters: TransactionFilters;
  categories: string[];
  /** True when at least one filter is currently applied. */
  hasActiveFilters: boolean;
}

const BASE_PATH = "/dashboard/transactions";

export function TransactionsFilterBar({
  filters,
  categories,
  hasActiveFilters,
}: TransactionsFilterBarProps) {
  const router = useRouter();

  // Controlled mirrors of the URL-sourced filters. Controlled inputs make
  // the "Clear filters" action deterministic: we wipe state *and* navigate,
  // so the fields visibly reset even if the user hadn't submitted yet.
  const [search, setSearch] = useState(filters.search ?? "");
  const [type, setType] = useState<string>(filters.type ?? "");
  const [category, setCategory] = useState(filters.category ?? "");
  const [from, setFrom] = useState(filters.from ?? "");
  const [to, setTo] = useState(filters.to ?? "");

  // Re-sync whenever the server-rendered props change (e.g. back/forward,
  // or an external link with pre-filled filters).
  useEffect(() => {
    setSearch(filters.search ?? "");
    setType(filters.type ?? "");
    setCategory(filters.category ?? "");
    setFrom(filters.from ?? "");
    setTo(filters.to ?? "");
  }, [filters.search, filters.type, filters.category, filters.from, filters.to]);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (search.trim()) params.set("q", search.trim());
    if (type) params.set("type", type);
    if (category) params.set("category", category);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const qs = params.toString();
    router.push(qs ? `${BASE_PATH}?${qs}` : BASE_PATH);
  };

  const onClear = () => {
    setSearch("");
    setType("");
    setCategory("");
    setFrom("");
    setTo("");
    router.push(BASE_PATH);
  };

  const inputClass = cn(
    "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:focus:ring-brand-900/50"
  );

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
        <label className="md:col-span-3">
          <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
            Search
          </span>
          <span className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              name="q"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Merchant, note, tag…"
              className={cn(inputClass, "pl-9")}
            />
          </span>
        </label>

        <label className="md:col-span-2">
          <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
            Type
          </span>
          <select
            name="type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            className={inputClass}
          >
            <option value="">All</option>
            <option value="expense">Expense</option>
            <option value="income">Income</option>
            <option value="transfer">Transfer</option>
          </select>
        </label>

        <label className="md:col-span-2">
          <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
            Category
          </span>
          <select
            name="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className={inputClass}
          >
            <option value="">All</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <label className="md:col-span-5">
          <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
            Date range
          </span>
          <div className="flex min-w-0 items-center gap-2">
            <input
              type="date"
              name="from"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className={cn(inputClass, "min-w-0 flex-1")}
              aria-label="From date"
            />
            <span className="shrink-0 text-xs text-slate-400">to</span>
            <input
              type="date"
              name="to"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className={cn(inputClass, "min-w-0 flex-1")}
              aria-label="To date"
            />
          </div>
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
          >
            Apply filters
          </button>
          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
            Clear filters
          </button>
        </div>
        {hasActiveFilters ? (
          <ActiveFilterSummary filters={filters} />
        ) : null}
      </div>
    </form>
  );
}

function ActiveFilterSummary({ filters }: { filters: TransactionFilters }) {
  const chips: string[] = [];
  if (filters.search) chips.push(`"${filters.search}"`);
  if (filters.type) chips.push(filters.type);
  if (filters.category) chips.push(filters.category);
  if (filters.from || filters.to) {
    chips.push(`${filters.from || "…"} → ${filters.to || "…"}`);
  }
  if (!chips.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
      {chips.map((c, i) => (
        <span
          key={i}
          className="rounded-full bg-slate-100 px-2 py-0.5 dark:bg-slate-800"
        >
          {c}
        </span>
      ))}
    </div>
  );
}
