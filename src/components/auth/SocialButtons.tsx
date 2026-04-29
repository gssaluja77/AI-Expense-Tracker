"use client";

import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { signInWithGoogle, signInWithFacebook } from "@/actions/auth";
import { cn } from "@/lib/utils/cn";

/**
 * Brand-marked social sign-in buttons.
 * Each button shows a spinner while the Server Action is in-flight so
 * users get immediate feedback during the OAuth redirect.
 */

interface SocialButtonsProps {
  callbackUrl?: string;
}

export function SocialButtons({ callbackUrl = "/dashboard" }: SocialButtonsProps) {
  const [googlePending, startGoogle] = useTransition();
  const [facebookPending, startFacebook] = useTransition();

  const handleGoogle = () => {
    const fd = new FormData();
    fd.set("callbackUrl", callbackUrl);
    startGoogle(() => signInWithGoogle(fd));
  };

  const handleFacebook = () => {
    const fd = new FormData();
    fd.set("callbackUrl", callbackUrl);
    startFacebook(() => signInWithFacebook(fd));
  };

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={handleGoogle}
        disabled={googlePending || facebookPending}
        className={cn(
          "inline-flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm transition",
          "hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70",
          "dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        )}
      >
        {googlePending ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <GoogleIcon className="h-5 w-5" />
        )}
        {googlePending ? "Redirecting…" : "Continue with Google"}
      </button>

      <button
        type="button"
        onClick={handleFacebook}
        disabled={googlePending || facebookPending}
        className={cn(
          "inline-flex w-full items-center justify-center gap-3 rounded-xl bg-[#1877F2] px-4 py-3 text-sm font-semibold text-white shadow-sm transition",
          "hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
        )}
      >
        {facebookPending ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <FacebookIcon className="h-5 w-5" />
        )}
        {facebookPending ? "Redirecting…" : "Continue with Facebook"}
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                          Inline brand mark SVGs                            */
/* -------------------------------------------------------------------------- */

function GoogleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden {...props}>
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.084 5.571.001-.001.002-.001.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  );
}

function FacebookIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H8v-2.89h2.44V9.79c0-2.41 1.43-3.74 3.62-3.74 1.05 0 2.14.19 2.14.19v2.36h-1.21c-1.19 0-1.56.74-1.56 1.5v1.8H16l-.43 2.89h-2.13v6.99A10 10 0 0 0 22 12" />
    </svg>
  );
}
