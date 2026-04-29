"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db/mongodb";
import { User } from "@/models/User";
import { requireUser } from "@/lib/auth/session";
import { invalidateUserProfile } from "@/lib/auth/user-profile";
import { isSupportedCurrency } from "@/lib/constants/currencies";

const SUPPORTED_LOCALES = ["en-IN", "en-US"] as const;
const SUPPORTED_TIMEZONES = [
  "Asia/Kolkata",
  "America/New_York",
  "America/Los_Angeles",
  "America/Chicago",
  "Europe/London",
  "Europe/Paris",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
] as const;

const PreferencesSchema = z.object({
  baseCurrency: z.string().refine(isSupportedCurrency, { message: "Unsupported currency" }),
  locale: z.enum(SUPPORTED_LOCALES),
  timeZone: z.enum(SUPPORTED_TIMEZONES),
  notifyOnBudgetExceeded: z.boolean(),
  notifyOnSubscriptionDetected: z.boolean(),
  notifyOnPredictedBill: z.boolean(),
});

export type SettingsActionState = {
  success?: boolean;
  error?: string;
};

export async function saveSettingsAction(
  _prev: SettingsActionState,
  formData: FormData
): Promise<SettingsActionState> {
  const user = await requireUser();

  const parsed = PreferencesSchema.safeParse({
    baseCurrency: formData.get("baseCurrency"),
    locale: formData.get("locale"),
    timeZone: formData.get("timeZone"),
    notifyOnBudgetExceeded: formData.get("notifyOnBudgetExceeded") === "true",
    notifyOnSubscriptionDetected: formData.get("notifyOnSubscriptionDetected") === "true",
    notifyOnPredictedBill: formData.get("notifyOnPredictedBill") === "true",
  });

  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  const { baseCurrency, locale, timeZone, ...notifPrefs } = parsed.data;

  try {
    await connectToDatabase();
    await User.findOneAndUpdate(
      { email: user.email },
      {
        $set: {
          baseCurrency,
          locale,
          timeZone,
          "preferences.notifyOnBudgetExceeded": notifPrefs.notifyOnBudgetExceeded,
          "preferences.notifyOnSubscriptionDetected": notifPrefs.notifyOnSubscriptionDetected,
          "preferences.notifyOnPredictedBill": notifPrefs.notifyOnPredictedBill,
        },
      },
      { upsert: false }
    );

    await invalidateUserProfile(user.id);
    revalidatePath("/dashboard/settings");
    return { success: true };
  } catch {
    return { error: "Failed to save settings. Please try again." };
  }
}
