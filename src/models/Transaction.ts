import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";
import type {
  AiMeta,
  PaymentMethod,
  ReceiptInfo,
  RecurrenceFrequency,
  TransactionSource,
  TransactionSplit,
  TransactionType,
} from "@/types/transaction";

/**
 * Transaction — the heart of AI-FinPilot.
 *
 * Designed to simultaneously support every core feature:
 *   • Manual, NLP, OCR, import, and recurring-derived entries (`source`).
 *   • Multi-currency: stores local + base (INR by default) with captured FX rate.
 *   • Split / shared expenses across multiple users with per-split settlement.
 *   • Budget envelopes via a `budget` reference + `category`.
 *   • Smart subscription linkage via `subscription` + `recurrence`.
 *   • Predictive bills reads historical frequency here.
 *   • RAG: `aiMeta.embedding` stores the vector; indexes defined below are
 *     compatible with MongoDB Atlas Vector Search.
 */

export interface ITransaction extends Document {
  _id: Types.ObjectId;
  user: Types.ObjectId;

  // --- Money ---------------------------------------------------------------
  amount: number;             // value in local currency (positive)
  currency: string;           // ISO-4217, e.g. "USD"
  baseAmount: number;         // value converted to user's base currency
  baseCurrency: string;       // usually "INR"
  exchangeRate: number;       // local -> base, captured at the time of tx
  type: TransactionType;

  // --- Classification ------------------------------------------------------
  category: string;           // e.g. "Food"
  subcategory?: string;       // e.g. "Dining out"
  merchant?: string;
  description?: string;
  notes?: string;
  tags?: string[];

  // --- When / Where / How --------------------------------------------------
  date: Date;
  paymentMethod?: PaymentMethod;
  location?: { lat: number; lng: number; name?: string };

  // --- Provenance / AI -----------------------------------------------------
  source: TransactionSource;
  aiMeta?: AiMeta;
  receipt?: ReceiptInfo;

  // --- Recurrence / Subscription ------------------------------------------
  isRecurring: boolean;
  subscription?: Types.ObjectId;
  recurrence?: {
    frequency: RecurrenceFrequency;
    interval?: number;
    nextDate?: Date;
    detectedAt?: Date;
    confidence?: number;
  };

  // --- Collaboration / Split ----------------------------------------------
  shared: {
    isShared: boolean;
    splits: TransactionSplit[];
    totalOwed: number;
  };

  // --- Budget envelope -----------------------------------------------------
  budget?: Types.ObjectId;

  // --- Soft delete / audit -------------------------------------------------
  deleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SplitSchema = new Schema<TransactionSplit>(
  {
    userId: { type: String, required: true },
    name: String,
    share: { type: Number, required: true, min: 0 },
    settled: { type: Boolean, default: false },
    settledAt: Date,
  },
  { _id: false }
);

const ReceiptSchema = new Schema<ReceiptInfo>(
  {
    url: { type: String, required: true },
    mimeType: String,
    ocrText: String,
    confidence: { type: Number, min: 0, max: 1 },
    processedAt: Date,
  },
  { _id: false }
);

const AiMetaSchema = new Schema<AiMeta>(
  {
    rawInput: String,
    model: String,
    confidence: { type: Number, min: 0, max: 1 },
    embedding: { type: [Number], default: undefined },
  },
  { _id: false }
);

const RecurrenceSchema = new Schema(
  {
    frequency: {
      type: String,
      enum: ["daily", "weekly", "monthly", "yearly", "custom"],
      required: true,
    },
    interval: { type: Number, min: 1, default: 1 },
    nextDate: Date,
    detectedAt: Date,
    confidence: { type: Number, min: 0, max: 1 },
  },
  { _id: false }
);

const TransactionSchema = new Schema<ITransaction>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },

    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, uppercase: true, default: "INR" },
    baseAmount: { type: Number, required: true, min: 0 },
    baseCurrency: { type: String, required: true, uppercase: true, default: "INR" },
    exchangeRate: { type: Number, required: true, default: 1, min: 0 },
    type: {
      type: String,
      enum: ["expense", "income", "transfer"],
      required: true,
      default: "expense",
    },

    category: { type: String, required: true, default: "Uncategorized", index: true },
    subcategory: String,
    merchant: { type: String, index: true },
    description: String,
    notes: String,
    tags: { type: [String], default: [] },

    date: { type: Date, required: true, default: () => new Date(), index: true },
    paymentMethod: {
      type: String,
      enum: ["cash", "card", "upi", "bank", "wallet", "other"],
    },
    location: {
      lat: Number,
      lng: Number,
      name: String,
    },

    source: {
      type: String,
      enum: ["manual", "nlp", "ocr", "import", "recurring"],
      required: true,
      default: "manual",
      index: true,
    },
    aiMeta: AiMetaSchema,
    receipt: ReceiptSchema,

    isRecurring: { type: Boolean, default: false, index: true },
    subscription: { type: Schema.Types.ObjectId, ref: "Subscription" },
    recurrence: RecurrenceSchema,

    shared: {
      isShared: { type: Boolean, default: false },
      splits: { type: [SplitSchema], default: [] },
      totalOwed: { type: Number, default: 0, min: 0 },
    },

    budget: { type: Schema.Types.ObjectId, ref: "Budget" },

    deleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true, collection: "transactions" }
);

/* -------------------------------------------------------------------------- */
/*                                  Indexes                                   */
/* -------------------------------------------------------------------------- */

// Most dashboard queries are "for this user, in this date range"
TransactionSchema.index({ user: 1, date: -1 });
TransactionSchema.index({ user: 1, category: 1, date: -1 });
TransactionSchema.index({ user: 1, merchant: 1, amount: 1 }); // subscription detection
TransactionSchema.index({ user: 1, "shared.isShared": 1 });
TransactionSchema.index({ user: 1, isRecurring: 1, "recurrence.nextDate": 1 });

// Full-text index across descriptive fields (used by RAG + manual search).
TransactionSchema.index(
  { description: "text", merchant: "text", notes: "text", tags: "text" },
  { name: "tx_text_search" }
);

/* -------------------------------------------------------------------------- */
/*                                  Virtuals                                  */
/* -------------------------------------------------------------------------- */

TransactionSchema.virtual("signedAmount").get(function (this: ITransaction) {
  return this.type === "income" ? this.baseAmount : -this.baseAmount;
});

TransactionSchema.set("toJSON", { virtuals: true });
TransactionSchema.set("toObject", { virtuals: true });

export const Transaction: Model<ITransaction> =
  mongoose.models.Transaction ||
  mongoose.model<ITransaction>("Transaction", TransactionSchema);

export default Transaction;
