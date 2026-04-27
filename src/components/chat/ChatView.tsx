"use client";

import { useEffect, useRef, type FormEvent } from "react";
import { useChat } from "@ai-sdk/react";
import {
  ArrowUp,
  Loader2,
  MessageSquareText,
  RefreshCw,
  Sparkles,
  Square,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { DraftReviewForm } from "@/components/transactions/DraftReviewForm";
import type { DraftTransaction } from "@/types/draft-transaction";

const SUGGESTIONS = [
  "How much did I spend last month?",
  "Top 5 categories this month",
  "Am I over any budget right now?",
  "Show my last 10 expenses",
  "Add ₹450 spent on dinner at Olive today",
];

interface ChatViewProps {
  userName?: string | null;
  baseCurrency: string;
}

export function ChatView({ userName, baseCurrency }: ChatViewProps) {
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    append,
    status,
    stop,
    reload,
    error,
    setMessages,
    addToolResult,
  } = useChat({
    api: "/api/chat",
    maxSteps: 5,
  });

  const isStreaming = status === "submitted" || status === "streaming";
  const scrollerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the bottom as messages stream in.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  const firstName = userName?.split(" ")[0];
  const isEmpty = messages.length === 0;

  function onSuggestion(text: string) {
    append({ role: "user", content: text });
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;
    handleSubmit(e);
  }

  return (
    <div className="mx-auto flex h-[calc(100dvh-10rem)] max-w-4xl flex-col md:h-[calc(100dvh-6rem)]">
      {/* Header */}
      <header className="flex items-start justify-between gap-3 border-b border-slate-200 pb-4 dark:border-slate-800">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight md:text-2xl">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-950/50 dark:text-brand-300">
              <Sparkles className="h-4 w-4" />
            </span>
            Chat with your data
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Ask natural-language questions over your transactions. Results are
            shown in {baseCurrency}.
          </p>
        </div>
        {messages.length > 0 ? (
          <button
            type="button"
            onClick={() => setMessages([])}
            className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            New chat
          </button>
        ) : null}
      </header>

      {/* Messages */}
      <div
        ref={scrollerRef}
        className="flex-1 space-y-5 overflow-y-auto py-6"
        aria-live="polite"
      >
        {isEmpty ? (
          <EmptyState firstName={firstName} onPick={onSuggestion} />
        ) : (
          messages.map((m) => (
            <MessageBubble
              key={m.id}
              message={m}
              baseCurrency={baseCurrency}
              onToolResult={(toolCallId, result) =>
                addToolResult({ toolCallId, result })
              }
            />
          ))
        )}

        {status === "submitted" ? (
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Thinking…
          </div>
        ) : null}

        {error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
            <p className="font-medium">Something went wrong.</p>
            <p className="mt-1 opacity-80">{error.message}</p>
            <button
              type="button"
              onClick={() => reload()}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-white px-2.5 py-1 text-xs font-medium text-rose-700 transition hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-300 dark:hover:bg-rose-900/60"
            >
              <RefreshCw className="h-3 w-3" />
              Retry
            </button>
          </div>
        ) : null}
      </div>

      {/* Composer */}
      <form
        onSubmit={onSubmit}
        className="sticky bottom-0 border-t border-slate-200 bg-white/80 pb-2 pt-3 backdrop-blur dark:border-slate-800 dark:bg-slate-950/70"
      >
        <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm focus-within:border-brand-400 focus-within:ring-1 focus-within:ring-brand-400 dark:border-slate-800 dark:bg-slate-900">
          <textarea
            value={input}
            onChange={handleInputChange}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                (e.currentTarget.form as HTMLFormElement | null)?.requestSubmit();
              }
            }}
            rows={1}
            placeholder="Ask about your spending, budgets, trends…"
            className="max-h-40 min-h-[2.25rem] flex-1 resize-none bg-transparent px-1 py-1.5 text-sm outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
          />
          {isStreaming ? (
            <button
              type="button"
              onClick={() => stop()}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-700 transition hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
              aria-label="Stop generating"
            >
              <Square className="h-4 w-4 fill-current" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-slate-700"
              aria-label="Send message"
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          )}
        </div>
        <p className="mt-2 px-1 text-[11px] text-slate-400 dark:text-slate-500">
          Press <kbd className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[10px] dark:bg-slate-800">Enter</kbd> to send · <kbd className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[10px] dark:bg-slate-800">Shift</kbd> + <kbd className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[10px] dark:bg-slate-800">Enter</kbd> for newline
        </p>
      </form>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                 Sub-parts                                  */
