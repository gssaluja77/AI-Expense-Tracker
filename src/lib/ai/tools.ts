import "server-only";
import { tool } from "ai";
import { z } from "zod";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db/mongodb";
import { normalizeCurrency, type SupportedCurrencyCode } from "@/lib/constants/currencies";
import { convertAmount } from "@/lib/fx/rates";
import { Transaction } from "@/models/Transaction";
import { Budget } from "@/models/Budget";
import { DraftTransactionSchema } from "@/types/draft-transaction";

/**
 * AI SDK tools that let the chat model query the authenticated user's
 * financial data. Each tool is bound to a single `userId` + `baseCurrency`
 * via the factory below so that the model can NEVER fabricate or target
 * another user's data — filters are always applied server-side.
 *
 * All monetary values returned to the model are in the user's base
 * currency (typically INR) to keep reasoning consistent regardless of
 * the original transaction currency.
 */

const MAX_ROWS = 50;

const dateRangeShape = {
  from: z
    .string()
    .describe("ISO-8601 start date, inclusive. Omit for no lower bound.")
    .optional(),
  to: z
    .string()
    .describe("ISO-8601 end date, inclusive. Omit for no upper bound.")
    .optional(),
};

function parseRange(from?: string, to?: string) {
  const range: { $gte?: Date; $lte?: Date } = {};
  if (from) {
    const d = new Date(from);
    if (!Number.isNaN(d.getTime())) range.$gte = d;
  }
  if (to) {
    const d = new Date(to);
    if (!Number.isNaN(d.getTime())) {
      // treat `to` as inclusive end-of-day if only a date was given
      if (/^\d{4}-\d{2}-\d{2}$/.test(to)) d.setHours(23, 59, 59, 999);
      range.$lte = d;
    }
  }
  return Object.keys(range).length ? range : undefined;
}

export interface ChatToolsContext {
  /** Mongo `_id` of the `app_users` document — used to scope every query. */
  appUserId: string;
  baseCurrency: string;
  timeZone: string;
}

