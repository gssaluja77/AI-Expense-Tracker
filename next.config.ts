import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    // Browsers request /favicon.ico by default; we only ship `app/icon.svg` → `/icon`.
    return [{ source: "/favicon.ico", destination: "/icon" }];
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb", // allow larger uploads (receipts)
    },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "platform-lookaside.fbsbx.com" },
    ],
  },
  serverExternalPackages: ["mongoose"],
};

export default nextConfig;
