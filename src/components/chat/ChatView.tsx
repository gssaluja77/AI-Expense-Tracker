"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useChat } from "@ai-sdk/react";
import type { Message } from "ai";
import {
  ArrowUp,
  Clock,
  History,
  Loader2,
  MessageSquare,
  MessageSquareText,
  PanelLeft,
  Plus,
  RefreshCw,
  Sparkles,
  Square,
  Trash2,
  Wrench,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { ChatListItem } from "@/types/chat-list";
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
  initialConversations: ChatListItem[];
  initialConversationId: string;
  initialMessages: Message[];
}

export function ChatView({
  userName,
  baseCurrency,
  initialConversations,
  initialConversationId,
  initialMessages,
}: ChatViewProps) {
  const [conversations, setConversations] =
    useState<ChatListItem[]>(initialConversations);
  const [activeId, setActiveId] = useState(initialConversationId);
  const [threadInitial, setThreadInitial] = useState<Message[]>(initialMessages);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  /** True when the active thread has at least one message (local, including unsaved). */
  const [activeHasMessages, setActiveHasMessages] = useState(
    () => initialMessages.length > 0
  );
  const conversationsRef = useRef(conversations);
  conversationsRef.current = conversations;

  /** Drop `?new=1` after load so refresh does not keep spawning threads. */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("new") !== "1") return;
    url.searchParams.delete("new");
    const q = url.searchParams.toString();
    window.history.replaceState(
      {},
      "",
      url.pathname + (q ? `?${q}` : "")
    );
  }, []);

  const bumpListItem = useCallback(
    (id: string, title: string, updatedAt: string, messageCount: number) => {
      setConversations((prev) => {
        const rest = prev.filter((c) => c.id !== id);
        return [{ id, title, updatedAt, messageCount }, ...rest];
      });
    },
    []
  );

  const selectConversation = useCallback(
    async (id: string) => {
      if (id === activeId) return;
      setLoadError(null);
      setBusyId(id);
      try {
        const res = await fetch(`/api/chat/conversations/${id}`);
        if (!res.ok) {
          setLoadError("Could not load that chat.");
          return;
        }
        const data = (await res.json()) as {
          messages?: Message[];
          messageCount?: number;
        };
        const msgs = Array.isArray(data.messages) ? data.messages : [];
        setThreadInitial(msgs);
        const mc =
          typeof data.messageCount === "number"
            ? data.messageCount
            : msgs.length;
        setActiveHasMessages(mc > 0);
        setConversations((prev) =>
          prev.map((c) =>
            c.id === id ? { ...c, messageCount: mc } : c
          )
        );
        setActiveId(id);
      } finally {
        setBusyId(null);
      }
    },
    [activeId]
  );

  const [mobileHistoryOpen, setMobileHistoryOpen] = useState(false);

  const closeMobileHistory = useCallback(() => {
    setMobileHistoryOpen(false);
  }, []);

  useEffect(() => {
    if (!mobileHistoryOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileHistoryOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileHistoryOpen]);

  useEffect(() => {
    if (!mobileHistoryOpen) return;
    if (typeof window === "undefined") return;
    if (!window.matchMedia("(max-width: 767px)").matches) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileHistoryOpen]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const onWide = () => {
      if (mq.matches) setMobileHistoryOpen(false);
    };
    mq.addEventListener("change", onWide);
    return () => mq.removeEventListener("change", onWide);
  }, []);

  const selectConversationMobile = useCallback(
    async (id: string) => {
      await selectConversation(id);
      closeMobileHistory();
    },
    [selectConversation, closeMobileHistory]
  );

  const newChat = useCallback(
    async (force = false) => {
      if (!force && !activeHasMessages) return;

      setLoadError(null);
      setBusyId("__new__");
      try {
        const res = await fetch("/api/chat/conversations", { method: "POST" });
        if (!res.ok) {
          setLoadError("Could not start a new chat.");
          return;
        }
        const c = (await res.json()) as {
          id: string;
          title: string;
          updatedAt: string;
          messageCount?: number;
        };
        setConversations((prev) => [
          {
            id: c.id,
            title: c.title,
            updatedAt: c.updatedAt,
            messageCount: c.messageCount ?? 0,
          },
          ...prev,
        ]);
        setThreadInitial([]);
        setActiveHasMessages(false);
        setActiveId(c.id);
      } finally {
        setBusyId(null);
      }
      closeMobileHistory();
    },
    [activeHasMessages, closeMobileHistory]
  );

  const deleteConversation = useCallback(
    async (id: string) => {
      closeMobileHistory();
      const res = await fetch(`/api/chat/conversations/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) return;

      const nextList = conversationsRef.current.filter((c) => c.id !== id);
      setConversations(nextList);

      if (id !== activeId) return;

      const withMessages = nextList.filter((c) => c.messageCount > 0);
      if (withMessages.length > 0) {
        await selectConversation(withMessages[0].id);
      } else {
        await newChat(true);
      }
    },
    [activeId, selectConversation, newChat, closeMobileHistory]
  );

  /** Hide empty “New chat” shells until at least one message has been saved. */
  const visibleConversations = useMemo(
    () => conversations.filter((c) => c.messageCount > 0),
    [conversations]
  );

  return (
    <div
      className="relative mx-auto flex h-[calc(100dvh-10rem)] w-full max-w-5xl flex-col gap-0 md:h-[calc(100dvh-6rem)] md:flex-row md:gap-4"
    >
      {/* Mobile: dim background when history drawer is open */}
      {mobileHistoryOpen ? (
        <button
          type="button"
          aria-label="Close chat history"
          className="fixed inset-0 z-40 bg-slate-900/50 md:hidden"
          onClick={closeMobileHistory}
        />
      ) : null}

      {/* History — desktop: sidebar; mobile: slide-over from the left */}
      <aside
        className={cn(
          "z-50 flex w-[min(18rem,88vw)] flex-shrink-0 flex-col border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950",
          "fixed inset-y-0 left-0 border-r shadow-xl transition-transform duration-200 ease-out md:static md:z-0 md:h-auto md:w-64 md:max-h-none md:translate-x-0 md:border md:shadow-none md:rounded-xl md:pb-2",
          mobileHistoryOpen
            ? "translate-x-0"
            : "-translate-x-full pointer-events-none md:pointer-events-auto md:translate-x-0"
        )}
      >
        <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-3 py-2 dark:border-slate-800">
          <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <History className="h-3.5 w-3.5" />
            History
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={closeMobileHistory}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 md:hidden dark:hover:bg-slate-800 dark:hover:text-slate-200"
              aria-label="Close history"
            >
              <X className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => void newChat()}
              disabled={busyId === "__new__" || !activeHasMessages}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              title={
                activeHasMessages
                  ? "Start a new conversation"
                  : "You already have an empty chat — send a message first"
              }
            >
              {busyId === "__new__" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              <span className="hidden sm:inline">New</span>
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-1.5">
          {visibleConversations.length === 0 ? (
            <p className="px-2 py-2 text-center text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              Past chats appear here after you send your first message in a
              thread.
            </p>
          ) : (
            visibleConversations.map((c) => (
              <div
                key={c.id}
                className={cn(
                  "group flex w-full min-w-0 items-center gap-0.5 rounded-lg",
                  c.id === activeId
                    ? "bg-brand-50 dark:bg-brand-950/30"
                    : "hover:bg-slate-100 dark:hover:bg-slate-800/80"
                )}
              >
                <button
                  type="button"
                  onClick={() =>
                    void selectConversationMobile(c.id)
                  }
                  disabled={busyId !== null}
                  className="flex min-w-0 flex-1 items-center gap-2 py-2 pl-2.5 pr-1 text-left text-sm"
                >
                  {c.id === activeId && busyId === c.id ? (
                    <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-slate-400" />
                  ) : (
                    <MessageSquare
                      className={cn(
                        "h-3.5 w-3.5 shrink-0",
                        c.id === activeId
                          ? "text-brand-600 dark:text-brand-300"
                          : "text-slate-400"
                      )}
                    />
                  )}
                  <span
                    className={cn(
                      "line-clamp-2 min-w-0 flex-1 text-xs",
                      c.id === activeId
                        ? "font-medium text-slate-900 dark:text-slate-100"
                        : "text-slate-600 dark:text-slate-300"
                    )}
                    title={c.title}
                  >
                    {c.title}
                  </span>
                  <span className="shrink-0 text-[10px] text-slate-400">
                    {formatListTime(c.updatedAt)}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => void deleteConversation(c.id)}
                  className="mr-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-400 opacity-0 transition group-hover:opacity-100 hover:bg-rose-100 hover:text-rose-600 dark:hover:bg-rose-950/50 dark:hover:text-rose-400"
                  title="Delete chat"
                  aria-label="Delete chat"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
        {loadError ? (
          <p className="border-t border-slate-200 px-3 py-2 text-xs text-rose-600 dark:border-slate-800">
            {loadError}
          </p>
        ) : null}
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center gap-2 border-b border-slate-200 px-1 py-2 dark:border-slate-800 md:hidden">
          <button
            type="button"
            onClick={() => setMobileHistoryOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <PanelLeft className="h-4 w-4" />
            Past chats
          </button>
        </div>
        <ChatThread
          key={activeId}
          conversationId={activeId}
          initialMessages={threadInitial}
          userName={userName}
          baseCurrency={baseCurrency}
          onPersistedMeta={bumpListItem}
          onHasMessagesChange={setActiveHasMessages}
        />
      </div>
    </div>
  );
}

type ChatThreadProps = {
  conversationId: string;
  initialMessages: Message[];
  userName?: string | null;
  baseCurrency: string;
  onPersistedMeta: (
    id: string,
    title: string,
    updatedAt: string,
    messageCount: number
  ) => void;
  onHasMessagesChange: (hasMessages: boolean) => void;
};

function ChatThread({
  conversationId,
  initialMessages,
  userName,
  baseCurrency,
  onPersistedMeta,
  onHasMessagesChange,
}: ChatThreadProps) {
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
    addToolResult,
  } = useChat({
    api: "/api/chat",
    maxSteps: 5,
    id: conversationId,
    initialMessages,
  });

  useEffect(() => {
    onHasMessagesChange(messages.length > 0);
  }, [messages, onHasMessagesChange]);

  // Persist the full UIMessage[] after each turn (and after tool results).
  useEffect(() => {
    if (status !== "ready") return;
    const t = setTimeout(() => {
      void (async () => {
        const res = await fetch(`/api/chat/conversations/${conversationId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages }),
        });
        if (res.ok) {
          const data = (await res.json()) as {
            title?: string;
            updatedAt?: string;
            messageCount?: number;
          };
          if (data.updatedAt) {
            onPersistedMeta(
              conversationId,
              data.title ?? "New chat",
              data.updatedAt,
              typeof data.messageCount === "number"
                ? data.messageCount
                : messages.length
            );
          }
        }
      })();
    }, 500);
    return () => clearTimeout(t);
  }, [messages, status, conversationId, onPersistedMeta]);

  const isStreaming = status === "submitted" || status === "streaming";
  const scrollerRef = useRef<HTMLDivElement>(null);

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
    <div className="flex h-full min-h-0 min-w-0 flex-col">
      <header className="flex-shrink-0 border-b border-slate-200 pb-4 dark:border-slate-800">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-lg font-bold tracking-tight sm:text-xl md:text-2xl">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-950/50 dark:text-brand-300">
              <Sparkles className="h-4 w-4" />
            </span>
            Chat with your data
          </h1>
          <p className="mt-1 text-xs text-slate-600 sm:text-sm dark:text-slate-400">
            Totals from your data are in <strong>{baseCurrency}</strong>. Ask for
            USD or INR equivalents anytime — live FX rates are used for
            conversions. History saves automatically.
          </p>
        </div>
      </header>

      <div
        ref={scrollerRef}
        className="min-h-0 flex-1 space-y-5 overflow-y-auto py-4 sm:py-6"
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

        {error ? <ChatErrorBanner error={error} onRetry={() => reload()} /> : null}
      </div>

      <form
        onSubmit={onSubmit}
        className="flex-shrink-0 border-t border-slate-200 bg-white/80 pb-2 pt-3 backdrop-blur dark:border-slate-800 dark:bg-slate-950/70"
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

