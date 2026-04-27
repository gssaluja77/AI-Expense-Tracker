import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";

/**
 * User profile. Core auth-related fields (email, image, accounts, sessions)
 * are managed by the NextAuth MongoDB adapter in its own collections.
 *
 * This schema is layered on top to add application-specific preferences
 * (base currency, locale, notification opts, push subscriptions, etc.).
 */

export interface IUser extends Document {
  _id: Types.ObjectId;
  email: string;
  name?: string;
  image?: string;
  baseCurrency: string;
  locale: string;
  timeZone: string;
  pushSubscriptions: Array<{
    endpoint: string;
    keys: { p256dh: string; auth: string };
    createdAt: Date;
  }>;
  preferences: {
    notifyOnSubscriptionDetected: boolean;
    notifyOnBudgetExceeded: boolean;
    notifyOnPredictedBill: boolean;
    aiSuggestionsEnabled: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, lowercase: true, index: true, unique: true },
    name: String,
    image: String,
    baseCurrency: { type: String, default: "INR", uppercase: true },
    locale: { type: String, default: "en-IN" },
    timeZone: { type: String, default: "Asia/Kolkata" },
    pushSubscriptions: [
      {
        endpoint: { type: String, required: true },
        keys: {
          p256dh: { type: String, required: true },
          auth: { type: String, required: true },
        },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    preferences: {
      notifyOnSubscriptionDetected: { type: Boolean, default: true },
      notifyOnBudgetExceeded: { type: Boolean, default: true },
      notifyOnPredictedBill: { type: Boolean, default: true },
      aiSuggestionsEnabled: { type: Boolean, default: true },
    },
  },
  { timestamps: true, collection: "app_users" }
);

export const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>("User", UserSchema);

export default User;
