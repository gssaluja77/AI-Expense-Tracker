import { MongoClient, type MongoClientOptions } from "mongodb";

/**
 * Native MongoClient singleton — used by the NextAuth MongoDBAdapter.
 * Kept separate from the Mongoose connection so that both layers can
 * share the same underlying deployment but with their own lifecycles.
 */

const uri = process.env.MONGODB_URI;
if (!uri) {
  throw new Error("Missing MONGODB_URI environment variable.");
}

const options: MongoClientOptions = {
  maxPoolSize: 10,
  /** Cold starts on Vercel can be slow; avoid failing OAuth callback before Atlas responds. */
  serverSelectionTimeoutMS: 15_000,
};

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

function createClientPromise() {
  const p = new MongoClient(uri!, options).connect();
  // Observe the rejection immediately so a bad URI at boot doesn't
  // crash the entire Node process with an unhandledRejection. The
  // adapter's own `await` on the promise will still receive the error.
  p.catch((err) => {
    // eslint-disable-next-line no-console
    console.error(
      "[mongodb] initial MongoClient connection failed. " +
        "Check MONGODB_URI. Original error:",
      err?.message || err
    );
  });
  return p;
}

const clientPromise: Promise<MongoClient> =
  global._mongoClientPromise ?? (global._mongoClientPromise = createClientPromise());

export default clientPromise;
