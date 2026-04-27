import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/ThemeProvider";

export const metadata: Metadata = {
  title: {
    default: "TrackFlow",
    template: "%s | TrackFlow",
  },
  description:
    "TrackFlow — AI-powered expense tracker with NLP entry, receipt OCR, subscription detection, and RAG chat.",
  manifest: "/manifest.json",
  applicationName: "TrackFlow",
  appleWebApp: {
    capable: true,
    title: "TrackFlow",
    statusBarStyle: "default",
  },
  // Favicon is resolved automatically from src/app/icon.svg (Next.js file convention).
};

export const viewport: Viewport = {
  // Keep in sync with Tailwind's overridden slate-950 (#0b1220) and the
  // --background HSL value in globals.css so the phone status bar matches
  // the app chrome edge-to-edge.
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0b1220" },
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

// Injected into <head> so the theme class is set BEFORE React hydration,
// preventing the classic "flash of wrong theme" on first paint.
// Defaults to light unless the user has explicitly chosen "dark".
const themeInitScript = `
(function () {
  try {
    var stored = localStorage.getItem('trackflow-theme');
    var theme = stored === 'dark' ? 'dark' : 'light';
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.style.colorScheme = theme;
  } catch (e) {
    document.documentElement.classList.remove('dark');
    document.documentElement.style.colorScheme = 'light';
  }
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" style={{ colorScheme: "light" }} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body
        className="min-h-dvh bg-white text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-200"
        suppressHydrationWarning
      >
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
