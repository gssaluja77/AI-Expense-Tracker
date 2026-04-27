import "server-only";

import mongoose, { type PipelineStage } from "mongoose";
import { connectToDatabase } from "@/lib/db/mongodb";
import { Transaction } from "@/models/Transaction";
import { Budget, type IBudget } from "@/models/Budget";
import { CACHE_TTL, cacheKey, withCache } from "@/lib/cache/redis";
import { getCurrentPeriodWindow } from "@/lib/budgets/period";
import type { TransactionType } from "@/types/transaction";

/**
 * Dashboard overview query.
 *
 * Aggregates everything the `/dashboard` landing page needs in a single
 * cached call:
 *   • This month's income / expense / savings totals + month-over-month deltas
 *   • Five most recent transactions
 *   • Top three active budgets (by "closest to or past limit")
 *
 * All numbers are reported in the user's base currency. The cache is keyed
 * by userId and is invalidated by any transaction or budget mutation via
 * `cacheKey.dashboard(userId)`.
 */

// ---------------- Public types ----------------

export interface DashboardRecentTx {
  id: string;
  type: TransactionType;
  category: string;
  merchant?: string;
  description?: string;
  baseAmount: number;
  baseCurrency: string;
  date: string; // ISO
}

export interface DashboardBudgetHighlight {
  id: string;
  name: string;
  category: string;
  limit: number;
  spent: number;
  progress: number; // 0..(>1 when over)
  currency: string;
  periodLabel: string;
}

export interface DashboardOverview {
  baseCurrency: string;
  thisMonth: {
    label: string; // e.g. "April 2026"
    income: number;
    expense: number;
    savings: number; // income - expense (can be negative)
  };
  lastMonth: {
    income: number;
    expense: number;
    savings: number;
  };
  deltas: {
    // % change vs previous month; null when previous month == 0 and current > 0
    income: number | null;
    expense: number | null;
    savings: number | null;
  };
  totals: {
    // Lifetime totals across the full history — used for the "This month"
    // tile tone context and onboarding empty-state detection.
    count: number;
  };
  recentTransactions: DashboardRecentTx[];
  topBudgets: DashboardBudgetHighlight[];
}

// ---------------- Entrypoint ----------------

export async function getDashboardOverview(
  userId: string,
  baseCurrency: string
): Promise<DashboardOverview> {
  return withCache<DashboardOverview>(
    cacheKey.dashboard(userId),
    CACHE_TTL.DASHBOARD,
    () => loadDashboardOverview(userId, baseCurrency)
  );
}

// ---------------- Internals ----------------

async function loadDashboardOverview(
  userId: string,
  baseCurrency: string
): Promise<DashboardOverview> {
  if (!mongoose.isValidObjectId(userId)) {
    return emptyOverview(baseCurrency);
  }

  await connectToDatabase();

  const userOid = new mongoose.Types.ObjectId(userId);
  const now = new Date();
  const thisMonthStart = startOfMonth(now);
  const nextMonthStart = startOfMonth(addMonths(now, 1));
  const lastMonthStart = startOfMonth(addMonths(now, -1));

  const [monthlyTotals, recentDocs, budgetDocs, lifetimeCount] =
    await Promise.all([
      sumByTypeInRange(userOid, lastMonthStart, nextMonthStart),
      Transaction.find({ user: userOid, deleted: { $ne: true } })
        .sort({ date: -1, _id: -1 })
        .limit(5)
        .lean(),
      Budget.find({ user: userOid, archived: { $ne: true } })
        .sort({ createdAt: -1 })
        .lean<IBudget[]>(),
      Transaction.countDocuments({ user: userOid, deleted: { $ne: true } }),
    ]);

  const thisMonth = pickBucket(monthlyTotals, thisMonthStart);
  const lastMonth = pickBucket(monthlyTotals, lastMonthStart);

  const deltas = {
    income: pctChange(lastMonth.income, thisMonth.income),
    expense: pctChange(lastMonth.expense, thisMonth.expense),
    savings: pctChange(lastMonth.savings, thisMonth.savings),
  };

  const recentTransactions: DashboardRecentTx[] = recentDocs.map((d) => ({
    id: String(d._id),
    type: d.type,
    category: d.category,
    merchant: d.merchant ?? undefined,
    description: d.description ?? undefined,
    baseAmount: d.baseAmount,
    baseCurrency: d.baseCurrency,
    date: new Date(d.date).toISOString(),
  }));

  const topBudgets = await topBudgetsWithSpent(userOid, budgetDocs, now);

  return {
    baseCurrency,
    thisMonth: {
      label: monthLabel(thisMonthStart),
      ...thisMonth,
    },
    lastMonth,
    deltas,
    totals: { count: lifetimeCount },
    recentTransactions,
    topBudgets,
  };
}