export function createChatTools({ appUserId, baseCurrency }: ChatToolsContext) {
  const userOid = new Types.ObjectId(appUserId);
  const baseFilter = { user: userOid, deleted: { $ne: true } } as const;

  return {
    /* -------------------------- queryTransactions -------------------------- */
    queryTransactions: tool({
      description:
        "Fetch individual transactions matching the given filters. Use for " +
        "questions about specific purchases, recent activity, or to inspect " +
        "a handful of rows. Do NOT use for totals — prefer `summarizeSpending` " +
        "to avoid streaming large result sets.",
      parameters: z.object({
        ...dateRangeShape,
        category: z
          .string()
          .describe("Exact category name, e.g. 'Food', 'Rent'.")
          .optional(),
        merchant: z
          .string()
          .describe("Merchant substring, case-insensitive.")
          .optional(),
        type: z
          .enum(["expense", "income", "transfer"])
          .describe("Restrict by transaction type.")
          .optional(),
        minAmount: z
          .number()
          .describe("Minimum base-currency amount.")
          .optional(),
        maxAmount: z
          .number()
          .describe("Maximum base-currency amount.")
          .optional(),
        text: z
          .string()
          .describe(
            "Free-text query matched against description, merchant, notes, tags."
          )
          .optional(),
        limit: z
          .number()
          .int()
          .min(1)
          .max(MAX_ROWS)
          .describe(`Max rows to return (1-${MAX_ROWS}).`)
          .default(20),
      }),
      execute: async ({
        from,
        to,
        category,
        merchant,
        type,
        minAmount,
        maxAmount,
        text,
        limit,
      }) => {
        await connectToDatabase();

        const filter: Record<string, unknown> = { ...baseFilter };
        const date = parseRange(from, to);
        if (date) filter.date = date;
        if (category) filter.category = category;
        if (merchant) filter.merchant = { $regex: merchant, $options: "i" };
        if (type) filter.type = type;
        if (minAmount != null || maxAmount != null) {
          const amt: { $gte?: number; $lte?: number } = {};
          if (minAmount != null) amt.$gte = minAmount;
          if (maxAmount != null) amt.$lte = maxAmount;
          filter.baseAmount = amt;
        }
        if (text) filter.$text = { $search: text };

        const docs = await Transaction.find(filter)
          .sort({ date: -1 })
          .limit(limit)
          .select(
            "date amount currency baseAmount type category subcategory merchant description paymentMethod tags"
          )
          .lean();

        return {
          baseCurrency,
          count: docs.length,
          truncated: docs.length === limit,
          transactions: docs.map((d) => ({
            id: String(d._id),
            date: d.date.toISOString(),
            type: d.type,
            category: d.category,
            subcategory: d.subcategory,
            merchant: d.merchant,
            description: d.description,
            amount: d.amount,
            currency: d.currency,
            baseAmount: d.baseAmount,
            paymentMethod: d.paymentMethod,
            tags: d.tags,
          })),
        };
      },
    }),

    /* -------------------------- summarizeSpending -------------------------- */
    summarizeSpending: tool({
      description:
        "Aggregate spend / income totals over a date range, grouped by " +
        "category, merchant, month, or payment method. Use this for " +
        "'how much did I spend on X', 'top merchants', 'monthly trend', etc.",
      parameters: z.object({
        ...dateRangeShape,
        groupBy: z
          .enum(["category", "merchant", "month", "paymentMethod", "type"])
          .describe("Dimension to group by.")
          .default("category"),
        type: z
          .enum(["expense", "income", "transfer"])
          .describe("Limit the aggregation to one transaction type.")
          .optional(),
        category: z
          .string()
          .describe("Only include a specific category.")
          .optional(),
        limit: z
          .number()
          .int()
          .min(1)
          .max(24)
          .describe("Max groups to return, ordered by total desc.")
          .default(10),
      }),
      execute: async ({ from, to, groupBy, type, category, limit }) => {
        await connectToDatabase();

        const match: Record<string, unknown> = { ...baseFilter };
        const date = parseRange(from, to);
        if (date) match.date = date;
        if (type) match.type = type;
        if (category) match.category = category;

        const groupKey =
          groupBy === "month"
            ? { $dateToString: { format: "%Y-%m", date: "$date" } }
            : `$${groupBy}`;

        const rows = await Transaction.aggregate([
          { $match: match },
          {
            $group: {
              _id: groupKey,
              total: { $sum: "$baseAmount" },
              count: { $sum: 1 },
              avg: { $avg: "$baseAmount" },
            },
          },
          { $sort: { total: -1 } },
          { $limit: limit },
        ]);

        const grandTotal = rows.reduce((s, r) => s + (r.total ?? 0), 0);

        return {
          baseCurrency,
          groupBy,
          range: { from: from ?? null, to: to ?? null },
          total: Number(grandTotal.toFixed(2)),
          transactions: rows.reduce((s, r) => s + (r.count ?? 0), 0),
          groups: rows.map((r) => ({
            key: r._id ?? "Unknown",
            total: Number((r.total ?? 0).toFixed(2)),
            count: r.count ?? 0,
            average: Number((r.avg ?? 0).toFixed(2)),
          })),
        };
      },
    }),

    /* -------------------------- getBudgetStatus ---------------------------- */
    getBudgetStatus: tool({
      description:
        "List the user's active budget envelopes with their spent / limit " +
        "progress for the current period. Use when the user asks about " +
        "budgets, limits, or whether they are over-spending.",
      parameters: z.object({
        category: z
          .string()
          .describe("Only include budgets for this category.")
          .optional(),
      }),
      execute: async ({ category }) => {
        await connectToDatabase();

        const budgetFilter: Record<string, unknown> = {
          user: userOid,
          archived: { $ne: true },
        };
        if (category) budgetFilter.category = category;

        const budgets = await Budget.find(budgetFilter).lean();
        if (!budgets.length) {
          return { baseCurrency, budgets: [] };
        }

        const now = new Date();
        const results = await Promise.all(
          budgets.map(async (b) => {
            const periodStart = computePeriodStart(b.period, b.startDate, now);
            const spentAgg = await Transaction.aggregate([
              {
                $match: {
                  ...baseFilter,
                  type: "expense",
                  category: b.category,
                  date: { $gte: periodStart, $lte: now },
                },
              },
              { $group: { _id: null, total: { $sum: "$baseAmount" } } },
            ]);
            const spent = spentAgg[0]?.total ?? 0;
            const remaining = Math.max(b.limit - spent, 0);
            const percent = b.limit > 0 ? spent / b.limit : 0;
            return {
              id: String(b._id),
              name: b.name,
              category: b.category,
              period: b.period,
              periodStart: periodStart.toISOString(),
              limit: b.limit,
              spent: Number(spent.toFixed(2)),
              remaining: Number(remaining.toFixed(2)),
              percentUsed: Number((percent * 100).toFixed(1)),
              overBudget: spent > b.limit,
            };
          })
        );

        return { baseCurrency, budgets: results };
      },
    }),

    /* -------------------------- proposeTransaction ------------------------- */
    proposeTransaction: tool({
      description:
        "Draft a new transaction from what the user just described (text " +
        "NLP entry) and show it to them for review. USE THIS — and only " +
        "this — when the user asks to add / log / record / save a new " +
        "expense, income, or transfer. Extract the amount, merchant, " +
        "category, date, and any other details you can confidently infer. " +
        "NEVER claim the transaction was saved; the user must confirm the " +
        "draft in the UI and the tool result will tell you the outcome.",
      parameters: DraftTransactionSchema,
      // No `execute` — AI SDK forwards this call to the client, which
      // renders a review card and supplies the result via addToolResult().
    }),

    /* -------------------------- convertCurrency --------------------------- */
    convertCurrency: tool({
      description:
        "Convert a numeric amount from the user's base currency into INR or USD " +
        "using the app's exchange-rate service. Use when the user asks for figures " +
        `in another currency (e.g. "show that in USD"). All other tools return ` +
        `amounts in ${baseCurrency} first — call this after you have the base-currency ` +
        "number you want to translate.",
      parameters: z.object({
        amount: z
          .number()
          .describe(
            "Amount in the user's base currency (same units as query/summary tools)."
          ),
        toCurrency: z
          .enum(["INR", "USD"])
          .describe("Target ISO currency code."),
      }),
      execute: async ({ amount, toCurrency }) => {
        const from = normalizeCurrency(baseCurrency) as SupportedCurrencyCode;
        const to = toCurrency as SupportedCurrencyCode;
        if (from === to) {
          return {
            fromCurrency: from,
            toCurrency: to,
            amount,
            convertedAmount: Math.round(amount * 100) / 100,
            rate: 1,
          };
        }
        const { amount: converted, rate } = await convertAmount(amount, from, to);
        return {
          fromCurrency: from,
          toCurrency: to,
          amount,
          convertedAmount: converted,
          rate,
          disclaimer:
            "FX is for display; canonical stored totals remain in " + from + ".",
        };
      },
    }),

    /* -------------------------- getSpendingTotals -------------------------- */
    getSpendingTotals: tool({
      description:
        "Return overall income, expense, and net savings totals for a date " +
        "range. Great for top-line questions like 'how did I do last month?'.",
      parameters: z.object(dateRangeShape),
      execute: async ({ from, to }) => {
        await connectToDatabase();
        const match: Record<string, unknown> = { ...baseFilter };
        const date = parseRange(from, to);
        if (date) match.date = date;

        const rows = await Transaction.aggregate([
          { $match: match },
          {
            $group: {
              _id: "$type",
              total: { $sum: "$baseAmount" },
              count: { $sum: 1 },
            },
          },
        ]);

        const byType: Record<string, { total: number; count: number }> = {};
        for (const r of rows) byType[r._id] = { total: r.total, count: r.count };

        const income = byType.income?.total ?? 0;
        const expense = byType.expense?.total ?? 0;

        return {
          baseCurrency,
          range: { from: from ?? null, to: to ?? null },
          income: Number(income.toFixed(2)),
          expense: Number(expense.toFixed(2)),
          net: Number((income - expense).toFixed(2)),
          transactions: rows.reduce((s, r) => s + (r.count ?? 0), 0),
        };
      },
    }),
  };
}

function computePeriodStart(
  period: "weekly" | "monthly" | "quarterly" | "yearly" | "custom",
  startDate: Date,
  now: Date
): Date {
  const d = new Date(now);
  switch (period) {
    case "weekly": {
      const day = d.getDay();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - day);
      return d;
    }
    case "monthly":
      return new Date(d.getFullYear(), d.getMonth(), 1);
    case "quarterly": {
      const q = Math.floor(d.getMonth() / 3);
      return new Date(d.getFullYear(), q * 3, 1);
    }
    case "yearly":
      return new Date(d.getFullYear(), 0, 1);
    case "custom":
    default:
      return startDate;
  }
}
