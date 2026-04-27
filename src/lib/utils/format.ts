/**
 * Small framework-agnostic formatters. Safe for both server and client
 * components — no DOM or Node-only APIs here.
 */

const currencyFormatters = new Map<string, Intl.NumberFormat>();

export function formatCurrency(
  amount: number,
  currency: string,
  locale = "en-IN"
): string {
  const key = `${locale}:${currency}`;
  let fmt = currencyFormatters.get(key);
  if (!fmt) {
    try {
      fmt = new Intl.NumberFormat(locale, {
        style: "currency",
        currency,
        maximumFractionDigits: 2,
      });
    } catch {
      // Fallback for unknown currency codes — still return something sane.
      fmt = new Intl.NumberFormat(locale, {
        style: "decimal",
        maximumFractionDigits: 2,
      });
    }
    currencyFormatters.set(key, fmt);
  }
  return fmt.format(amount);
}

export function formatDate(
  value: string | Date,
  locale = "en-IN"
): string {
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function toDateInputValue(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "";
  // YYYY-MM-DD in local time for <input type="date">
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}