/**
 * One aggregation pass that returns totals per month-bucket / per type for
 * the 2-month window (last month + this month).
 */
async function sumByTypeInRange(
  userOid: mongoose.Types.ObjectId,
  from: Date,
  toExclusive: Date
): Promise<Array<{ monthStart: Date; income: number; expense: number; savings: number }>> {
  const pipeline: PipelineStage[] = [
    {
      $match: {
        user: userOid,
        deleted: { $ne: true },
        date: { $gte: from, $lt: toExclusive },
      },
    },
    {
      $group: {
        _id: {
          year: { $year: "$date" },
          month: { $month: "$date" },
          type: "$type",
        },
        total: { $sum: "$baseAmount" },
      },
    },
  ];

  const rows = await Transaction.aggregate<{
    _id: { year: number; month: number; type: TransactionType };
    total: number;
  }>(pipeline);

  const byMonth = new Map<string, { monthStart: Date; income: number; expense: number }>();
  for (const r of rows) {
    const key = `${r._id.year}-${r._id.month}`;
    const entry =
      byMonth.get(key) ??
      {
        monthStart: new Date(r._id.year, r._id.month - 1, 1),
        income: 0,
        expense: 0,
      };
    if (r._id.type === "income") entry.income += r.total;
    if (r._id.type === "expense") entry.expense += r.total;
    byMonth.set(key, entry);
  }

  return [...byMonth.values()].map((v) => ({
    ...v,
    savings: v.income - v.expense,
  }));
}

function pickBucket(
  rows: Array<{ monthStart: Date; income: number; expense: number; savings: number }>,
  monthStart: Date
): { income: number; expense: number; savings: number } {
  const key = `${monthStart.getFullYear()}-${monthStart.getMonth() + 1}`;
  const hit = rows.find(
    (r) => `${r.monthStart.getFullYear()}-${r.monthStart.getMonth() + 1}` === key
  );
  return { income: hit?.income ?? 0, expense: hit?.expense ?? 0, savings: hit?.savings ?? 0 };
}

async function topBudgetsWithSpent(
  userOid: mongoose.Types.ObjectId,
  budgets: IBudget[],
  now: Date
): Promise<DashboardBudgetHighlight[]> {
  if (!budgets.length) return [];

  // Compute the spent amount for each budget's current period, then pick
  // the 3 with highest progress (utilised ratio).
  const items: DashboardBudgetHighlight[] = [];

  await Promise.all(
    budgets.map(async (b) => {
      const win = getCurrentPeriodWindow(b.period, b.startDate, b.endDate, now);
      const agg = await Transaction.aggregate<{ total: number }>([
        {
          $match: {
            user: userOid,
            type: "expense",
            deleted: { $ne: true },
            category: b.category,
            date: { $gte: win.start, $lte: win.end },
          },
        },
        { $group: { _id: null, total: { $sum: "$baseAmount" } } },
      ]);
      const spent = agg[0]?.total ?? 0;
      items.push({
        id: String(b._id),
        name: b.name,
        category: b.category,
        limit: b.limit,
        spent,
        progress: b.limit > 0 ? spent / b.limit : 0,
        currency: b.currency,
        periodLabel: win.label,
      });
    })
  );

  items.sort((a, b) => b.progress - a.progress);
  return items.slice(0, 3);
}

// ---------------- Helpers ----------------

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, months: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + months, 1);
}

function monthLabel(d: Date): string {
  return d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

function pctChange(prev: number, curr: number): number | null {
  if (prev === 0) return curr === 0 ? 0 : null;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

function emptyOverview(baseCurrency: string): DashboardOverview {
  const now = new Date();
  return {
    baseCurrency,
    thisMonth: {
      label: monthLabel(startOfMonth(now)),
      income: 0,
      expense: 0,
      savings: 0,
    },
    lastMonth: { income: 0, expense: 0, savings: 0 },
    deltas: { income: null, expense: null, savings: null },
    totals: { count: 0 },
    recentTransactions: [],
    topBudgets: [],
  };
}
