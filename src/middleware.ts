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

  // App Router metadata routes (app/icon.svg, app/apple-icon.png, …) live at
  // /icon, /apple-icon, etc. They must stay public — otherwise the browser’s
  // favicon request hits auth and gets redirected, so the tab shows no logo.
  const isMetadataRoute =
    pathname === "/icon" ||
    pathname === "/apple-icon" ||
    pathname.startsWith("/icon/") ||
    pathname.startsWith("/apple-icon/");

  const isPublic =
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/manifest") ||
    pathname.startsWith("/icons") ||
    pathname.startsWith("/_next") ||
    isMetadataRoute;

  if (isPublic) return;

  if (!req.auth) {
    const url = new URL("/login", req.nextUrl.origin);
    url.searchParams.set("callbackUrl", pathname);
    return Response.redirect(url);
  }
});

export const config = {
  matcher: [
    // Exclude static assets, PWA files, and App Router metadata image routes.
    "/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|icons|sw.js|manifest.json).*)",
  ],
};