/* -------------------------------------------------------------------------- */

function EmptyState({
  firstName,
  onPick,
}: {
  firstName?: string;
  onPick: (prompt: string) => void;
}) {
  return (
    <div className="flex h-full min-h-[16rem] flex-col items-center justify-center px-2 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-950/50 dark:text-brand-300">
        <MessageSquareText className="h-6 w-6" />
      </span>
      <h2 className="mt-4 text-lg font-semibold">
        {firstName ? `Hi ${firstName}, ask me anything` : "Ask me anything"}
      </h2>
      <p className="mt-1 max-w-md text-sm text-slate-600 dark:text-slate-400">
        I can search your transactions, tally totals, check your budgets, and
        spot trends. Try one of these to get started:
      </p>
      <div className="mt-5 flex w-full flex-wrap justify-center gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onPick(s)}
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-brand-700 dark:hover:bg-brand-950/40 dark:hover:text-brand-300"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  baseCurrency,
  onToolResult,
}: {
  message: ReturnType<typeof useChat>["messages"][number];
  baseCurrency: string;
  onToolResult: (toolCallId: string, result: unknown) => void;
}) {
  const isUser = message.role === "user";
  const parts = message.parts ?? [
    { type: "text" as const, text: message.content },
  ];

  return (
    <div
      className={cn(
        "flex w-full gap-3",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      {!isUser ? (
        <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-950/50 dark:text-brand-300">
          <Sparkles className="h-3.5 w-3.5" />
        </span>
      ) : null}

      <div
        className={cn(
          "max-w-[85%] space-y-2",
          isUser ? "items-end text-right" : "items-start"
        )}
      >
        {parts.map((part, i) => {
          if (part.type === "text") {
            const text = (part as { text: string }).text;
            if (!text) return null;
            return (
              <div
                key={i}
                className={cn(
                  "whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                  isUser
                    ? "bg-brand-600 text-white"
                    : "bg-slate-100 text-slate-900 dark:bg-slate-800/80 dark:text-slate-200"
                )}
              >
                <InlineMarkdown text={text} />
              </div>
            );
          }
          if (part.type === "tool-invocation") {
            const inv = (part as { toolInvocation: ToolInvocationLike })
              .toolInvocation;

            if (inv.toolName === "proposeTransaction") {
              return (
                <ProposeTransactionCard
                  key={i}
                  invocation={inv}
                  baseCurrency={baseCurrency}
                  onResult={(result) => onToolResult(inv.toolCallId, result)}
                />
              );
            }

            return <ToolCallChip key={i} invocation={inv} />;
          }
          return null;
        })}
      </div>
    </div>
  );
}

function ProposeTransactionCard({
  invocation,
  baseCurrency,
  onResult,
}: {
  invocation: ToolInvocationLike;
  baseCurrency: string;
  onResult: (result: unknown) => void;
}) {
  if (invocation.state === "partial-call" || !invocation.args) {
    return <ToolCallChip invocation={invocation} />;
  }

  if (invocation.state === "result") {
    const result = invocation.result as
      | { saved: true; id: string }
      | { saved: false; reason?: string }
      | undefined;
    if (result?.saved) {
      return (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200">
          <span className="font-medium">Transaction saved.</span>
        </div>
      );
    }
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
        Draft discarded.
      </div>
    );
  }

  const draft = invocation.args as DraftTransaction;
  return (
    <div className="w-full max-w-lg">
      <DraftReviewForm
        draft={draft}
        baseCurrency={baseCurrency}
        source="nlp"
        confirmLabel="Save"
        compact
        onSaved={({ id, confirmed }) => {
          onResult({
            saved: true,
            id,
            summary: {
              type: confirmed.type,
              amount: confirmed.amount,
              currency: confirmed.currency,
              category: confirmed.category,
              merchant: confirmed.merchant,
              date: confirmed.date,
            },
          });
        }}
        onCancel={() => onResult({ saved: false, reason: "user_cancelled" })}
      />
    </div>
  );
}

interface ToolInvocationLike {
  toolCallId: string;
  toolName: string;
  state: "partial-call" | "call" | "result";
  args?: unknown;
  result?: unknown;
}

function ToolCallChip({ invocation }: { invocation: ToolInvocationLike }) {
  const label = prettyToolName(invocation.toolName);
  const running = invocation.state !== "result";
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
      {running ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <Wrench className="h-3 w-3" />
      )}
      <span>
        {running ? "Searching" : "Searched"} · {label}
      </span>
    </div>
  );
}

