import Link from "next/link";
import { TrackFlowLogo } from "@/components/brand/TrackFlowLogo";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Data Deletion",
  description: "How to request deletion of your TrackFlow account and data.",
};

const APP_NAME = "TrackFlow";
const CONTACT_EMAIL = "support@trackflow.app";

export default function DataDeletionPage() {
  return (
    <div className="min-h-dvh bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-200">
      <header className="border-b border-slate-200 px-6 py-4 dark:border-slate-800">
        <Link href="/" className="inline-flex items-center gap-2 font-semibold">
          <TrackFlowLogo size={30} className="shrink-0 rounded-lg" />
          <span className="text-lg tracking-tight">{APP_NAME}</span>
        </Link>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-bold">Data Deletion Request</h1>
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
          You have the right to request deletion of your {APP_NAME} account and
          all associated personal data at any time.
        </p>

        <section className="mt-8">
          <h2 className="text-xl font-semibold">What gets deleted</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
            <li>Your profile (name, email, profile picture)</li>
            <li>All transactions, categories, and notes you have created</li>
            <li>All budgets and budget history</li>
            <li>Your preferences and app settings</li>
            <li>Any cached session data</li>
          </ul>
        </section>

        <section className="mt-8">
          <h2 className="text-xl font-semibold">How to request deletion</h2>
          <div className="mt-3 space-y-4 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
            <p>
              Send an email to{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}?subject=Data Deletion Request&body=Please delete my TrackFlow account and all associated data.%0A%0AEmail address associated with my account: `}
                className="font-medium text-brand-600 underline dark:text-brand-400"
              >
                {CONTACT_EMAIL}
              </a>{" "}
              with the subject line <strong>Data Deletion Request</strong> and
              include the email address associated with your {APP_NAME} account.
            </p>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
              <p className="font-medium">Template you can copy:</p>
              <p className="mt-2 font-mono text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                To: {CONTACT_EMAIL}
                <br />
                Subject: Data Deletion Request
                <br />
                <br />
                Hi,
                <br />
                Please delete my {APP_NAME} account and all associated data.
                <br />
                <br />
                Account email: [your email address]
              </p>
            </div>

            <p>
              We will process your request within <strong>30 days</strong> and
              send a confirmation once deletion is complete.
            </p>
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-xl font-semibold">Facebook-connected accounts</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
            If you signed in via Facebook, you can also revoke {APP_NAME}&rsquo;s
            access directly from your Facebook settings:
          </p>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
            <li>
              Go to{" "}
              <a
                href="https://www.facebook.com/settings?tab=applications"
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-600 underline dark:text-brand-400"
              >
                Facebook Settings → Apps and Websites
              </a>
            </li>
            <li>Find <strong>{APP_NAME}</strong> in the list</li>
            <li>Click <strong>Remove</strong></li>
          </ol>
          <p className="mt-3 text-sm text-slate-700 dark:text-slate-300">
            Revoking access in Facebook removes {APP_NAME}&rsquo;s ability to use
            Facebook login, but does not delete your {APP_NAME} data. Please
            also send the email above to request full data deletion.
          </p>
        </section>

        <section className="mt-8">
          <h2 className="text-xl font-semibold">Questions?</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
            Contact us at{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-brand-600 underline dark:text-brand-400"
            >
              {CONTACT_EMAIL}
            </a>
            . For more information on how we handle your data, see our{" "}
            <Link
              href="/privacy"
              className="text-brand-600 underline dark:text-brand-400"
            >
              Privacy Policy
            </Link>
            .
          </p>
        </section>
      </main>

      <footer className="border-t border-slate-200 px-6 py-6 text-center text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
        &copy; {new Date().getFullYear()} {APP_NAME}. All rights reserved.
        &nbsp;·&nbsp;
        <Link href="/privacy" className="underline hover:text-slate-700 dark:hover:text-slate-200">
          Privacy Policy
        </Link>
      </footer>
    </div>
  );
}

