import Link from "next/link";
import { redirect } from "next/navigation";
import { Waves } from "lucide-react";
import { auth } from "@/lib/auth/config";
import { SocialButtons } from "@/components/auth/SocialButtons";
import { ThemeToggle } from "@/components/ThemeToggle";

interface LoginPageProps {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const session = await auth();

  if (session?.user) {
    redirect(params.callbackUrl || "/dashboard");
  }

  const callbackUrl = params.callbackUrl || "/dashboard";

  return (
    <main className="relative flex min-h-dvh flex-col">
      <header className="flex items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white shadow-lg shadow-brand-600/30">
            <Waves className="h-5 w-5" />
          </span>
          <span className="text-lg tracking-tight">TrackFlow</span>
        </Link>
        <ThemeToggle />
      </header>

      <div className="flex flex-1 items-center justify-center px-6 py-10">
        <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-900/5 dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/30">
          <h1 className="text-center text-2xl font-bold tracking-tight">
            Welcome to TrackFlow
          </h1>
          <p className="mt-2 text-center text-sm text-slate-600 dark:text-slate-400">
            Sign in to track expenses, manage budgets, and chat with your data.
          </p>

          {params.error ? (
            <div
              role="alert"
              className="mt-6 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300"
            >
              Sign-in failed: {params.error}. Please try again.
            </div>
          ) : null}

          <div className="mt-6">
            <SocialButtons callbackUrl={callbackUrl} />
          </div>

          <p className="mt-6 text-center text-xs text-slate-500 dark:text-slate-500">
            By continuing you agree to the Terms of Service and acknowledge the
            Privacy Policy.
          </p>
        </div>
      </div>

      <footer className="px-6 pb-6 text-center text-xs text-slate-500 dark:text-slate-500">
        &copy; {new Date().getFullYear()} TrackFlow
      </footer>
    </main>
  );
}
