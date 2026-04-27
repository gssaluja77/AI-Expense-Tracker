import Link from "next/link";
import { Sparkles, ScanText, Receipt, Repeat, MessageSquareText, Wallet } from "lucide-react";

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

export default function Home() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-16">
      <section className="text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-brand-600">
          AI-FinPilot
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-6xl">
          Your expenses, on autopilot.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-600 dark:text-slate-300">
          A modern PWA expense tracker with AI-powered entry, receipt OCR,
          subscription detection, and a chat-with-your-data assistant.
        </p>
        <div className="mt-8 flex items-center justify-center gap-4">
          <Link
            href="/login"
            className="rounded-xl bg-brand-600 px-6 py-3 font-semibold text-white shadow-lg shadow-brand-600/30 transition hover:bg-brand-700"
          >
            Get started
          </Link>
          <Link
            href="/dashboard"
            className="rounded-xl border border-slate-200 bg-white px-6 py-3 font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            View dashboard
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
