"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

/**
 * Root-level error boundary. Next.js App Router REQUIRES `global-error.tsx`
 * at the top of the route tree to render fallback UI when an error bubbles
 * above any layout (including RootLayout). Without it the browser shows
 * "missing required error components, refreshing..." and reloads in a loop.
 *
 * This component must define its own <html>/<body>, because RootLayout
 * is NOT rendered when global-error is active.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("[global-error]", error);
  }, [error]);

  return (
    <html lang="en" className="dark" style={{ colorScheme: "dark" }}>
      <body className="min-h-dvh bg-slate-950 text-slate-100 antialiased">
        <main className="flex min-h-dvh items-center justify-center px-6">
          <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-8 shadow-xl">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 text-red-400">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h1 className="mt-5 text-xl font-semibold tracking-tight">
              Something went wrong
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              An unexpected error occurred. You can try again; if the problem
              persists, check the server logs.
            </p>
            {error?.digest ? (
              <p className="mt-3 rounded-lg bg-slate-950 px-3 py-2 font-mono text-xs text-slate-400">
                digest: {error.digest}
              </p>
            ) : null}
            <button
              type="button"
              onClick={() => reset()}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-600/30 transition hover:bg-brand-700"
            >
              <RotateCcw className="h-4 w-4" />
              Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
