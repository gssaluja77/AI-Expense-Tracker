# AI-FinPilot

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
- **Styling:** Tailwind CSS (mobile-first, dark mode via `class`)
- **Database:** MongoDB Atlas via Mongoose
- **Cache:** Upstash Redis (serverless)
- **Auth:** NextAuth v5 (Auth.js) — Google, Facebook, Apple
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

## Project Structure

```
src/
├── app/                 # Next.js App Router routes
│   ├── api/auth/[...nextauth]/  # NextAuth route handler
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── layout/          # Sidebar (desktop) + BottomNav (mobile)
│   └── providers/       # SessionProvider, ThemeProvider
├── lib/
│   ├── auth/            # NextAuth v5 configuration
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
