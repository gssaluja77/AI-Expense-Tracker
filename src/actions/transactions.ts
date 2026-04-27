"use server";

import { revalidatePath } from "next/cache";
import { Types } from "mongoose";
import { z } from "zod";

import { requireUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/db/mongodb";
import { Transaction } from "@/models/Transaction";
import {
  cacheKey,
  invalidateByPattern,
  invalidateCache,
} from "@/lib/cache/redis";
import type { ConfirmedTransaction } from "@/types/draft-transaction";

/**
 * Server Actions for the Transactions module.
 *
 * Every mutation:
 *   • Authenticates via {@link requireUser} (redirects if unauthenticated).
 *   • Validates input with Zod — we never trust raw FormData.
 *   • Scopes the query to the user's `app_users._id`.
 *   • Invalidates the dashboard + category-totals cache so derived views
 *     immediately reflect the change.
 *   • Revalidates the `/dashboard/transactions` path so the list re-renders.
 */

const CURRENCY_REGEX = /^[A-Z]{3}$/;

const TransactionTypeSchema = z.enum(["expense", "income", "transfer"]);
const PaymentMethodSchema = z
  .enum(["cash", "card", "upi", "bank", "wallet", "other"])
  .optional();

const BaseTransactionSchema = z.object({
  type: TransactionTypeSchema.default("expense"),
  amount: z
    .coerce.number({ invalid_type_error: "Amount must be a number." })
    .positive("Amount must be greater than 0.")
    .max(1_000_000_000, "Amount is too large."),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(CURRENCY_REGEX, "Currency must be a 3-letter ISO code.")
    .default("INR"),
  category: z
    .string()
    .trim()
    .min(1, "Category is required.")
    .max(60, "Category is too long.")
    .default("Uncategorized"),
  merchant: z.string().trim().max(120).optional().or(z.literal("").transform(() => undefined)),
  description: z.string().trim().max(280).optional().or(z.literal("").transform(() => undefined)),
  notes: z.string().trim().max(1000).optional().or(z.literal("").transform(() => undefined)),
  tags: z
    .string()
    .optional()
    .transform((v) =>
      (v ?? "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 10)
    ),
  date: z
    .string()
    .optional()
    .transform((v, ctx) => {
      if (!v) return new Date();
      const d = new Date(v);
      if (Number.isNaN(d.getTime())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Invalid date.",
        });
        return z.NEVER;
      }
      return d;
    }),
  paymentMethod: PaymentMethodSchema,
});

export type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

function formDataToObject(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of formData.entries()) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

function flattenFieldErrors(
  err: z.ZodError
): Record<string, string[]> {
  const flat = err.flatten();
  const entries = Object.entries(flat.fieldErrors).filter(
    ([, v]) => Array.isArray(v) && v.length > 0
  );
  return Object.fromEntries(entries) as Record<string, string[]>;
}

async function invalidateUserDashboardCaches(userId: string) {
  await Promise.all([
    invalidateCache(cacheKey.dashboard(userId)),
    invalidateByPattern(cacheKey.userScope(userId)),
  ]).catch(() => {
    /* non-fatal */
  });
}

/* -------------------------------------------------------------------------- */
/*                                   Create                                   */
/* -------------------------------------------------------------------------- */

export async function createTransactionAction(
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();

  const parsed = BaseTransactionSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: flattenFieldErrors(parsed.error),
    };
  }
  const input = parsed.data;

  await connectToDatabase();

  const baseCurrency = user.baseCurrency || "INR";
  // MVP: exchangeRate 1 until the multi-currency FX feature lands.
  const exchangeRate = input.currency === baseCurrency ? 1 : 1;
  const baseAmount = input.amount * exchangeRate;

  try {
    const doc = await Transaction.create({
      user: new Types.ObjectId(user.appUserId),
      type: input.type,
      amount: input.amount,
      currency: input.currency,
      baseAmount,
      baseCurrency,
      exchangeRate,
      category: input.category,
      merchant: input.merchant,
      description: input.description,
      notes: input.notes,
      tags: input.tags,
      date: input.date,
      paymentMethod: input.paymentMethod,
      source: "manual",
    });

    await invalidateUserDashboardCaches(user.appUserId);
    revalidatePath("/dashboard/transactions");
    revalidatePath("/dashboard");

    return { ok: true, data: { id: doc._id.toString() } };
  } catch (err) {
    console.error("[transactions] create failed", err);
    return { ok: false, error: "Could not save the transaction. Please try again." };
  }
}

/* -------------------------------------------------------------------------- */
/*                        Create from AI-generated draft                      */
/* -------------------------------------------------------------------------- */

