import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "AI-FinPilot",
    template: "%s | AI-FinPilot",
  },
  description:
    "AI-powered expense tracker with NLP entry, receipt OCR, subscription detection, and RAG chat.",
  manifest: "/manifest.json",
  applicationName: "AI-FinPilot",
  appleWebApp: {
    capable: true,
    title: "AI-FinPilot",
    statusBarStyle: "default",
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#1a73f5",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-dvh bg-white text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-100">
        {children}
      </body>
    </html>
  );
}
