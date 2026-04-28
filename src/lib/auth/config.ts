import NextAuth, { type DefaultSession } from "next-auth";
import { MongoDBAdapter } from "@auth/mongodb-adapter";
import clientPromise from "@/lib/db/client";
import { authConfig } from "@/lib/auth/auth.config";
import {
  sanitizeAuthUrlEnv,
  warnIfAuthSecretMissing,
  warnIfOAuthOriginLikelyMisconfigured,
} from "@/lib/auth/oauth-env";

sanitizeAuthUrlEnv();
warnIfOAuthOriginLikelyMisconfigured();
warnIfAuthSecretMissing();

/**
 * Node-runtime NextAuth instance.
 *
 * Wraps the edge-safe {@link authConfig} with the MongoDB adapter so that
 * users / accounts / sessions are persisted alongside app data. This file
 * MUST NOT be imported from `middleware.ts` (or anything that ends up in
 * the Edge bundle) — use `@/lib/auth/auth.config` there instead.
 */

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      baseCurrency?: string;
    } & DefaultSession["user"];
  }
}

export const { auth, handlers, signIn, signOut } = NextAuth({
  ...authConfig,
  /** Pin route prefix — must match `src/app/api/auth/[...nextauth]/route.ts`. */
  basePath: "/api/auth",
  /** Set `AUTH_DEBUG=true` on Vercel to log OAuth/adapter steps (find real errors behind `error=Configuration`). */
  debug: process.env.AUTH_DEBUG === "true",
  adapter: MongoDBAdapter(clientPromise, {
    databaseName: process.env.MONGODB_DB_NAME || "ai-finpilot",
  }),
});
