"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles, AlertCircle, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { DraftReviewForm } from "@/components/transactions/DraftReviewForm";
import type { DraftTransaction } from "@/types/draft-transaction";

/**
 * One-line natural-language entry for the dashboard.
 *
 * Flow:
 *   1. User types something like "Spent 450 on dinner at Olive yesterday"
 *      and hits Enter (or the arrow button).
 *   2. We POST `{ text }` to `/api/transactions/parse`, which runs the
 *      Gemini-backed parser and returns a structured {@link DraftTransaction}.
 *   3. The returned draft is rendered inline via `<DraftReviewForm>` so the
 *      user can tweak any field before saving.
 *   4. On save, the draft persists through `createTransactionFromDraftAction`
 *      (which the review form already calls) and we `router.refresh()` so the
 *      dashboard totals and recent-transactions list update immediately.
 *
 * Error, loading, and empty states are all handled inline — no modals.
 */

interface DashboardNlpEntryProps {
  baseCurrency: string;
  /**
   * Optional suggestion chips shown beneath the input on first use. Fall back
   * to a sensible default set if none are provided.
   */
  examples?: string[];
}

const DEFAULT_EXAMPLES = [
  "Spent 450 on dinner at Olive yesterday",
  "Paid 1299 for Netflix subscription",
  "Got 50000 salary from Acme Corp today",
  "Uber to office 220",
];

type Stage =
  | { kind: "idle" }
  | { kind: "parsing"; text: string }
  | { kind: "review"; text: string; draft: DraftTransaction }
  | { kind: "error"; text: string; message: string };

export function DashboardNlpEntry({
  baseCurrency,
  examples = DEFAULT_EXAMPLES,
}: DashboardNlpEntryProps) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [stage, setStage] = useState<Stage>({ kind: "idle" });
  const [, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const parsing = stage.kind === "parsing";

  async function runParse(nextText: string) {
    const trimmed = nextText.trim();
    if (!trimmed) return;
    setStage({ kind: "parsing", text: trimmed });
    try {
      const res = await fetch("/api/transactions/parse", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: trimmed }),
      });
      const payload = (await res.json().catch(() => ({}))) as {
        draft?: DraftTransaction;
        error?: string;
      };
      if (!res.ok || !payload.draft) {
        setStage({
          kind: "error",
          text: trimmed,
          message: payload.error || `Parse failed (${res.status}).`,
        });
        return;
      }
      setStage({ kind: "review", text: trimmed, draft: payload.draft });
    } catch (err) {
      setStage({
        kind: "error",
        text: trimmed,
        message: err instanceof Error ? err.message : "Network error.",
      });
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    startTransition(() => {
      runParse(text);
    });
  }

  function handleExampleClick(example: string) {
    setText(example);
    inputRef.current?.focus();
    startTransition(() => {
      runParse(example);
    });
  }

  function handleSaved() {
    setText("");
    setStage({ kind: "idle" });
    router.refresh();
  }

  function handleCancel() {
    setStage({ kind: "idle" });
    setText("");
    inputRef.current?.focus();
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-950/50 dark:text-brand-300">
          <Sparkles className="h-4 w-4" />
        </span>
        <div>
          <p className="text-sm font-semibold">Log with AI</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Describe what you spent and we&apos;ll structure it for you.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-3">
        <div
          className={cn(
            "flex items-stretch rounded-xl border bg-white shadow-sm transition focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-200 dark:bg-slate-950 dark:focus-within:ring-brand-900/50",
            stage.kind === "error"
              ? "border-rose-300 dark:border-rose-900/60"
              : "border-slate-200 dark:border-slate-800"
          )}
        >
          <input
            ref={inputRef}
            type="text"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (stage.kind === "error") setStage({ kind: "idle" });
            }}
            disabled={parsing}
            placeholder="e.g. Spent 500 on coffee at Starbucks"
            aria-label="Describe a transaction in plain English"
            className="flex-1 rounded-l-xl bg-transparent px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 disabled:opacity-60 dark:text-slate-200"
          />
          <button
            type="submit"
            disabled={parsing || !text.trim()}
            className="inline-flex items-center gap-1.5 rounded-r-xl bg-brand-600 px-4 text-xs font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
            aria-label="Parse transaction"
          >
            {parsing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ArrowRight className="h-3.5 w-3.5" />
            )}
            <span className="hidden sm:inline">
              {parsing ? "Parsing" : "Parse"}
            </span>
          </button>
        </div>
      </form>

      {stage.kind === "error" ? (
        <div
          role="alert"
          className="mt-3 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300"
        >
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-none" />
          <span>{stage.message}</span>
        </div>
      ) : null}

      {stage.kind === "idle" && examples.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {examples.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => handleExampleClick(ex)}
              className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] text-slate-600 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300 dark:hover:border-brand-800 dark:hover:bg-brand-950/40 dark:hover:text-brand-200"
            >
              {ex}
            </button>
          ))}
        </div>
      ) : null}

      {stage.kind === "review" ? (
        <div className="mt-4">
          <DraftReviewForm
            key={stage.text}
            draft={stage.draft}
            baseCurrency={baseCurrency}
            source="nlp"
            onSaved={handleSaved}
            onCancel={handleCancel}
            confirmLabel="Save transaction"
            compact
          />
        </div>
      ) : null}
    </section>
  );
}
