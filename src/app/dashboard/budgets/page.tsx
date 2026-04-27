import { requireUser } from "@/lib/auth/session";
import { getBudgetsSummary } from "@/lib/budgets/queries";
import { BudgetsView } from "@/components/budgets/BudgetsView";

export const metadata = { title: "Budgets" };

// Budgets shift in real-time with each new transaction, so skip the full-page
// cache. The actual Mongo aggregation is still memoised per-user in Redis.
export const dynamic = "force-dynamic";

export default async function BudgetsPage() {
  const user = await requireUser();
  const budgets = await getBudgetsSummary(user.id, user.baseCurrency);

  return (
    <BudgetsView budgets={budgets} defaultCurrency={user.baseCurrency} />
  );
}
