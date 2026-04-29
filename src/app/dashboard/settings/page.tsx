import { requireUser } from "@/lib/auth/session";
import { SettingsForm } from "@/components/settings/SettingsForm";

export const metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireUser();

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Settings
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Manage your profile, currency, and notification preferences.
        </p>
      </div>

      <SettingsForm user={user} />
    </div>
  );
}
