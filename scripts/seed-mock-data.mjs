// Seed demo transactions + budgets for a given user's email.
//
// Run with:
//   node --env-file=.env scripts/seed-mock-data.mjs <email>
//
// If <email> is omitted the script picks the single `app_users` doc if
// there's only one, otherwise errors out. Existing demo data
// (`aiMeta.model === "seed"`) is cleared before re-inserting so the
// script is idempotent — run it as many times as you like.
import { MongoClient, ObjectId } from "mongodb";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME || "trackflow_db";

if (!uri) {
  console.error("MONGODB_URI not set. Run with: node --env-file=.env scripts/seed-mock-data.mjs");
  process.exit(1);
}

const argEmail = process.argv[2]?.trim().toLowerCase();

const TX_COUNT = 45;
const MONTHS_BACK = 3;

// ------------------ deterministic pseudo-random helpers ------------------

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(2026_04_27);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const between = (lo, hi) => Math.round(lo + rand() * (hi - lo));

// ------------------ demo data ------------------

const EXPENSE_CATALOG = [
  { merchant: "Starbucks", category: "Food", subcategory: "Coffee", range: [180, 520], method: "upi" },
  { merchant: "Zomato", category: "Food", subcategory: "Delivery", range: [220, 950], method: "upi" },
  { merchant: "Swiggy", category: "Food", subcategory: "Delivery", range: [250, 1100], method: "upi" },
  { merchant: "Big Bazaar", category: "Groceries", range: [800, 3200], method: "card" },
  { merchant: "DMart", category: "Groceries", range: [600, 2800], method: "card" },
  { merchant: "Uber", category: "Transport", subcategory: "Ride hailing", range: [140, 720], method: "upi" },
  { merchant: "Ola", category: "Transport", subcategory: "Ride hailing", range: [120, 680], method: "upi" },
  { merchant: "IndianOil", category: "Transport", subcategory: "Fuel", range: [1500, 3500], method: "card" },
  { merchant: "Netflix", category: "Subscriptions", subcategory: "Streaming", range: [649, 649], method: "card", recurring: true },
  { merchant: "Spotify", category: "Subscriptions", subcategory: "Music", range: [119, 119], method: "card", recurring: true },
  { merchant: "Amazon Prime", category: "Subscriptions", subcategory: "Streaming", range: [1499, 1499], method: "card", recurring: true },
  { merchant: "PVR Cinemas", category: "Entertainment", range: [350, 1200], method: "card" },
  { merchant: "BookMyShow", category: "Entertainment", range: [400, 1400], method: "upi" },
  { merchant: "Amazon", category: "Shopping", range: [500, 6500], method: "card" },
  { merchant: "Flipkart", category: "Shopping", range: [600, 5200], method: "upi" },
  { merchant: "Decathlon", category: "Shopping", subcategory: "Sports", range: [1200, 7500], method: "card" },
  { merchant: "Apollo Pharmacy", category: "Health", range: [200, 1800], method: "upi" },
  { merchant: "Airtel", category: "Bills", subcategory: "Mobile", range: [399, 399], method: "upi", recurring: true },
  { merchant: "BSES", category: "Bills", subcategory: "Electricity", range: [900, 2600], method: "upi" },
  { merchant: "Rent", category: "Bills", subcategory: "Rent", range: [22000, 22000], method: "bank", recurring: true },
];

const INCOME_CATALOG = [
  { merchant: "Acme Corp", category: "Salary", range: [95000, 105000], method: "bank", recurring: true },
  { merchant: "Freelance — Landing page", category: "Freelance", range: [8000, 22000], method: "upi" },
  { merchant: "Dividend", category: "Investments", range: [500, 4200], method: "bank" },
];

const BUDGET_DEFS = [
  { name: "Food & coffee", category: "Food", limit: 8000 },
  { name: "Groceries", category: "Groceries", limit: 10000 },
  { name: "Transport", category: "Transport", limit: 6000 },
  { name: "Subscriptions", category: "Subscriptions", limit: 3500 },
  { name: "Entertainment", category: "Entertainment", limit: 4000 },
];

