# TrackFlow

An AI-powered, offline-capable PWA Expense Tracker. Built with Next.js 15 (App Router), TypeScript, Tailwind CSS, MongoDB Atlas, Upstash Redis, NextAuth v5 (Auth.js), and the Vercel AI SDK with Google Gemini 2.0 Flash.

## Feature Overview

| Module | Description |
| --- | --- |
| AI Engine (NLP) | Server Action ingests free-text like *"Spent 500 on dinner"* and creates a structured transaction. |
| AI Engine (Vision) | Receipt upload routed to Gemini 2.0 Flash for OCR + field extraction. |
| Smart Subscriptions | Background job detects recurring merchant+amount patterns and flags them. |
| Predictive Bill Alerts | Forecasts upcoming bills from historical frequency + variance. |
| Chat with your Data (RAG) | Vercel AI SDK chat UI that retrieves over your transaction history. |
| Collaboration / Split | Expenses can be shared with other users with per-split settlement state. |
| Multi-Currency | Stores both local currency and base currency (INR) with captured exchange rate. |
| Budget Envelopes | Visual category-based limits with progress tracking. |
| Data Portability | `/api/export` emits CSV or JSON for the authenticated user. |
| PWA | Installable, Web Push capable, offline-friendly. |

## Tech Stack

- **Framework:** Next.js 15+ (App Router) + React 19
- **Language:** TypeScript (strict)
- **Styling:** Tailwind CSS (mobile-first, dark mode via `class`, defaults to dark)
- **Database:** MongoDB Atlas via Mongoose
- **Cache:** Upstash Redis (serverless)
- **Auth:** NextAuth v5 (Auth.js) — Google, Facebook
- **AI:** Vercel AI SDK + `@ai-sdk/google` (Gemini 2.0 Flash)
- **Icons:** Lucide React

## Quick Start

```bash
# 1. Install deps
npm install

# 2. Copy env template and fill in secrets
cp .env.example .env.local

# 3. Run dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Social sign-in (Google & Facebook)

Auth.js builds the OAuth **`redirect_uri`** from your public origin. If it does not **exactly** match what you registered with Google or Meta, you will see **Error 400: redirect_uri_mismatch** (Google) or a similar error from Facebook.

1. Set **`AUTH_URL`** (no trailing slash) to the same origin users use in the browser — for example `http://localhost:3000` locally and `https://your-app.vercel.app` (or your custom domain) on Vercel. You can use **`NEXTAUTH_URL`** instead; either works if set consistently.
2. **Google Cloud Console** → APIs & Services → Credentials → your **Web** OAuth client → **Authorized redirect URIs**. Add every origin you use, each with this path:
   - `{AUTH_URL}/api/auth/callback/google`  
   Examples: `http://localhost:3000/api/auth/callback/google`, `https://your-app.vercel.app/api/auth/callback/google`. If you use another dev port, add that URI too.
3. **Meta for Developers** → your app → **Facebook Login** → Settings → **Valid OAuth Redirect URIs**:
   - `{AUTH_URL}/api/auth/callback/facebook`  
   Same rules as Google (localhost + each production / preview URL you use).
4. In **Vercel** → Project → Settings → Environment Variables, set **`AUTH_URL`** for Production (and Preview if you test OAuth on preview URLs — each preview host needs its redirect URI added in both consoles, or use a stable preview domain).

Facebook also needs **Facebook Login** enabled on the app and (for production) **HTTPS** redirect URIs except for `http://localhost`. Under **App Review → Permissions and features**, ensure **email** and **public_profile** are allowed for your use case (standard Login); the app requests `public_profile,email`.

### `?error=Configuration` after Google (500 on `/api/auth/error`)

Almost always **missing `AUTH_SECRET`** on the server (Vercel env vars). Auth.js v5 expects **`AUTH_SECRET`**; if you only have the old name, add **`NEXTAUTH_SECRET`** with the same value — this repo falls back to it — or rename it to **`AUTH_SECRET`**. Generate one locally with:

```bash
npx auth secret
```

Then redeploy. Also confirm **`GOOGLE_CLIENT_ID`**, **`GOOGLE_CLIENT_SECRET`**, **`MONGODB_URI`**, and **`MONGODB_DB_NAME`** are set on Vercel (callback runs in Node and talks to MongoDB via the adapter).

## Project Structure

```
src/
├── app/                 # Next.js App Router routes
│   ├── api/auth/[...nextauth]/  # NextAuth route handler
│   ├── dashboard/               # Protected dashboard
│   ├── login/                   # Social sign-in
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── layout/          # Sidebar (desktop) + BottomNav (mobile)
│   └── providers/       # ThemeProvider
├── lib/
│   ├── auth/            # NextAuth v5 configuration (edge-safe + node)
│   ├── cache/           # Upstash Redis client + withCache helper
│   ├── db/              # MongoDB (Mongoose) singleton connection
│   ├── ai/              # Gemini client + prompts
│   └── utils/           # cn(), currency helpers, etc.
├── models/              # Mongoose schemas (User, Transaction, Budget, ...)
├── types/               # Ambient + shared types
└── actions/             # Server Actions (NLP entry, OCR, exports, ...)
```

## Security Notes

All AI and DB interactions flow through **Server Actions** or **protected Route Handlers** — no secrets or direct DB access ever reach the client.

## License

MIT
