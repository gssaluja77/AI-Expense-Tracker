import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";

/**
 * Fixed-window rate-limit counter. One document per (bucket, subject,
 * windowId); the windowId is embedded in `key` so rolling from one window
 * to the next simply targets a fresh document — old ones are reaped by
 * the TTL monitor.
 *
 * Read / write pattern: a single atomic `findOneAndUpdate` with `$inc`
 * and `$setOnInsert` gives us the new counter value in one round-trip.
 */
export interface IRateCounter extends Document {
  _id: Types.ObjectId;
  key: string;
  count: number;
  /**
   * When this counter becomes eligible for TTL cleanup. MongoDB's TTL
   * monitor runs every ~60s, so shorter windows may linger slightly past
   * their logical expiry — that's fine, the windowId in `key` keeps the
   * next window's counter isolated from any stragglers.
   */
  expiresAt: Date;
  createdAt: Date;
}

const RateCounterSchema = new Schema<IRateCounter>(
  {
    key: { type: String, required: true, unique: true, index: true },
    count: { type: Number, required: true, default: 0 },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: "rate_counters" }
);

// TTL index — MongoDB will drop docs whose expiresAt has passed.
RateCounterSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RateCounter: Model<IRateCounter> =
  mongoose.models.RateCounter ||
  mongoose.model<IRateCounter>("RateCounter", RateCounterSchema);

export default RateCounter;
