"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  User as UserIcon,
  Globe,
  Bell,
  Mail,
  LogOut,
  Check,
  AlertCircle,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { SUPPORTED_CURRENCIES } from "@/lib/constants/currencies";
import { saveSettingsAction, type SettingsActionState } from "@/actions/settings";
import { signOutAction } from "@/actions/auth";
import type { CachedUserProfile } from "@/lib/auth/user-profile";

/* ── small reusable layout pieces ────────────────────────────── */

function SectionCard({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400">
          <Icon className="h-4 w-4" />
        </span>
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">{title}</h2>
      </div>
      <div className="divide-y divide-slate-100 dark:divide-slate-800">{children}</div>
    </div>
  );
}

function Row({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-center justify-between gap-4 px-5 py-4", className)}>
      {children}
    </div>
  );
}

function Label({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div className="min-w-0 flex-1">
      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{children}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-500">{sub}</p>}
    </div>
  );
}

function ComingSoonBadge() {
  return (
    <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20 dark:bg-amber-900/20 dark:text-amber-400 dark:ring-amber-500/20">
      Coming soon
    </span>
  );
}

function Toggle({
  name,
  checked,
  onChange,
}: {
  name: string;
  checked: boolean;
  onChange: (val: boolean) => void;
}) {
  return (
    <>
      <input type="hidden" name={name} value={checked ? "true" : "false"} />
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:ring-offset-slate-900",
          checked ? "bg-brand-600" : "bg-slate-200 dark:bg-slate-700"
        )}
      >
        <span
          className={cn(
            "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm ring-0 transition-transform duration-200",
            checked ? "translate-x-5" : "translate-x-0"
          )}
        />
      </button>
    </>
  );
}

function SelectField({
  name,
  defaultValue,
  options,
}: {
  name: string;
  defaultValue: string;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      name={name}
      defaultValue={defaultValue}
      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/* ── constants ────────────────────────────────────────────────── */

const LOCALES = [
  { value: "en-IN", label: "English (India)" },
  { value: "en-US", label: "English (US)" },
];

const TIMEZONES = [
  { value: "Asia/Kolkata", label: "Asia/Kolkata — IST (UTC+5:30)" },
  { value: "America/New_York", label: "America/New_York — EST (UTC-5)" },
  { value: "America/Los_Angeles", label: "America/Los_Angeles — PST (UTC-8)" },
  { value: "America/Chicago", label: "America/Chicago — CST (UTC-6)" },
  { value: "Europe/London", label: "Europe/London — GMT (UTC+0)" },
  { value: "Europe/Paris", label: "Europe/Paris — CET (UTC+1)" },
  { value: "Asia/Singapore", label: "Asia/Singapore — SGT (UTC+8)" },
  { value: "Asia/Tokyo", label: "Asia/Tokyo — JST (UTC+9)" },
  { value: "Australia/Sydney", label: "Australia/Sydney — AEDT (UTC+11)" },
];

/* ── main form ────────────────────────────────────────────────── */

export function SettingsForm({ user }: { user: CachedUserProfile }) {
  const [state, formAction, pending] = useActionState<SettingsActionState, FormData>(
    saveSettingsAction,
    {}
  );

  const [notifBudget, setNotifBudget] = useState(user.preferences.notifyOnBudgetExceeded);
  const [notifSubscription, setNotifSubscription] = useState(
    user.preferences.notifyOnSubscriptionDetected
  );
  const [notifBill, setNotifBill] = useState(user.preferences.notifyOnPredictedBill);

  const feedbackRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (state.success || state.error) {
      feedbackRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [state]);

  return (
    <div className="space-y-8">
    <form action={formAction} className="space-y-8">
      {/* Feedback banner */}
      {(state.success || state.error) && (
        <div
          ref={feedbackRef}
          className={cn(
            "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium",
            state.success
              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400"
              : "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"
          )}
        >
          {state.success ? (
            <Check className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          {state.success ? "Settings saved successfully." : state.error}
        </div>
      )}

      {/* ── Profile ── */}
      <SectionCard icon={UserIcon} title="Profile">
        <Row>
          <div className="flex items-center gap-3">
            {user.image ? (
              <Image
                src={user.image}
                alt={user.name ?? "Avatar"}
                width={44}
                height={44}
                className="h-11 w-11 rounded-full object-cover"
              />
            ) : (
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-100 text-lg font-semibold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                {(user.name ?? user.email)[0].toUpperCase()}
              </span>
            )}
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                {user.name ?? "—"}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{user.email}</p>
            </div>
          </div>
          <p className="shrink-0 text-xs text-slate-400 dark:text-slate-500">
            Managed by Google / Facebook
          </p>
        </Row>
      </SectionCard>

      {/* ── Currency & Locale ── */}
      <SectionCard icon={Globe} title="Currency & Locale">
        <Row>
          <Label sub="All transactions are converted to this currency for reporting">
            Base currency
          </Label>
          <SelectField
            name="baseCurrency"
            defaultValue={user.baseCurrency}
            options={SUPPORTED_CURRENCIES.map((c) => ({ value: c.code, label: c.label }))}
          />
        </Row>
        <Row>
          <Label sub="Affects date and number formatting throughout the app">
            Language / locale
          </Label>
          <SelectField name="locale" defaultValue={user.locale} options={LOCALES} />
        </Row>
        <Row>
          <Label sub="Used for relative date display and bill-due calculations">
            Time zone
          </Label>
          <SelectField name="timeZone" defaultValue={user.timeZone} options={TIMEZONES} />
        </Row>
      </SectionCard>

      {/* ── Notifications ── */}
      <SectionCard icon={Bell} title="Notifications">
        <Row>
          <Label sub="Alert when a budget envelope reaches or exceeds its limit">
            Budget exceeded
          </Label>
          <Toggle name="notifyOnBudgetExceeded" checked={notifBudget} onChange={setNotifBudget} />
        </Row>
        <Row>
          <Label sub="Alert when a new recurring charge is detected">
            Subscription detected
          </Label>
          <Toggle
            name="notifyOnSubscriptionDetected"
            checked={notifSubscription}
            onChange={setNotifSubscription}
          />
        </Row>
        <Row>
          <Label sub="Alert a few days before a predicted bill is due">
            Predicted bill alert
          </Label>
          <Toggle name="notifyOnPredictedBill" checked={notifBill} onChange={setNotifBill} />
        </Row>
      </SectionCard>

      {/* ── Connected accounts ── */}
      <SectionCard icon={Mail} title="Connected Accounts">
        <Row>
          <Label sub="Auto-import expense receipts directly from your inbox">
            Connect Gmail
          </Label>
          <div className="flex items-center gap-3">
            <ComingSoonBadge />
            <ChevronRight className="h-4 w-4 text-slate-300 dark:text-slate-600" />
          </div>
        </Row>
      </SectionCard>

      {/* ── Save ── */}
      <div className="flex justify-end !mt-4">
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>

    {/* ── Account / sign-out — must be OUTSIDE the settings <form> ── */}
    <SectionCard icon={LogOut} title="Account">
      <Row>
        <Label sub="You will be signed out and redirected to the home page">Sign out</Label>
        <form action={signOutAction}>
          <button
            type="submit"
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-100 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-950/50"
          >
            Sign out
          </button>
        </form>
      </Row>
    </SectionCard>
    </div>
  );
}
