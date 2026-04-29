/**
 * TrackFlow — one-time cleanup script
 *
 * Does two things:
 *   1. Fix duplicate app_users: for each email that has > 1 document, keeps
 *      the OLDEST record and deletes the rest. Any transactions / budgets
 *      pointing to the deleted _ids are re-assigned to the surviving _id.
 *
 *   2. Delete mock/seed transactions: removes all transactions whose
 *      merchant or description match the known seed data, OR whose date
 *      is before the cutoff date you set below.
 *
 * HOW TO RUN (from the project root):
 *   node --env-file=.env scripts/cleanup.mjs
 *
 * The script prints a full summary of what it WILL do and asks for
 * confirmation before making any changes. Pass --yes to skip the prompt.
 *
 * SAFETY: The script never drops collections. Every deleted/updated _id
 * is printed before the operation runs.
 */

import { MongoClient, ObjectId } from "mongodb";
import readline from "readline";

// ---------------------------------------------------------------------------
// CONFIG — adjust if needed
// ---------------------------------------------------------------------------

/**
 * Transactions created BEFORE this date (exclusive) are treated as mock/seed
 * data and will be deleted. Set to null to skip date-based cleanup and rely
 * only on the merchant/description list below.
 *
 * The user's first real transaction (Zerope, 29 Apr 2026) is safe because
 * its date is >= this cutoff.
 */
const MOCK_CUTOFF_DATE = new Date("2026-04-29T00:00:00.000Z");

/**
 * Additional merchant / description substrings (case-insensitive) that
 * identify seed transactions regardless of date.
 */
const MOCK_PATTERNS = [
  "cafe coffee day",
  "swiggy",
  "zomato",
  "mock",
  "seed",
  "dummy",
  "test transaction",
  "sample",
];

// ---------------------------------------------------------------------------

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB_NAME || "trackflow_db";

if (!MONGODB_URI) {
  console.error("ERROR: MONGODB_URI environment variable is not set.");
  console.error("Run with:  node --env-file=.env scripts/cleanup.mjs");
  process.exit(1);
}

async function confirm(question) {
  if (process.argv.includes("--yes")) return true;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(`\n${question} [y/N] `, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === "y");
    });
  });
}

async function main() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db(DB_NAME);

  console.log(`\nConnected to MongoDB — database: ${DB_NAME}\n`);
  console.log("=".repeat(60));

  // ─────────────────────────────────────────────────────────────
  // STEP 1 — Detect duplicate app_users
  // ─────────────────────────────────────────────────────────────
  console.log("\n[1/2] Scanning for duplicate app_users…");

  const dupGroups = await db
    .collection("app_users")
    .aggregate([
      { $group: { _id: "$email", ids: { $push: "$_id" }, count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
    ])
    .toArray();

  const userMerges = []; // { keep: ObjectId, remove: ObjectId[] }

  for (const group of dupGroups) {
    // Sort by createdAt ascending so we keep the oldest document
    const docs = await db
      .collection("app_users")
      .find({ _id: { $in: group.ids } })
      .sort({ createdAt: 1 })
      .toArray();

    const [keep, ...remove] = docs;
    userMerges.push({ email: group._id, keep: keep._id, remove: remove.map((d) => d._id) });

    console.log(`  Email: ${group._id}`);
    console.log(`    KEEP   → ${keep._id} (created ${keep.createdAt?.toISOString()})`);
    for (const r of remove) {
      console.log(`    DELETE → ${r._id} (created ${r.createdAt?.toISOString()})`);
    }
  }

  if (userMerges.length === 0) {
    console.log("  ✓ No duplicates found.");
  }

  // ─────────────────────────────────────────────────────────────
  // STEP 2 — Detect mock/seed transactions
  // ─────────────────────────────────────────────────────────────
  console.log("\n[2/2] Scanning for mock/seed transactions…");

  const orClauses = [];

  if (MOCK_CUTOFF_DATE) {
    orClauses.push({ date: { $lt: MOCK_CUTOFF_DATE } });
  }

  if (MOCK_PATTERNS.length > 0) {
    const patternRegex = MOCK_PATTERNS.map((p) => ({
      $or: [
        { merchant: { $regex: p, $options: "i" } },
        { description: { $regex: p, $options: "i" } },
      ],
    }));
    orClauses.push(...patternRegex);
  }

  const mockFilter = orClauses.length > 0 ? { $or: orClauses } : null;

  let mockTransactions = [];
  if (mockFilter) {
    mockTransactions = await db
      .collection("transactions")
      .find(mockFilter, {
        projection: { _id: 1, date: 1, merchant: 1, description: 1, amount: 1, currency: 1 },
      })
      .sort({ date: -1 })
      .toArray();
  }

  if (mockTransactions.length === 0) {
    console.log("  ✓ No mock transactions found.");
  } else {
    console.log(`  Found ${mockTransactions.length} mock transaction(s) to delete:`);
    for (const t of mockTransactions) {
      console.log(
        `    ${t._id}  ${t.date?.toISOString().slice(0, 10)}  ${t.merchant || t.description}  ${t.amount} ${t.currency}`
      );
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Confirm & execute
  // ─────────────────────────────────────────────────────────────
  const totalChanges = userMerges.reduce((n, m) => n + m.remove.length, 0) + mockTransactions.length;

  if (totalChanges === 0) {
    console.log("\n✅  Nothing to clean up. Database is already tidy.\n");
    await client.close();
    return;
  }

  console.log("\n" + "=".repeat(60));
  console.log(`Summary: ${userMerges.reduce((n, m) => n + m.remove.length, 0)} duplicate user(s) to delete, ${mockTransactions.length} mock transaction(s) to delete.`);

  const ok = await confirm("Proceed with cleanup?");
  if (!ok) {
    console.log("Aborted. No changes made.\n");
    await client.close();
    return;
  }

  // Fix duplicates
  for (const { email, keep, remove } of userMerges) {
    console.log(`\nMerging duplicates for ${email}…`);

    // Re-assign child documents
    const collections = ["transactions", "budgets", "subscriptions"];
    for (const col of collections) {
      const res = await db
        .collection(col)
        .updateMany({ user: { $in: remove } }, { $set: { user: keep } });
      if (res.modifiedCount > 0) {
        console.log(`  Updated ${res.modifiedCount} ${col} → user: ${keep}`);
      }
    }

    // Delete the duplicate user docs
    const delRes = await db.collection("app_users").deleteMany({ _id: { $in: remove } });
    console.log(`  Deleted ${delRes.deletedCount} duplicate app_users document(s).`);
  }

  // Delete mock transactions
  if (mockTransactions.length > 0) {
    const ids = mockTransactions.map((t) => t._id);
    const delRes = await db.collection("transactions").deleteMany({ _id: { $in: ids } });
    console.log(`\nDeleted ${delRes.deletedCount} mock transaction(s).`);
  }

  console.log("\n✅  Cleanup complete.\n");
  await client.close();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
