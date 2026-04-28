/**
 * UI-only constants for the Budgets module. These are deliberately
 * duplicated from the server validation layer so that client bundles don't
 * have to pull in zod just to render the form.
 */

export const BUDGET_PERIODS = [
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
  { value: "custom", label: "Custom" },
] as const;

/**
 * Reasonable defaults shown in the category picker. Users can still type a
 * free-form value — this list is only to save them the typing. When the
 * Category collection is populated per-user we'll source this from there.
 */
export const SUGGESTED_CATEGORIES = [
  "Food",
  "Groceries",
  "Dining",
  "Transport",
  "Shopping",
  "Entertainment",
  "Utilities",
  "Rent",
  "Health",
  "Travel",
  "Education",
  "Subscriptions",
  "Fitness",
  "Personal Care",
  "Gifts",
  "Other",
];

export { SUPPORTED_CURRENCIES, SUPPORTED_CURRENCY_CODES } from "@/lib/constants/currencies";

export function formatMoney(
  amount: number,
  currency: string,
  locale: string = typeof navigator !== "undefined" ? navigator.language : "en-IN"
): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}
