import { NextResponse } from "next/server";
import { streamText, convertToCoreMessages, type Message } from "ai";
import { google } from "@ai-sdk/google";
import { getCurrentUser } from "@/lib/auth/session";
import { createChatTools } from "@/lib/ai/tools";
import {
  CHAT_RATE_LIMIT_BUCKETS,
  checkRateLimit,
  rateLimitHeaders,
  rateLimitMessage,
} from "@/lib/cache/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Which Gemini model to use. Override via env so you can switch between
 * free tier (`gemini-2.5-flash`, `gemini-2.5-flash-lite`, `gemini-2.0-flash`)
 * and paid / higher quota tiers without a code change.
 */
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

/**
 * `POST /api/chat` — streams a Gemini 2.0 Flash response grounded in the
 * authenticated user's transaction history via tool calling (RAG-by-tools).
 *
 * The model never sees raw DB documents unless it actively decides a tool
 * is needed — which keeps the prompt small and lets users ask open-ended
 * questions ("any trends in my food spend?") or pointed ones ("show me
 * last week's Swiggy orders") with the same endpoint.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return NextResponse.json(
      {
        error:
          "GOOGLE_GENERATIVE_AI_API_KEY is not configured on the server.",
      },
      { status: 503 }
    );
  }

  // Throttle BEFORE reading the body so spammers pay the minimum cost.
  const gate = await checkRateLimit(user.appUserId, CHAT_RATE_LIMIT_BUCKETS);
  if (!gate.ok) {
    return NextResponse.json(
      { error: rateLimitMessage(gate) },
      { status: 429, headers: rateLimitHeaders(gate) }
    );
  }

  const { messages } = (await req.json()) as { messages: Message[] };

  const tools = createChatTools({
    appUserId: user.appUserId,
    baseCurrency: user.baseCurrency,
    timeZone: user.timeZone,
  });

  const today = new Date().toISOString().slice(0, 10);
  const system = [
    `You are a helpful assistant embedded in the TrackFlow expense tracker.`,
    `You help ${user.name ?? user.email} understand and manage their own finances.`,
    `Today is ${today}. The user's base currency is ${user.baseCurrency}; all monetary values you receive from tools are already in that currency.`,
    ``,
    `TOOLS`,
    `- Read tools: "queryTransactions", "summarizeSpending", "getBudgetStatus", "getSpendingTotals", "convertCurrency".`,
    `- Write tool:  "proposeTransaction" — drafts a NEW transaction that the user must confirm in the UI.`,
    ``,
    `GUIDELINES`,
    `- Always ground numeric claims in data returned by tools. If a question needs data, call a tool; never guess amounts.`,
    `- All transaction and budget tools return monetary values in the user's base currency (${user.baseCurrency}). When the user asks for another currency (e.g. USD), call "convertCurrency" with the base-currency amount you already have — do not invent exchange rates.`,
    `- Prefer "summarizeSpending" / "getSpendingTotals" for aggregates; use "queryTransactions" only when the user wants specific rows.`,
    `- Infer date ranges from phrases like "last month", "this week", "in 2025" and pass explicit ISO dates to tools.`,
    `- When the user asks to add / log / record / save a new expense, income, or transfer — ALWAYS call "proposeTransaction" with your best extraction, and then STOP. Do not announce success; the user must review the draft card the UI will render, and the tool result will tell you whether they confirmed or cancelled.`,
    `- After a confirmed save, reply with a brief one-line confirmation. After a cancelled save, acknowledge and offer to tweak it.`,
    `- Present money with the correct symbol for the currency you are showing (base ${user.baseCurrency}, or INR/USD after convertCurrency) and sensible thousands separators.`,
    `- Be concise. Use short paragraphs and Markdown bullets / tables when helpful. Bold key numbers.`,
    `- If the user has no matching data, say so plainly and suggest what they could log to get answers next time.`,
    `- Never invent transactions, budgets, or categories in read-only answers. Never claim to have emailed / exported anything — you only have the listed tools.`,
  ].join("\n");

  const result = streamText({
    model: google(GEMINI_MODEL),
    system,
    messages: convertToCoreMessages(messages),
    tools,
    maxSteps: 5,
    temperature: 0.2,
  });

  const response = result.toDataStreamResponse({
    getErrorMessage: (error) => {
      // eslint-disable-next-line no-console
      console.error("[api/chat] stream error", error);
      const message = error instanceof Error ? error.message : String(error);
      if (/quota|rate[_ -]?limit|429/i.test(message)) {
        return (
          `Gemini quota exceeded for model "${GEMINI_MODEL}". ` +
          `Set GEMINI_MODEL in your .env to a model your key has access to ` +
          `(e.g. "gemini-2.5-flash-lite") or enable billing on the Google ` +
          `AI Studio project for this key.`
        );
      }
      return message || "Something went wrong while generating a response.";
    },
  });

  for (const [k, v] of Object.entries(rateLimitHeaders(gate))) {
    response.headers.set(k, v);
  }
  return response;
}
