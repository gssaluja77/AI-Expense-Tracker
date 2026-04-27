/**
 * Shared transaction-domain types.
 * Kept framework-agnostic so they can be imported by both server code
 * (Mongoose) and client components.
 */

export type TransactionType = "expense" | "income" | "transfer";

export type PaymentMethod =
  | "cash"
  | "card"
  | "upi"
  | "bank"
  | "wallet"
  | "other";

export type TransactionSource =
  | "manual"
  | "nlp"
  | "ocr"
  | "import"
  | "recurring";

export type RecurrenceFrequency =
  | "daily"
  | "weekly"
  | "monthly"
  | "yearly"
  | "custom";

export interface TransactionSplit {
  userId: string;
  name?: string;
  share: number;
  settled: boolean;
  settledAt?: Date;
}

export interface ReceiptInfo {
  url: string;
  mimeType?: string;
  ocrText?: string;
  confidence?: number;
  processedAt?: Date;
}

export interface AiMeta {
  rawInput?: string;
  model?: string;
  confidence?: number;
  embedding?: number[];
}

export interface MoneyValue {
  amount: number;
  currency: string;
}
