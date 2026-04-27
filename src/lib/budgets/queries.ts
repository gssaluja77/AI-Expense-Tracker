import "server-only";
import mongoose, { type PipelineStage } from "mongoose";
import { connectToDatabase } from "@/lib/db/mongodb";
import { Budget, type IBudget } from "@/models/Budget";
import { Transaction } from "@/models/Transaction";
import { CACHE_TTL, cacheKey, withCache } from "@/lib/cache/redis";
import {
  getCurrentPeriodWindow,
  type BudgetPeriod,
  type PeriodWindow,
} from "./period";

/**
 * Plain, JSON-serialisable shape passed from Server Components to the
 * client. Never pass raw Mongoose documents into client components — they
 * carry non-serialisable getters and ObjectIds.
 */
export interface BudgetSummary {
  id: string;
  name: string;
  category: string;
  limit: number;
  currency: string;
  period: BudgetPeriod;
  startDate: string;
  endDate: string | null;
  rolloverUnused: boolean;
  alertThreshold: number;
  archived: boolean;
  spent: number;
  remaining: number;
  progress: number;
  periodStart: string;
  periodEnd: string;
  periodLabel: string;
  baseCurrency: string;
  currencyMismatch: boolean;
}

/** Safely turn a session user id into an ObjectId (invalid ids → null). */
export function toUserObjectId(userId: string): mongoose.Types.ObjectId | null {
  return mongoose.isValidObjectId(userId)
    ? new mongoose.Types.ObjectId(userId)
    : null;
}

/**
 * Load every budget for a user and compute `spent` for each active period.
 *
 * Strategy:
 *   1. Fetch all budgets in one query.
 *   2. Bucket them by their active period window (rolling windows share one
 *      bucket; custom windows each get their own).
 *   3. Run a single `$group` aggregation per unique window for the set of
 *      categories it covers, then zip the totals back onto the budgets.
 */
export async function getBudgetsSummary(
  userId: string,
  baseCurrency: string
): Promise<BudgetSummary[]> {
  const userObjectId = toUserObjectId(userId);
  if (!userObjectId) return [];

  return withCache<BudgetSummary[]>(
    cacheKey.budgets(userId),
    CACHE_TTL.DASHBOARD,
    () => loadBudgetsSummary(userObjectId, baseCurrency)
  );
}

async function loadBudgetsSummary(
  userObjectId: mongoose.Types.ObjectId,
  baseCurrency: string
): Promise<BudgetSummary[]> {
  await connectToDatabase();

  const budgets = await Budget.find({ user: userObjectId })
    .sort({ archived: 1, createdAt: -1 })
    .lean<IBudget[]>();

  if (!budgets.length) return [];

  const now = new Date();
  const windowByBudget = new Map<string, PeriodWindow>();
  type Bucket = { start: Date; end: Date; categories: Set<string> };
  const buckets = new Map<string, Bucket>();

  for (const b of budgets) {
    const win = getCurrentPeriodWindow(b.period, b.startDate, b.endDate, now);
    windowByBudget.set(String(b._id), win);

    const bucketKey = `${win.start.toISOString()}|${win.end.toISOString()}`;
    const existing = buckets.get(bucketKey);
    if (existing) {
      existing.categories.add(b.category);
    } else {
      buckets.set(bucketKey, {
        start: win.start,
        end: win.end,
        categories: new Set([b.category]),
      });
    }
  }

  const spentMap = new Map<string, number>(); // key: `${bucketKey}|${category}` -> total
  await Promise.all(
    [...buckets.entries()].map(async ([bucketKey, bucket]) => {
      const pipeline: PipelineStage[] = [
        {
          $match: {
            user: userObjectId,
            type: "expense",
            deleted: { $ne: true },
            category: { $in: [...bucket.categories] },
            date: { $gte: bucket.start, $lte: bucket.end },
          },
        },
        { $group: { _id: "$category", total: { $sum: "$baseAmount" } } },
      ];
      const rows = await Transaction.aggregate<{ _id: string; total: number }>(
        pipeline
      );
      for (const row of rows) {
        spentMap.set(`${bucketKey}|${row._id}`, row.total);
      }
    })
  );

  return budgets.map((b) => {
    const win = windowByBudget.get(String(b._id))!;
    const bucketKey = `${win.start.toISOString()}|${win.end.toISOString()}`;
    const spent = spentMap.get(`${bucketKey}|${b.category}`) ?? 0;
    const remaining = Math.max(0, b.limit - spent);
    const progress = b.limit > 0 ? spent / b.limit : 0;

    return {
      id: String(b._id),
      name: b.name,
      category: b.category,
      limit: b.limit,
      currency: b.currency,
      period: b.period,
      startDate: new Date(b.startDate).toISOString(),
      endDate: b.endDate ? new Date(b.endDate).toISOString() : null,
      rolloverUnused: b.rolloverUnused,
      alertThreshold: b.alertThreshold,
      archived: b.archived,
      spent,
      remaining,
      progress,
      periodStart: win.start.toISOString(),
      periodEnd: win.end.toISOString(),
      periodLabel: win.label,
      baseCurrency,
      currencyMismatch: b.currency.toUpperCase() !== baseCurrency.toUpperCase(),
    };
  });
}
