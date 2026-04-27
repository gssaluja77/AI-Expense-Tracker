import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";

/**
 * Budget envelope — a per-category spending limit over a period. The
 * dashboard renders a progress bar (`spent / limit`) against the live
 * transaction total (cached in Redis).
 */
export interface IBudget extends Document {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  name: string;
  category: string;
  limit: number;
  currency: string;
  period: "weekly" | "monthly" | "quarterly" | "yearly" | "custom";
  startDate: Date;
  endDate?: Date;
  rolloverUnused: boolean;
  alertThreshold: number; // 0-1; e.g. 0.8 -> alert at 80% of the limit
  archived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const BudgetSchema = new Schema<IBudget>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true },
    category: { type: String, required: true, index: true },
    limit: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "INR", uppercase: true },
    period: {
      type: String,
      enum: ["weekly", "monthly", "quarterly", "yearly", "custom"],
      default: "monthly",
    },
    startDate: { type: Date, required: true, default: () => new Date() },
    endDate: Date,
    rolloverUnused: { type: Boolean, default: false },
    alertThreshold: { type: Number, default: 0.8, min: 0, max: 1 },
    archived: { type: Boolean, default: false },
  },
  { timestamps: true, collection: "budgets" }
);

BudgetSchema.index({ user: 1, category: 1, period: 1, startDate: -1 });

export const Budget: Model<IBudget> =
  mongoose.models.Budget || mongoose.model<IBudget>("Budget", BudgetSchema);

export default Budget;
