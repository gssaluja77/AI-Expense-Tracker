import Link from "next/link";
import { redirect } from "next/navigation";
import { TrackFlowLogo } from "@/components/brand/TrackFlowLogo";
import {
  Sparkles,
  ScanText,
  Receipt,
  Repeat,
  MessageSquareText,
  Wallet,
} from "lucide-react";
import { auth } from "@/lib/auth/config";
import { ThemeToggle } from "@/components/ThemeToggle";

const features = [
  {
    icon: Sparkles,
    title: "Natural-language entry",
    body: "Type 'Spent 500 on dinner with team' and we log it instantly.",
  },
  {
    icon: ScanText,
    title: "Receipt OCR",
    body: "Snap a photo — Gemini 2.0 Flash extracts merchant, items, and totals.",
  },
  {
    icon: Repeat,
    title: "Smart subscriptions",
    body: "We detect recurring charges and predict upcoming bills.",
  },
  {
    icon: MessageSquareText,
    title: "Chat with your data",
    body: "Ask: 'How much did I spend on food last month?' and get answers.",
  },
  {
    icon: Receipt,
    title: "Budget envelopes",
    body: "Category limits with live progress and proactive alerts.",
  },
  {
    icon: Wallet,
    title: "Multi-currency",
    body: "Spend abroad, see everything normalised to your base currency.",
  },
];

export default async function Home() {
  const session = await auth();
  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <main className="relative mx-auto max-w-6xl px-6 pb-16 pt-8">
      <header className="flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <TrackFlowLogo size={36} className="shrink-0 shadow-lg shadow-brand-600/30 rounded-xl" />
          <span className="text-lg tracking-tight">TrackFlow</span>
        </Link>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link
            href="/login"
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
          >
            Sign in
          </Link>
        </div>
      </header>

      <section className="mt-16 text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-brand-500">
          TrackFlow
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-6xl">
          Your expenses, on autopilot.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-600 dark:text-slate-300">
          A modern PWA expense tracker with AI-powered entry, receipt OCR,
          subscription detection, and a chat-with-your-data assistant.
        </p>
        <div className="mt-8 flex items-center justify-center">
          <Link
            href="/login"
            className="rounded-xl bg-brand-600 px-6 py-3 font-semibold text-white shadow-lg shadow-brand-600/30 transition hover:bg-brand-700"
          >
            Get started
          </Link>
        </div>
      </section>

      <section className="mt-20 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {features.map(({ icon: Icon, title, body }) => (
          <div
            key={title}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-300">
              <Icon className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-lg font-semibold">{title}</h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{body}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