function formatListTime(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const day = Math.floor(h / 24);
  if (day < 7) return `${day}d`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/* -------------------------------------------------------------------------- */
/*                                 Sub-parts                                  */
/* -------------------------------------------------------------------------- */

function ChatErrorBanner({
  error,
  onRetry,
}: {
  error: Error;
  onRetry: () => void;
}) {
  const message = extractErrorMessage(error);
  const isRateLimit = /rate limit|per-minute|per-hour|daily.*limit|too quickly|429/i.test(
    message
  );

  if (isRateLimit) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
        <p className="flex items-center gap-1.5 font-medium">
          <Clock className="h-3.5 w-3.5" />
          Slow down a bit
        </p>
        <p className="mt-1 opacity-80">{message}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
      <p className="font-medium">Something went wrong.</p>
      <p className="mt-1 opacity-80">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-white px-2.5 py-1 text-xs font-medium text-rose-700 transition hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-300 dark:hover:bg-rose-900/60"
      >
        <RefreshCw className="h-3 w-3" />
        Retry
      </button>
    </div>
  );
}

/** Pull the friendliest possible message out of whatever `useChat` threw. */
function extractErrorMessage(error: Error): string {
  const raw = error.message || "";
  // AI SDK sometimes forwards the entire JSON body as the message. Try to
  // unwrap `{ "error": "..." }` so the user sees a clean one-liner.
  if (raw.trim().startsWith("{")) {
    try {
      const parsed = JSON.parse(raw) as { error?: string; message?: string };
      if (typeof parsed.error === "string" && parsed.error) return parsed.error;
      if (typeof parsed.message === "string" && parsed.message) return parsed.message;
    } catch {
      /* fall through */
    }
  }
  return raw || "Unknown error.";
}

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
    case "convertCurrency":
      return "currency conversion";
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
