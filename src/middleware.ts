import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth/auth.config";

/**
 * Middleware runs in the Edge Runtime, which does NOT support Node.js
 * built-ins (e.g. `crypto`, `mongodb`). We therefore instantiate
 * NextAuth here with the edge-safe config only — no adapter, no Mongoose.
 *
 * The full adapter-backed instance lives in `@/lib/auth/config` and is
 * used by Server Components, Server Actions, and Route Handlers.
 */
const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname } = req.nextUrl;

  const isPublic =
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/manifest") ||
    pathname.startsWith("/icons") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/privacy") ||
    pathname.startsWith("/data-deletion");

  if (isPublic) return;

  if (!req.auth) {
    const url = new URL("/login", req.nextUrl.origin);
    url.searchParams.set("callbackUrl", pathname);
    return Response.redirect(url);
  }
});

export const config = {
  matcher: [
    // Exclude static assets and PWA files.
    "/((?!_next/static|_next/image|favicon.ico|icons|sw.js|manifest.json).*)",
  ],
};
