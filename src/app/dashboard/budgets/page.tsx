import { requireUser } from "@/lib/auth/session";
import { getBudgetsSummary } from "@/lib/budgets/queries";
import { BudgetsView } from "@/components/budgets/BudgetsView";

export const metadata = { title: "Budgets" };

// Budgets shift in real-time with each new transaction, so skip the full-page
// cache. The actual Mongo aggregation is still memoised per-user in Redis.
export const dynamic = "force-dynamic";

export default async function BudgetsPage() {
  const user = await requireUser();
  // Budgets & transactions are scoped to the `app_users._id` (user.appUserId),
  // not the NextAuth adapter user id. Using user.id here would show an empty list.
  const budgets = await getBudgetsSummary(user.appUserId, user.baseCurrency);

  return (
    <BudgetsView budgets={budgets} defaultCurrency={user.baseCurrency} />
  );
}
