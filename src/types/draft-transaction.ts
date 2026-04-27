import { z } from "zod";
import type { PaymentMethod, TransactionType } from "@/types/transaction";

/**
 * Zod schema for a "draft" transaction — the shape produced by NLP / OCR
 * before the user has confirmed it. Shared between:
 *   • `/api/transactions/parse` (OCR)              – validates model output
 *   • Chat tool `proposeTransaction`                – validates LLM args
 *   • `<DraftReviewForm>`                           – form initial values
 *   • `createTransactionFromDraftAction`            – final persist step
 *
 * NOTE: This is intentionally permissive — we'd rather accept a partial
 * draft and let the user fix blanks than reject AI output outright.
 */

export const DraftTransactionItemSchema = z.object({
  name: z.string().describe("Line item, e.g. 'Cappuccino'"),
  quantity: z.number().positive().optional(),
  unitPrice: z.number().nonnegative().optional(),
  total: z.number().nonnegative().optional(),
});

export const DraftTransactionSchema = z.object({
  type: z
    .enum(["expense", "income", "transfer"])
    .describe("Transaction direction.")
    .default("expense"),
  amount: z
    .number()
    .positive()
    .describe("Total amount in the transaction's own currency."),
  currency: z
    .string()
    .regex(/^[A-Z]{3}$/i)
    .describe("ISO-4217 currency code, e.g. 'INR', 'USD'."),
  category: z
    .string()
    .min(1)
    .describe(
      "Best-guess spending category, e.g. 'Food', 'Groceries', 'Electronics'."
    ),
  merchant: z
    .string()
    .describe("Merchant / vendor name, if visible.")
    .optional(),
  description: z
    .string()
    .describe("Short human-readable description.")
    .optional(),
  notes: z.string().describe("Any extra context worth keeping.").optional(),
  date: z
    .string()
    .describe(
      "ISO-8601 date the transaction occurred. If a receipt has no date, use today."
    ),
  paymentMethod: z
    .enum(["cash", "card", "upi", "bank", "wallet", "other"])
    .describe("Inferred payment method.")
    .optional(),
  tags: z
    .array(z.string())
    .describe("Optional classification tags.")
    .max(10)
    .optional(),
  items: z
    .array(DraftTransactionItemSchema)
    .describe("Line items extracted from a receipt, if any.")
    .max(50)
    .optional(),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe("0-1 self-reported confidence in the extraction.")
    .optional(),
});

export type DraftTransaction = z.infer<typeof DraftTransactionSchema>;
export type DraftTransactionItem = z.infer<typeof DraftTransactionItemSchema>;

export type DraftSource = "nlp" | "ocr" | "manual";

/**
 * Validated shape handed to `createTransactionFromDraftAction`. Differs
 * from the draft in that fields are narrowed / typed rather than the
 * looser LLM-friendly version above.
 */
export interface ConfirmedTransaction {
  type: TransactionType;
  amount: number;
  currency: string;
  category: string;
  merchant?: string;
  description?: string;
  notes?: string;
  date: string;
  paymentMethod?: PaymentMethod;
  tags?: string[];
  source: DraftSource;
  receipt?: {
    url: string;
    mimeType?: string;
    ocrText?: string;
    confidence?: number;
  };
}
