import "server-only";
import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { DraftTransactionSchema, type DraftTransaction } from "@/types/draft-transaction";

/**
 * Gemini-backed parsers that turn free-form user input (natural-language
 * text or a receipt photo) into a structured {@link DraftTransaction}.
 *
 * Used by both the /api/transactions/parse route and any Server Actions
 * that want to propose a draft without involving the chat model.
 */

const MODEL = () => process.env.GEMINI_MODEL || "gemini-2.5-flash";

function systemPrompt(baseCurrency: string, today: string) {
  return [
    `You extract structured transaction data for the TrackFlow expense tracker.`,
    `Today is ${today}. The user's base currency is ${baseCurrency}; when a receipt does not state a currency, assume ${baseCurrency}.`,
    ``,
    `Rules:`,
    `- Always populate type, amount, currency, category, and date. Choose "expense" unless the input clearly describes income or an account transfer.`,
    `- Use the receipt's GRAND TOTAL (after taxes / tips) as "amount", not a per-item price.`,
    `- Pick a concise, conventional category (Food, Groceries, Transport, Rent, Utilities, Shopping, Electronics, Entertainment, Health, Travel, Subscriptions, Salary, Investments, Transfers, Uncategorized).`,
    `- Convert dates to ISO-8601 (YYYY-MM-DD). Use today if the input omits a date.`,
    `- If a payment method is visible (UPI, card last 4, cash…), fill paymentMethod.`,
    `- Put individual line items in "items" (name + total). Put reference numbers, transaction IDs, or anything unusual in "notes".`,
    `- Report a 0-1 "confidence" score. Use < 0.6 when the input is ambiguous so the user knows to double-check.`,
  ].join("\n");
}

export async function parseTransactionFromText(
  text: string,
  baseCurrency: string
): Promise<DraftTransaction> {
  const today = new Date().toISOString().slice(0, 10);

  const { object } = await generateObject({
    model: google(MODEL()),
    schema: DraftTransactionSchema,
    system: systemPrompt(baseCurrency, today),
    prompt: `Extract a single transaction from this note:\n\n"""${text}"""`,
    temperature: 0.1,
  });

  return object;
}

export async function parseTransactionFromImage(params: {
  bytes: Uint8Array;
  mimeType: string;
  baseCurrency: string;
  hint?: string;
}): Promise<DraftTransaction> {
  const today = new Date().toISOString().slice(0, 10);

  const { object } = await generateObject({
    model: google(MODEL()),
    schema: DraftTransactionSchema,
    system: systemPrompt(params.baseCurrency, today),
    temperature: 0.1,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text:
              "This is a photo of a receipt, invoice, or payment " +
              "confirmation. Read every visible field and extract a single " +
              "transaction." +
              (params.hint ? `\n\nAdditional context from the user: ${params.hint}` : ""),
          },
          {
            type: "image",
            image: params.bytes,
            mimeType: params.mimeType,
          },
        ],
      },
    ],
  });

  return object;
}