function prettyToolName(name: string): string {
  switch (name) {
    case "queryTransactions":
      return "transactions";
    case "summarizeSpending":
      return "spending summary";
    case "getBudgetStatus":
      return "budgets";
    case "getSpendingTotals":
      return "totals";
    case "proposeTransaction":
      return "new transaction";
    default:
      return name;
  }
}

/**
 * Tiny Markdown-lite renderer: supports **bold**, *italic*, `code`, and
 * bullet lists. Keeps bundle size flat — good enough for financial
 * summaries and obviates a react-markdown dependency.
 */
function InlineMarkdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: Array<
    | { type: "p"; lines: string[] }
    | { type: "ul"; items: string[] }
    | { type: "ol"; items: string[] }
  > = [];
  let buf: string[] = [];
  const flush = () => {
    if (buf.length) blocks.push({ type: "p", lines: buf });
    buf = [];
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
    const numbered = /^\s*\d+\.\s+(.*)$/.exec(line);
    if (bullet) {
      flush();
      const last = blocks[blocks.length - 1];
      if (last?.type === "ul") last.items.push(bullet[1]);
      else blocks.push({ type: "ul", items: [bullet[1]] });
    } else if (numbered) {
      flush();
      const last = blocks[blocks.length - 1];
      if (last?.type === "ol") last.items.push(numbered[1]);
      else blocks.push({ type: "ol", items: [numbered[1]] });
    } else if (!line.trim()) {
      flush();
    } else {
      buf.push(line);
    }
  }
  flush();

  return (
    <>
      {blocks.map((b, i) => {
        if (b.type === "ul") {
          return (
            <ul key={i} className="ml-4 list-disc space-y-1">
              {b.items.map((it, j) => (
                <li key={j}>{renderInline(it)}</li>
              ))}
            </ul>
          );
        }
        if (b.type === "ol") {
          return (
            <ol key={i} className="ml-4 list-decimal space-y-1">
              {b.items.map((it, j) => (
                <li key={j}>{renderInline(it)}</li>
              ))}
            </ol>
          );
        }
        return (
          <p key={i} className={i > 0 ? "mt-2" : undefined}>
            {b.lines.map((l, j) => (
              <span key={j}>
                {j > 0 ? <br /> : null}
                {renderInline(l)}
              </span>
            ))}
          </p>
        );
      })}
    </>
  );
}

function renderInline(text: string): React.ReactNode {
  // Split on **bold**, *italic*, and `code` while preserving separators.
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
  return parts.map((p, i) => {
    if (/^\*\*[^*]+\*\*$/.test(p)) {
      return <strong key={i}>{p.slice(2, -2)}</strong>;
    }
    if (/^\*[^*]+\*$/.test(p)) {
      return <em key={i}>{p.slice(1, -1)}</em>;
    }
    if (/^`[^`]+`$/.test(p)) {
      return (
        <code
          key={i}
          className="rounded bg-black/10 px-1 py-0.5 font-mono text-[0.85em] dark:bg-white/10"
        >
          {p.slice(1, -1)}
        </code>
      );
    }
    return <span key={i}>{p}</span>;
  });
}
