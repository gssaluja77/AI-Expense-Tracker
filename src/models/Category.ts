import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";

/**
 * User-scoped spending categories. A small set of defaults are seeded on
 * first sign-in; users can then add, rename, or archive their own.
 */
export interface ICategory extends Document {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  name: string;
  icon?: string;   // lucide icon name
  color?: string;  // hex
  type: "expense" | "income" | "both";
  parent?: Types.ObjectId;
  archived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CategorySchema = new Schema<ICategory>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true },
    icon: String,
    color: String,
    type: {
      type: String,
      enum: ["expense", "income", "both"],
      default: "expense",
    },
    parent: { type: Schema.Types.ObjectId, ref: "Category" },
    archived: { type: Boolean, default: false },
  },
  { timestamps: true, collection: "categories" }
);

CategorySchema.index({ user: 1, name: 1 }, { unique: true });

export const Category: Model<ICategory> =
  mongoose.models.Category || mongoose.model<ICategory>("Category", CategorySchema);

export default Category;
