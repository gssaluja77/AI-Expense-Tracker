/**
 * Centralised list of currencies the app supports. Keep this short and
 * explicit — every form dropdown, server validator, and AI prompt reads
 * from here, so adding a currency is a single-edit change.
 *
 * MVP scope: INR + USD. Multi-currency FX polish will broaden this list.
 */

export const SUPPORTED_CURRENCIES = [
  { code: "INR", label: "INR — Indian Rupee", symbol: "₹" },
  { code: "USD", label: "USD — US Dollar", symbol: "$" },
] as const;

export type SupportedCurrencyCode = (typeof SUPPORTED_CURRENCIES)[number]["code"];

export const SUPPORTED_CURRENCY_CODES = SUPPORTED_CURRENCIES.map(
  (c) => c.code
) as SupportedCurrencyCode[];

export const DEFAULT_CURRENCY: SupportedCurrencyCode = "INR";

export function isSupportedCurrency(
  value: unknown
): value is SupportedCurrencyCode {
  return (
    typeof value === "string" &&
    (SUPPORTED_CURRENCY_CODES as readonly string[]).includes(value)
  );
}

/**
 * Normalise arbitrary input (from AI output, old records, URL params, etc.)
 * to a supported currency code, falling back to the provided default (or
 * the app default) when unsupported.
 */
export function normalizeCurrency(
  value: unknown,
  fallback: SupportedCurrencyCode = DEFAULT_CURRENCY
): SupportedCurrencyCode {
  if (typeof value === "string") {
    const up = value.trim().toUpperCase();
    if ((SUPPORTED_CURRENCY_CODES as readonly string[]).includes(up)) {
      return up as SupportedCurrencyCode;
    }
  }
  return fallback;
}
