// Quick connectivity/auth probe. Run with:  node --env-file=.env scripts/mongo-ping.mjs
import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME || "admin";

if (!uri) {
  console.error("MONGODB_URI not set");
  process.exit(1);
}

const redacted = uri.replace(/:\/\/([^:]+):([^@]+)@/, "://$1:***@");
console.log("Connecting to:", redacted);
console.log("DB name:       ", dbName);

const client = new MongoClient(uri, { serverSelectionTimeoutMS: 8_000 });

try {
  await client.connect();
  const ping = await client.db(dbName).command({ ping: 1 });
  console.log("PING OK ->", ping);
  const user = await client.db("admin").command({ connectionStatus: 1 });
  console.log("Auth context ->", JSON.stringify(user.authInfo, null, 2));
  process.exit(0);
} catch (err) {
  console.error("FAILED:", err?.codeName || err?.name, "-", err?.message);
  process.exit(1);
} finally {
  await client.close().catch(() => {});
}
