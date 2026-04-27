"use server";

import { redirect } from "next/navigation";
import { auth, signIn, signOut } from "@/lib/auth/config";
import { invalidateUserProfile } from "@/lib/auth/user-profile";

/**
 * Next.js throws objects of shape `{ digest: "NEXT_REDIRECT;..." }` when
 * `redirect()` or `signIn()` want to redirect. We must NOT swallow those.
 */
function isNextRedirectError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "digest" in err &&
    typeof (err as { digest?: unknown }).digest === "string" &&
    (err as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

/**
 * Server Actions for auth. Colocated so client components can bind them
 * directly to <form action={...}> without any client-side SDK.
 */

type Provider = "google" | "facebook";

function safeCallbackUrl(input: FormDataEntryValue | null): string {
  if (typeof input !== "string" || !input) return "/dashboard";
  // Only allow same-origin paths to avoid open-redirect abuse.
  if (!input.startsWith("/")) return "/dashboard";
  return input;
}

export async function signInWithProvider(provider: Provider, formData: FormData) {
  const redirectTo = safeCallbackUrl(formData.get("callbackUrl"));
  try {
    await signIn(provider, { redirectTo });
  } catch (err) {
    // `signIn` throws a NEXT_REDIRECT on success — bubble it so Next.js can
    // forward the browser to the provider's authorize URL.
    if (isNextRedirectError(err)) throw err;
    // Otherwise it's a real failure (bad provider config, network error,
    // etc). Log it so the dev terminal shows the actual cause, then send
    // the user back to /login with a visible error code instead of silently
    // landing them on "/" (the default Auth.js safe-origin fallback).
    const code =
      err instanceof Error && "type" in err
        ? (err as { type?: string }).type
        : err instanceof Error
          ? err.name
          : "SignInError";
    // eslint-disable-next-line no-console
    console.error(`[auth] signIn(${provider}) failed:`, code, err);
    redirect(`/login?error=${encodeURIComponent(String(code))}`);
  }
}

export async function signInWithGoogle(formData: FormData) {
  await signInWithProvider("google", formData);
}

export async function signInWithFacebook(formData: FormData) {
  await signInWithProvider("facebook", formData);
}

export async function signOutAction() {
  const session = await auth();
  const userId = session?.user?.id;
  if (userId) {
    // Drop the cached profile so a subsequent sign-in starts from a clean
    // Redis state (e.g. if the user updated their profile elsewhere).
    await invalidateUserProfile(userId).catch(() => {
      /* non-fatal */
    });
  }
  await signOut({ redirectTo: "/" });
}
