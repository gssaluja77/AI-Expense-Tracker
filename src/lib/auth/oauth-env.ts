/**
 * OAuth (Google / Facebook) expects the same **origin** everywhere:
 * `AUTH_URL` (or legacy `NEXTAUTH_URL`) in env, the URL in the browser,
 * and the **Authorized redirect URIs** in each provider console.
 *
 * Auth.js callback paths (always under `/api/auth`):
 *   Google:    {origin}/api/auth/callback/google
 *   Facebook:  {origin}/api/auth/callback/facebook
 */

export function normalizedAuthUrl(): string | undefined {
  const raw = process.env.AUTH_URL || process.env.NEXTAUTH_URL;
  if (!raw?.trim()) return undefined;
  return raw.trim().replace(/\/+$/, "");
}

/**
 * Log once per server boot if production OAuth is likely misconfigured.
 * Safe to call from `src/lib/auth/config.ts` at module load.
 */
export function warnIfOAuthOriginLikelyMisconfigured(): void {
  if (process.env.NODE_ENV !== "production") return;

  const authUrl = normalizedAuthUrl();
  if (authUrl) return;

  const vercel = process.env.VERCEL_URL;
  const hint = vercel
    ? `Example: AUTH_URL=https://${vercel} (use your real custom domain if you have one).`
    : "Set AUTH_URL to your public https origin (no trailing slash), e.g. https://myapp.vercel.app";

  // eslint-disable-next-line no-console
  console.warn(
    `[auth] AUTH_URL (or NEXTAUTH_URL) is not set. Google/Facebook will often return redirect_uri_mismatch until it matches the live site URL. ${hint} Register callbacks: {AUTH_URL}/api/auth/callback/google and .../callback/facebook.`
  );
}

/**
 * Missing `AUTH_SECRET` (and legacy `NEXTAUTH_SECRET`) causes Auth.js to fail
 * OAuth callbacks with `?error=Configuration` on production.
 */
export function warnIfAuthSecretMissing(): void {
  if (process.env.NODE_ENV !== "production") return;

  const has =
    Boolean(process.env.AUTH_SECRET?.trim()) ||
    Boolean(process.env.NEXTAUTH_SECRET?.trim());
  if (has) return;

  // eslint-disable-next-line no-console
  console.error(
    "[auth] AUTH_SECRET is not set (NEXTAUTH_SECRET is also empty). OAuth will fail with error=Configuration. Run `npx auth secret` or set AUTH_SECRET in Vercel → Environment Variables."
  );
}
