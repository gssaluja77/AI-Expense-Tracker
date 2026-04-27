import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";

/**
 * Subscription — produced by the Smart Subscription Manager.
 *
 * When a recurring pattern is detected across ≥ N transactions with a
 * stable merchant + amount cadence, a `Subscription` document is created
 * and linked back to matching `Transaction` records via `Transaction.subscription`.
 *
 * This also drives the "Predictive Bill Alerts" surface: `nextExpected`
 * is projected forward from `lastChargedAt` + `frequency`.
 */
export interface ISubscription extends Document {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  merchant: string;
  category?: string;
  amount: number;
  currency: string;
  frequency: "weekly" | "monthly" | "quarterly" | "yearly" | "custom";
  interval: number;
  firstDetectedAt: Date;
  lastChargedAt?: Date;
  nextExpected?: Date;
  averageAmount: number;
  variance: number;
  occurrences: number;
  confidence: number;
  status: "active" | "paused" | "cancelled";
  userConfirmed: boolean;
  aiGenerated: boolean;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SubscriptionSchema = new Schema<ISubscription>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    merchant: { type: String, required: true },
    category: String,
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "INR", uppercase: true },
    frequency: {
      type: String,
      enum: ["weekly", "monthly", "quarterly", "yearly", "custom"],
      required: true,
    },
    interval: { type: Number, min: 1, default: 1 },
    firstDetectedAt: { type: Date, required: true, default: () => new Date() },
    lastChargedAt: Date,
    nextExpected: { type: Date, index: true },
    averageAmount: { type: Number, required: true, min: 0 },
    variance: { type: Number, default: 0, min: 0 },
    occurrences: { type: Number, default: 1, min: 1 },
    confidence: { type: Number, default: 0.5, min: 0, max: 1 },
    status: {
      type: String,
      enum: ["active", "paused", "cancelled"],
      default: "active",
    },
    userConfirmed: { type: Boolean, default: false },
    aiGenerated: { type: Boolean, default: true },
    notes: String,
  },
  { timestamps: true, collection: "subscriptions" }
);

SubscriptionSchema.index({ user: 1, merchant: 1, amount: 1 }, { unique: true });
SubscriptionSchema.index({ user: 1, status: 1, nextExpected: 1 });

export const Subscription: Model<ISubscription> =
  mongoose.models.Subscription ||
  mongoose.model<ISubscription>("Subscription", SubscriptionSchema);

export default Subscription;
