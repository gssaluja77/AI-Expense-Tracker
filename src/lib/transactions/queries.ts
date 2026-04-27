import "server-only";

import { Types, type FilterQuery } from "mongoose";
import { connectToDatabase } from "@/lib/db/mongodb";
import { Transaction, type ITransaction } from "@/models/Transaction";
import type {
  PaymentMethod,
  TransactionSource,
  TransactionType,
} from "@/types/transaction";

/**
 * Server-only data access for transactions. Every function is scoped to
 * a single user — the caller is expected to have already resolved the
 * app_users `_id` (e.g. from {@link getCurrentUser}).
 */

export interface ListTransactionsInput {
  userId: string;
  type?: TransactionType;
  category?: string;
  search?: string;
  from?: Date;
  to?: Date;
  page?: number;
  pageSize?: number;
}

export interface TransactionListItem {
  id: string;
  type: TransactionType;
  amount: number;
  currency: string;
  baseAmount: number;
  baseCurrency: string;
  category: string;
  subcategory?: string;
  merchant?: string;
  description?: string;
  notes?: string;
  tags: string[];
  date: string; // ISO
  paymentMethod?: PaymentMethod;
  source: TransactionSource;
  isRecurring: boolean;
  shared: { isShared: boolean };
}

export interface ListTransactionsResult {
  items: TransactionListItem[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

function buildFilter(input: ListTransactionsInput): FilterQuery<ITransaction> {
  const filter: FilterQuery<ITransaction> = {
    user: new Types.ObjectId(input.userId),
    deleted: { $ne: true },
  };

  if (input.type) filter.type = input.type;
  if (input.category) filter.category = input.category;

  if (input.from || input.to) {
    filter.date = {};
    if (input.from) filter.date.$gte = input.from;
    if (input.to) filter.date.$lte = input.to;
  }

  const search = input.search?.trim();
  if (search) {
    const regex = new RegExp(escapeRegex(search), "i");
    filter.$or = [
      { description: regex },
      { merchant: regex },
      { notes: regex },
      { category: regex },
      { tags: regex },
    ];
  }

  return filter;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function listTransactions(
  input: ListTransactionsInput
): Promise<ListTransactionsResult> {
  await connectToDatabase();

  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, input.pageSize ?? DEFAULT_PAGE_SIZE)
  );

  const filter = buildFilter(input);

  const [total, docs] = await Promise.all([
    Transaction.countDocuments(filter),
    Transaction.find(filter)
      .sort({ date: -1, _id: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
  ]);

  const items: TransactionListItem[] = docs.map((doc) => ({
    id: doc._id.toString(),
    type: doc.type,
    amount: doc.amount,
    currency: doc.currency,
    baseAmount: doc.baseAmount,
    baseCurrency: doc.baseCurrency,
    category: doc.category,
    subcategory: doc.subcategory ?? undefined,
    merchant: doc.merchant ?? undefined,
    description: doc.description ?? undefined,
    notes: doc.notes ?? undefined,
    tags: doc.tags ?? [],
    date: new Date(doc.date).toISOString(),
    paymentMethod: doc.paymentMethod ?? undefined,
    source: doc.source,
    isRecurring: !!doc.isRecurring,
    shared: { isShared: !!doc.shared?.isShared },
  }));

  return {
    items,
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getTransactionById(
  userId: string,
  id: string
): Promise<TransactionListItem | null> {
  if (!Types.ObjectId.isValid(id)) return null;
  await connectToDatabase();

  const doc = await Transaction.findOne({
    _id: new Types.ObjectId(id),
    user: new Types.ObjectId(userId),
    deleted: { $ne: true },
  }).lean();

  if (!doc) return null;

  return {
    id: doc._id.toString(),
    type: doc.type,
    amount: doc.amount,
    currency: doc.currency,
    baseAmount: doc.baseAmount,
    baseCurrency: doc.baseCurrency,
    category: doc.category,
    subcategory: doc.subcategory ?? undefined,
    merchant: doc.merchant ?? undefined,
    description: doc.description ?? undefined,
    notes: doc.notes ?? undefined,
    tags: doc.tags ?? [],
    date: new Date(doc.date).toISOString(),
    paymentMethod: doc.paymentMethod ?? undefined,
    source: doc.source,
    isRecurring: !!doc.isRecurring,
    shared: { isShared: !!doc.shared?.isShared },
  };
}

export interface TransactionStats {
  /** Sum of baseAmount for expenses in the filtered set. */
  expenseTotal: number;
  /** Sum of baseAmount for income in the filtered set. */
  incomeTotal: number;
  /** Count of transactions in the filtered set. */
  count: number;
  /** User's base currency code (for display). */
  baseCurrency: string;
}

export async function getTransactionStats(
  input: ListTransactionsInput & { baseCurrency: string }
): Promise<TransactionStats> {
  await connectToDatabase();

  const filter = buildFilter(input);

  const agg = await Transaction.aggregate<{
    _id: TransactionType;
    total: number;
    count: number;
  }>([
    { $match: filter },
    {
      $group: {
        _id: "$type",
        total: { $sum: "$baseAmount" },
        count: { $sum: 1 },
      },
    },
  ]);

  let expenseTotal = 0;
  let incomeTotal = 0;
  let count = 0;
  for (const row of agg) {
    count += row.count;
    if (row._id === "expense") expenseTotal += row.total;
    else if (row._id === "income") incomeTotal += row.total;
  }

  return {
    expenseTotal,
    incomeTotal,
    count,
    baseCurrency: input.baseCurrency,
  };
}

/**
 * Distinct list of categories the user has ever used. Used to populate
 * the category filter & quick-pick suggestions in the form.
 */
export async function listUserCategories(userId: string): Promise<string[]> {
  await connectToDatabase();
  const values = await Transaction.distinct("category", {
    user: new Types.ObjectId(userId),
    deleted: { $ne: true },
  });
  return (values as string[]).filter(Boolean).sort((a, b) => a.localeCompare(b));
}
