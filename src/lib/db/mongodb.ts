import mongoose, { type Mongoose } from "mongoose";

/**
 * MongoDB connection utility (Mongoose).
 *
 * Uses a globally-cached connection so that hot reloads in Next.js
 * dev mode and serverless cold starts don't spawn a new pool on every
 * invocation.
 *
 * Usage:
 *   import { connectToDatabase } from "@/lib/db/mongodb";
 *   await connectToDatabase();
 */

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || "ai-finpilot";

if (!MONGODB_URI) {
  throw new Error(
    "Missing MONGODB_URI environment variable. Add it to .env.local."
  );
}

interface MongooseCache {
  conn: Mongoose | null;
  promise: Promise<Mongoose> | null;
}

// Reuse the connection across hot reloads (dev) and module re-evaluation (serverless).
declare global {
  // eslint-disable-next-line no-var
  var _mongooseCache: MongooseCache | undefined;
}

const cached: MongooseCache =
  global._mongooseCache ?? (global._mongooseCache = { conn: null, promise: null });

/**
 * Returns a singleton Mongoose connection.
 * Safe to call in every Server Action / Route Handler.
 */
export async function connectToDatabase(): Promise<Mongoose> {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(MONGODB_URI!, {
        dbName: MONGODB_DB_NAME,
        bufferCommands: false,
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 10_000,
      })
      .then((m) => {
        if (process.env.NODE_ENV !== "production") {
          // eslint-disable-next-line no-console
          console.log(`[mongodb] connected to ${MONGODB_DB_NAME}`);
        }
        return m;
      });
  }

  try {
    cached.conn = await cached.promise;
  } catch (err) {
    cached.promise = null;
    throw err;
  }

  return cached.conn;
}

/**
 * Optional: explicitly disconnect (used in tests / one-off scripts).
 */
export async function disconnectFromDatabase(): Promise<void> {
  if (cached.conn) {
    await cached.conn.disconnect();
    cached.conn = null;
    cached.promise = null;
  }
}
