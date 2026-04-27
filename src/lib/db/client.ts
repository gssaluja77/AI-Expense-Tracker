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
};

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

const clientPromise: Promise<MongoClient> =
  global._mongoClientPromise ??
  (global._mongoClientPromise = new MongoClient(uri, options).connect());

export default clientPromise;
