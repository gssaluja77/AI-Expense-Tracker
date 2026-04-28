import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";

/**
 * A chat thread: one document per assistant chat with embedded UIMessage[]
 * (AI SDK / `ai` package shape) so a single round-trip can load the full
 * history for the client. Tool-call parts are stored with `strict: false`
 * to round-trip the full tool-invocation state.
 */
export interface IChatConversation extends Document {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  title: string;
  /** Serialized `Message[]` from the Vercel AI SDK (`ai` / `@ai-sdk/ui-utils`). */
  messages: unknown[];
  createdAt: Date;
  updatedAt: Date;
}

const ChatConversationSchema = new Schema<IChatConversation>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, default: "New chat", trim: true, maxlength: 200 },
    messages: { type: [Schema.Types.Mixed], default: [] },
  },
  { timestamps: true, collection: "chat_conversations" }
);

ChatConversationSchema.index({ user: 1, updatedAt: -1 });

export const ChatConversation: Model<IChatConversation> =
  mongoose.models.ChatConversation ||
  mongoose.model<IChatConversation>("ChatConversation", ChatConversationSchema);

export default ChatConversation;