const ConfirmedDraftSchema = z.object({
  type: z.enum(["expense", "income", "transfer"]).default("expense"),
  amount: z.coerce.number().positive().max(1_000_000_000),
  currency: z.string().trim().toUpperCase().regex(CURRENCY_REGEX).default("INR"),
  category: z.string().trim().min(1).max(60).default("Uncategorized"),
  merchant: z.string().trim().max(120).optional(),
  description: z.string().trim().max(280).optional(),
  notes: z.string().trim().max(2000).optional(),
  date: z
    .string()
    .optional()
    .transform((v, ctx) => {
      if (!v) return new Date();
      const d = new Date(v);
      if (Number.isNaN(d.getTime())) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid date." });
        return z.NEVER;
      }
      return d;
    }),
  paymentMethod: z
    .enum(["cash", "card", "upi", "bank", "wallet", "other"])
    .optional(),
  tags: z.array(z.string().trim().max(32)).max(10).optional(),
  source: z.enum(["nlp", "ocr", "manual"]).default("manual"),
  receipt: z
    .object({
      url: z.string().min(1),
      mimeType: z.string().optional(),
      ocrText: z.string().optional(),
      confidence: z.number().min(0).max(1).optional(),
    })
    .optional(),
});

export async function createTransactionFromDraftAction(
  input: ConfirmedTransaction
): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();

  const parsed = ConfirmedDraftSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "The draft is missing required fields.",
      fieldErrors: flattenFieldErrors(parsed.error),
    };
  }
  const data = parsed.data;

  await connectToDatabase();

  const baseCurrency = user.baseCurrency || "INR";
  // MVP: exchangeRate 1 until the multi-currency FX feature lands.
  const exchangeRate = 1;
  const baseAmount = data.amount * exchangeRate;

  try {
    const doc = await Transaction.create({
      user: new Types.ObjectId(user.appUserId),
      type: data.type,
      amount: data.amount,
      currency: data.currency,
      baseAmount,
      baseCurrency,
      exchangeRate,
      category: data.category,
      merchant: data.merchant,
      description: data.description,
      notes: data.notes,
      tags: data.tags ?? [],
      date: data.date,
      paymentMethod: data.paymentMethod,
      source: data.source,
      receipt: data.receipt
        ? { ...data.receipt, processedAt: new Date() }
        : undefined,
    });

    await invalidateUserDashboardCaches(user.appUserId);
    revalidatePath("/dashboard/transactions");
    revalidatePath("/dashboard");

    return { ok: true, data: { id: doc._id.toString() } };
  } catch (err) {
    console.error("[transactions] create-from-draft failed", err);
    return {
      ok: false,
      error: "Could not save the transaction. Please try again.",
    };
  }
}

/* -------------------------------------------------------------------------- */
/*                                   Update                                   */
/* -------------------------------------------------------------------------- */

const UpdateSchema = BaseTransactionSchema.extend({
  id: z.string().min(1, "Transaction id is required."),
});

export async function updateTransactionAction(
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();

  const parsed = UpdateSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: flattenFieldErrors(parsed.error),
    };
  }
  const { id, ...input } = parsed.data;

  if (!Types.ObjectId.isValid(id)) {
    return { ok: false, error: "Invalid transaction id." };
  }

  await connectToDatabase();

  const baseCurrency = user.baseCurrency || "INR";
  const exchangeRate = input.currency === baseCurrency ? 1 : 1;
  const baseAmount = input.amount * exchangeRate;

  const result = await Transaction.findOneAndUpdate(
    {
      _id: new Types.ObjectId(id),
      user: new Types.ObjectId(user.appUserId),
      deleted: { $ne: true },
    },
    {
      $set: {
        type: input.type,
        amount: input.amount,
        currency: input.currency,
        baseAmount,
        baseCurrency,
        exchangeRate,
        category: input.category,
        merchant: input.merchant,
        description: input.description,
        notes: input.notes,
        tags: input.tags,
        date: input.date,
        paymentMethod: input.paymentMethod,
      },
    },
    { new: true }
  );

  if (!result) {
    return { ok: false, error: "Transaction not found." };
  }

  await invalidateUserDashboardCaches(user.appUserId);
  revalidatePath("/dashboard/transactions");
  revalidatePath("/dashboard");

  return { ok: true, data: { id: result._id.toString() } };
}

/* -------------------------------------------------------------------------- */
/*                                   Delete                                   */
/* -------------------------------------------------------------------------- */

export async function deleteTransactionAction(
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const id = formData.get("id");

  if (typeof id !== "string" || !Types.ObjectId.isValid(id)) {
    return { ok: false, error: "Invalid transaction id." };
  }

  await connectToDatabase();

  const result = await Transaction.findOneAndUpdate(
    {
      _id: new Types.ObjectId(id),
      user: new Types.ObjectId(user.appUserId),
      deleted: { $ne: true },
    },
    { $set: { deleted: true } },
    { new: true }
  );

  if (!result) {
    return { ok: false, error: "Transaction not found." };
  }

  await invalidateUserDashboardCaches(user.appUserId);
  revalidatePath("/dashboard/transactions");
  revalidatePath("/dashboard");

  return { ok: true, data: { id: result._id.toString() } };
}
