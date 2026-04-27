import type { IBudget } from "@/models/Budget";

export type BudgetPeriod = IBudget["period"];

export interface PeriodWindow {
  start: Date;
  end: Date;
  label: string;
}

/**
 * Compute the currently-active window for a budget.
 *
 * Rolling budgets (weekly / monthly / quarterly / yearly) anchor on calendar
 * boundaries so progress resets predictably. Custom budgets use the explicit
 * start / end dates stored on the document.
 */
export function getCurrentPeriodWindow(
  period: BudgetPeriod,
  startDate: Date | string,
  endDate?: Date | string,
  now: Date = new Date()
): PeriodWindow {
  switch (period) {
    case "weekly":
      return weeklyWindow(now);
    case "monthly":
      return monthlyWindow(now);
    case "quarterly":
      return quarterlyWindow(now);
    case "yearly":
      return yearlyWindow(now);
    case "custom": {
      const start = new Date(startDate);
      const end = endDate ? new Date(endDate) : new Date(start.getTime());
      if (!endDate) end.setFullYear(end.getFullYear() + 1);
      return {
        start,
        end,
        label: `${formatDay(start)} – ${formatDay(end)}`,
      };
    }
  }
}

function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

function endOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(23, 59, 59, 999);
  return out;
}

function weeklyWindow(now: Date): PeriodWindow {
  const day = now.getDay(); // 0 = Sunday
  const diffToMonday = (day + 6) % 7;
  const start = startOfDay(new Date(now));
  start.setDate(start.getDate() - diffToMonday);
  const end = endOfDay(new Date(start));
  end.setDate(end.getDate() + 6);
  return { start, end, label: `Week of ${formatDay(start)}` };
}

function monthlyWindow(now: Date): PeriodWindow {
  const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  const label = start.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
  return { start, end, label };
}

function quarterlyWindow(now: Date): PeriodWindow {
  const quarter = Math.floor(now.getMonth() / 3); // 0..3
  const startMonth = quarter * 3;
  const start = new Date(now.getFullYear(), startMonth, 1, 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), startMonth + 3, 0, 23, 59, 59, 999);
  return { start, end, label: `Q${quarter + 1} ${now.getFullYear()}` };
}

function yearlyWindow(now: Date): PeriodWindow {
  const start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
  return { start, end, label: `${now.getFullYear()}` };
}

function formatDay(d: Date): string {
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Human-friendly period label for the UI */
export function describePeriod(period: BudgetPeriod): string {
  switch (period) {
    case "weekly":
      return "Weekly";
    case "monthly":
      return "Monthly";
    case "quarterly":
      return "Quarterly";
    case "yearly":
      return "Yearly";
    case "custom":
      return "Custom";
  }
}
