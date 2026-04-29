import Link from "next/link";
import { TrackFlowLogo } from "@/components/brand/TrackFlowLogo";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "TrackFlow privacy policy — how we collect, use, and protect your data.",
};

const LAST_UPDATED = "April 29, 2026";
const APP_NAME = "TrackFlow";
const CONTACT_EMAIL = "support@trackflow.app";

export default function PrivacyPage() {
  return (
    <div className="min-h-dvh bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-200">
      <header className="border-b border-slate-200 px-6 py-4 dark:border-slate-800">
        <Link href="/" className="inline-flex items-center gap-2 font-semibold">
          <TrackFlowLogo size={32} className="shrink-0 rounded-lg" />
          <span className="text-lg tracking-tight">{APP_NAME}</span>
        </Link>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-bold">Privacy Policy</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Last updated: {LAST_UPDATED}
        </p>

        <Section title="1. Introduction">
          <p>
            Welcome to {APP_NAME}. We respect your privacy and are committed to
            protecting your personal data. This policy explains what information
            we collect when you use {APP_NAME}, how we use it, and your rights
            regarding that information.
          </p>
        </Section>

        <Section title="2. Information We Collect">
          <p>We collect the following categories of information:</p>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>
              <strong>Account information</strong> — your name, email address,
              and profile picture, obtained via Google or Facebook OAuth when
              you sign in.
            </li>
            <li>
              <strong>Financial data you enter</strong> — transactions,
              categories, amounts, merchants, dates, notes, and budget limits
              that you create within the app.
            </li>
            <li>
              <strong>Receipt images</strong> — photos or PDFs you upload for
              OCR scanning. These are sent to Google Gemini for extraction and
              are not stored permanently on our servers.
            </li>
            <li>
              <strong>Usage data</strong> — basic interaction logs used to
              operate and improve the service (e.g. error traces).
            </li>
          </ul>
        </Section>

        <Section title="3. How We Use Your Information">
          <ul className="list-disc space-y-2 pl-5">
            <li>To authenticate you and maintain your session.</li>
            <li>To store and display your financial data to you.</li>
            <li>
              To power AI features — natural-language entry and receipt OCR
              (via Google Gemini API) and conversational queries over your own
              data.
            </li>
            <li>To calculate spending summaries, budget progress, and trends.</li>
            <li>To improve the reliability and performance of the service.</li>
          </ul>
          <p className="mt-3">
            We do not sell, rent, or share your personal or financial data with
            third parties for advertising or marketing purposes.
          </p>
        </Section>

        <Section title="4. Third-Party Services">
          <p>
            {APP_NAME} integrates with the following third-party services to
            operate:
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>
              <strong>Google OAuth</strong> — for sign-in. Governed by{" "}
              <a
                href="https://policies.google.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-600 underline dark:text-brand-400"
              >
                Google&rsquo;s Privacy Policy
              </a>
              .
            </li>
            <li>
              <strong>Facebook / Meta Login</strong> — for sign-in. Governed
              by{" "}
              <a
                href="https://www.facebook.com/privacy/policy/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-600 underline dark:text-brand-400"
              >
                Meta&rsquo;s Privacy Policy
              </a>
              .
            </li>
            <li>
              <strong>Google Gemini API</strong> — for AI-powered features.
              Receipt images and natural-language text are sent to Gemini for
              processing.
            </li>
            <li>
              <strong>MongoDB Atlas</strong> — cloud database where your data
              is stored securely.
            </li>
            <li>
              <strong>Vercel</strong> — hosting platform.
            </li>
          </ul>
        </Section>

        <Section title="5. Data Retention">
          <p>
            Your data is retained for as long as your account is active. You
            may request deletion of your account and all associated data at any
            time — see the{" "}
            <Link
              href="/data-deletion"
              className="text-brand-600 underline dark:text-brand-400"
            >
              Data Deletion
            </Link>{" "}
            page.
          </p>
        </Section>

        <Section title="6. Security">
          <p>
            We use industry-standard security practices including HTTPS
            encryption in transit, secure OAuth flows, and access controls on
            our database. No method of transmission or storage is 100% secure;
            we cannot guarantee absolute security.
          </p>
        </Section>

        <Section title="7. Children's Privacy">
          <p>
            {APP_NAME} is not directed at children under 13. We do not
            knowingly collect personal information from children.
          </p>
        </Section>

        <Section title="8. Changes to This Policy">
          <p>
            We may update this Privacy Policy from time to time. We will notify
            you of material changes by updating the &ldquo;Last updated&rdquo;
            date at the top of this page.
          </p>
        </Section>

        <Section title="9. Contact">
          <p>
            If you have questions about this policy or your data, contact us
            at{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-brand-600 underline dark:text-brand-400"
            >
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </Section>
      </main>

      <footer className="border-t border-slate-200 px-6 py-6 text-center text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
        &copy; {new Date().getFullYear()} {APP_NAME}. All rights reserved.
        &nbsp;·&nbsp;
        <Link href="/data-deletion" className="underline hover:text-slate-700 dark:hover:text-slate-200">
          Data Deletion
        </Link>
      </footer>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <h2 className="text-xl font-semibold">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
        {children}
      </div>
    </section>
  );
}
