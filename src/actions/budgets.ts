"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import mongoose from "mongoose";
import { requireUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/db/mongodb";
import { Budget } from "@/models/Budget";
import { cacheKey, invalidateCache } from "@/lib/cache/redis";
import { toUserObjectId } from "@/lib/budgets/queries";

/**
 * Server Actions for the Budgets module.
 *
 * All mutations:
 *   • authenticate via {@link requireUser}
 *   • validate input with zod
 *   • invalidate the cached budgets summary for the user
 *   • revalidate the `/dashboard/budgets` route so the Server Component
 *     re-runs and the UI picks up changes without a full reload.
 */

export interface BudgetActionResult {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
}

const periodEnum = z.enum([
  "weekly",
  "monthly",
  "quarterly",
  "yearly",
  "custom",
]);

const baseSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  category: z.string().trim().min(1, "Category is required").max(60),
  limit: z.coerce.number().positive("Limit must be greater than 0"),
  currency: z
    .string()
    .trim()
    .length(3, "Currency must be a 3-letter code")
    .transform((s) => s.toUpperCase()),
  period: periodEnum,
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional(),
  rolloverUnused: z.coerce.boolean().optional().default(false),
  alertThreshold: z.coerce
    .number()
    .min(0, "Alert threshold must be between 0 and 1")
    .max(1, "Alert threshold must be between 0 and 1")
    .optional()
    .default(0.8),
});

function parseFormData(formData: FormData): BudgetActionResult | z.infer<typeof baseSchema> {
  // Checkbox inputs only appear in FormData when checked, so normalise.
  const raw: Record<string, FormDataEntryValue | boolean | undefined> = {
    name: formData.get("name") ?? undefined,
    category: formData.get("category") ?? undefined,
    limit: formData.get("limit") ?? undefined,
    currency: formData.get("currency") ?? undefined,
    period: formData.get("period") ?? undefined,
    startDate: formData.get("startDate") ?? undefined,
    endDate: formData.get("endDate") || undefined,
    rolloverUnused: formData.get("rolloverUnused") === "on",
    alertThreshold: formData.get("alertThreshold") ?? undefined,
  };

  const parsed = baseSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !fieldErrors[key]) {
        fieldErrors[key] = issue.message;
      }
    }
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
  }

  if (parsed.data.period === "custom" && !parsed.data.endDate) {
    return {
      ok: false,
      error: "Custom budgets need an end date.",
      fieldErrors: { endDate: "End date is required for custom periods." },
    };
  }

  return parsed.data;
}

async function invalidateBudgets(userId: string): Promise<void> {
  await invalidateCache([cacheKey.budgets(userId), cacheKey.dashboard(userId)]);
}

export async function createBudget(
  _prev: BudgetActionResult | undefined,
  formData: FormData
): Promise<BudgetActionResult> {
  const user = await requireUser();
  const userObjectId = toUserObjectId(user.id);
  if (!userObjectId) return { ok: false, error: "Invalid session. Sign in again." };

  const parsed = parseFormData(formData);
  if ("ok" in parsed) return parsed;

  await connectToDatabase();
  await Budget.create({ ...parsed, user: userObjectId });
  await invalidateBudgets(user.id);

  revalidatePath("/dashboard/budgets");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function updateBudget(
  id: string,
  _prev: BudgetActionResult | undefined,
  formData: FormData
): Promise<BudgetActionResult> {
  const user = await requireUser();
  const userObjectId = toUserObjectId(user.id);
  if (!userObjectId) return { ok: false, error: "Invalid session. Sign in again." };
  if (!mongoose.isValidObjectId(id)) {
    return { ok: false, error: "That budget no longer exists." };
  }

  const parsed = parseFormData(formData);
  if ("ok" in parsed) return parsed;

  await connectToDatabase();
  const result = await Budget.updateOne(
    { _id: id, user: userObjectId },
    { $set: parsed }
  );

  if (result.matchedCount === 0) {
    return { ok: false, error: "That budget no longer exists." };
  }

  await invalidateBudgets(user.id);
  revalidatePath("/dashboard/budgets");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteBudget(id: string): Promise<BudgetActionResult> {
  const user = await requireUser();
  const userObjectId = toUserObjectId(user.id);
  if (!userObjectId) return { ok: false, error: "Invalid session." };
  if (!mongoose.isValidObjectId(id)) return { ok: false, error: "Unknown budget." };

  await connectToDatabase();
  await Budget.deleteOne({ _id: id, user: userObjectId });
  await invalidateBudgets(user.id);

  revalidatePath("/dashboard/budgets");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function setBudgetArchived(
  id: string,
  archived: boolean
): Promise<BudgetActionResult> {
  const user = await requireUser();
  const userObjectId = toUserObjectId(user.id);
  if (!userObjectId) return { ok: false, error: "Invalid session." };
  if (!mongoose.isValidObjectId(id)) return { ok: false, error: "Unknown budget." };

  await connectToDatabase();
  await Budget.updateOne(
    { _id: id, user: userObjectId },
    { $set: { archived } }
  );
  await invalidateBudgets(user.id);

  revalidatePath("/dashboard/budgets");
  return { ok: true };
}