// ------------------ main ------------------

const client = new MongoClient(uri, { serverSelectionTimeoutMS: 8_000 });

try {
  await client.connect();
  const db = client.db(dbName);

  // 1. Locate the user (app_users collection is the source of truth for
  //    app-specific data — it's what transactions & budgets reference).
  const users = db.collection("app_users");
  let userDoc;
  if (argEmail) {
    userDoc = await users.findOne({ email: argEmail });
    if (!userDoc) {
      console.error(`No app_users doc found with email "${argEmail}".`);
      console.error("Sign in to the app at least once with that Google account first.");
      process.exit(1);
    }
  } else {
    const candidates = await users.find({}).limit(2).toArray();
    if (candidates.length === 0) {
      console.error("No app_users documents exist yet.");
      console.error("Sign in to the app once (Google), then re-run this script.");
      process.exit(1);
    }
    if (candidates.length > 1) {
      console.error("Multiple users found — pass the email explicitly:");
      const all = await users.find({}, { projection: { email: 1 } }).toArray();
      for (const u of all) console.error("  -", u.email);
      process.exit(1);
    }
    userDoc = candidates[0];
  }

  console.log(`Seeding data for ${userDoc.email} (app_users _id: ${userDoc._id})`);

  const transactions = db.collection("transactions");
  const budgets = db.collection("budgets");

  // 2. Wipe previous seed runs so this is idempotent.
  const prevTx = await transactions.deleteMany({
    user: userDoc._id,
    "aiMeta.model": "seed",
  });
  const prevBg = await budgets.deleteMany({
    user: userDoc._id,
    "meta.seed": true,
  });
  console.log(`Cleared ${prevTx.deletedCount} prior seed transactions and ${prevBg.deletedCount} prior seed budgets.`);

  // 3. Generate transactions across the last ~MONTHS_BACK months.
  const now = new Date();
  const earliest = new Date(now);
  earliest.setMonth(earliest.getMonth() - MONTHS_BACK);

  const txDocs = [];

  // 3a. Monthly salaries on the 1st of each month.
  for (let m = 0; m < MONTHS_BACK + 1; m++) {
    const d = new Date(earliest);
    d.setMonth(earliest.getMonth() + m);
    d.setDate(1);
    if (d > now) continue;
    const def = INCOME_CATALOG[0];
    const amt = between(def.range[0], def.range[1]);
    txDocs.push(buildTx({
      userId: userDoc._id,
      baseCurrency: userDoc.baseCurrency || "INR",
      type: "income",
      merchant: def.merchant,
      category: def.category,
      amount: amt,
      date: d,
      paymentMethod: def.method,
      isRecurring: true,
      description: `${def.merchant} — monthly salary`,
    }));
  }

  // 3b. Monthly rent on the 3rd.
  const rentDef = EXPENSE_CATALOG.find((e) => e.merchant === "Rent");
  for (let m = 0; m < MONTHS_BACK + 1; m++) {
    const d = new Date(earliest);
    d.setMonth(earliest.getMonth() + m);
    d.setDate(3);
    if (d > now) continue;
    txDocs.push(buildTx({
      userId: userDoc._id,
      baseCurrency: userDoc.baseCurrency || "INR",
      type: "expense",
      merchant: rentDef.merchant,
      category: rentDef.category,
      subcategory: rentDef.subcategory,
      amount: rentDef.range[0],
      date: d,
      paymentMethod: rentDef.method,
      isRecurring: true,
      description: "Monthly rent",
    }));
  }

  // 3c. Monthly subscriptions (Netflix, Spotify, Prime, Airtel) on their own
  //     consistent day-of-month so the subscription detector can spot them.
  const subs = EXPENSE_CATALOG.filter((e) => e.recurring && e.merchant !== "Rent");
  for (const def of subs) {
    const dom = between(5, 28);
    for (let m = 0; m < MONTHS_BACK + 1; m++) {
      const d = new Date(earliest);
      d.setMonth(earliest.getMonth() + m);
      d.setDate(dom);
      if (d > now) continue;
      txDocs.push(buildTx({
        userId: userDoc._id,
        baseCurrency: userDoc.baseCurrency || "INR",
        type: "expense",
        merchant: def.merchant,
        category: def.category,
        subcategory: def.subcategory,
        amount: def.range[0],
        date: d,
        paymentMethod: def.method,
        isRecurring: true,
        description: `${def.merchant} — monthly charge`,
      }));
    }
  }

  // 3d. Random ad-hoc expenses spread across the window.
  const oneoff = EXPENSE_CATALOG.filter((e) => !e.recurring);
  while (txDocs.length < TX_COUNT) {
    const def = pick(oneoff);
    const amount = between(def.range[0], def.range[1]);
    const ts = earliest.getTime() + rand() * (now.getTime() - earliest.getTime());
    txDocs.push(buildTx({
      userId: userDoc._id,
      baseCurrency: userDoc.baseCurrency || "INR",
      type: "expense",
      merchant: def.merchant,
      category: def.category,
      subcategory: def.subcategory,
      amount,
      date: new Date(ts),
      paymentMethod: def.method,
      isRecurring: false,
    }));
  }

  // 3e. A few misc income rows.
  for (let i = 0; i < 4; i++) {
    const def = pick(INCOME_CATALOG.slice(1)); // skip the salary entry
    const amount = between(def.range[0], def.range[1]);
    const ts = earliest.getTime() + rand() * (now.getTime() - earliest.getTime());
    txDocs.push(buildTx({
      userId: userDoc._id,
      baseCurrency: userDoc.baseCurrency || "INR",
      type: "income",
      merchant: def.merchant,
      category: def.category,
      amount,
      date: new Date(ts),
      paymentMethod: def.method,
      isRecurring: false,
    }));
  }

  await transactions.insertMany(txDocs);
  console.log(`Inserted ${txDocs.length} transactions.`);

  // 4. Insert budgets (tagged with meta.seed for idempotency).
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const budgetDocs = BUDGET_DEFS.map((b) => ({
    _id: new ObjectId(),
    user: userDoc._id,
    name: b.name,
    category: b.category,
    limit: b.limit,
    currency: userDoc.baseCurrency || "INR",
    period: "monthly",
    startDate: firstOfMonth,
    rolloverUnused: false,
    alertThreshold: 0.8,
    archived: false,
    meta: { seed: true },
    createdAt: now,
    updatedAt: now,
  }));

  await budgets.insertMany(budgetDocs);
  console.log(`Inserted ${budgetDocs.length} budgets.`);

  console.log("\nDone. Refresh the dashboard — stats, recent transactions, and budget progress should populate.");
  process.exit(0);
} catch (err) {
  console.error("FAILED:", err?.codeName || err?.name, "-", err?.message);
  process.exit(1);
} finally {
  await client.close().catch(() => {});
}

// ------------------ helpers ------------------

function buildTx({
  userId,
  baseCurrency,
  type,
  merchant,
  category,
  subcategory,
  amount,
  date,
  paymentMethod,
  isRecurring,
  description,
}) {
  const rounded = Math.round(amount);
  const now = new Date();
  return {
    _id: new ObjectId(),
    user: userId,
    amount: rounded,
    currency: baseCurrency,
    baseAmount: rounded,
    baseCurrency,
    exchangeRate: 1,
    type,
    category,
    ...(subcategory ? { subcategory } : {}),
    merchant,
    description: description ?? `${merchant} — ${category.toLowerCase()}`,
    notes: "Seeded demo data",
    tags: ["demo"],
    date,
    paymentMethod,
    source: "manual",
    aiMeta: { model: "seed" },
    isRecurring: Boolean(isRecurring),
    shared: { isShared: false, splits: [], totalOwed: 0 },
    deleted: false,
    createdAt: now,
    updatedAt: now,
  };
}
