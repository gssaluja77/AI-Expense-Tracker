import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import {
  parseTransactionFromImage,
  parseTransactionFromText,
} from "@/lib/ai/parse-transaction";
import {
  PARSE_RATE_LIMIT_BUCKETS,
  checkRateLimit,
  rateLimitHeaders,
  rateLimitMessage,
} from "@/lib/cache/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * `POST /api/transactions/parse`
 *
 * Converts either:
 *   • a natural-language note ("spent 450 on dinner at Olive yesterday"), or
 *   • a receipt / invoice photo (JPEG / PNG / WebP / PDF upload)
 *
 * into a draft transaction the client can render for the user to review
 * and confirm. The transaction is NOT persisted here — that's the job of
 * `createTransactionFromDraftAction`.
 *
 * Request bodies supported:
 *   • multipart/form-data with an `image` File (and optional `hint` text)
 *   • application/json with `{ text: "..." }`
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.OPENROUTER_API_KEY) {
    return NextResponse.json(
      { error: "OPENROUTER_API_KEY is not configured." },
      { status: 503 }
    );
  }

  const gate = await checkRateLimit(user.appUserId, PARSE_RATE_LIMIT_BUCKETS);
  if (!gate.ok) {
    return NextResponse.json(
      { error: rateLimitMessage(gate) },
      { status: 429, headers: rateLimitHeaders(gate) }
    );
  }

  const contentType = req.headers.get("content-type") ?? "";
  const baseCurrency = user.baseCurrency || "INR";

  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("image");
      const hint = asString(form.get("hint"));

      if (!(file instanceof File)) {
        return NextResponse.json(
          { error: "No image attached." },
          { status: 400 }
        );
      }
      if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
        return NextResponse.json(
          {
            error:
              "Unsupported file type. Upload a JPEG, PNG, WebP, HEIC, or PDF.",
          },
          { status: 415 }
        );
      }
      const MAX = 8 * 1024 * 1024; // 8 MB
      if (file.size > MAX) {
        return NextResponse.json(
          { error: "File is too large (max 8 MB)." },
          { status: 413 }
        );
      }

      const bytes = new Uint8Array(await file.arrayBuffer());
      const draft = await parseTransactionFromImage({
        bytes,
        mimeType: file.type,
        baseCurrency,
        hint: hint || undefined,
      });

      return NextResponse.json({ draft }, { headers: rateLimitHeaders(gate) });
    }

    if (contentType.includes("application/json")) {
      const body = (await req.json()) as { text?: string };
      const text = body.text?.trim();
      if (!text) {
        return NextResponse.json(
          { error: "Field `text` is required." },
          { status: 400 }
        );
      }
      const draft = await parseTransactionFromText(text, baseCurrency);
      return NextResponse.json({ draft }, { headers: rateLimitHeaders(gate) });
    }

    return NextResponse.json(
      { error: `Unsupported content-type: ${contentType}` },
      { status: 415 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // eslint-disable-next-line no-console
    console.error("[api/transactions/parse] failed", err);
    if (/quota|rate[_ -]?limit|429/i.test(message)) {
      return NextResponse.json(
        {
          error:
            "Gemini quota exceeded. Switch `GEMINI_MODEL` in .env or enable billing.",
        },
        { status: 429 }
      );
    }
    return NextResponse.json(
      { error: message || "Could not parse that input." },
      { status: 500 }
    );
  }
}

function asString(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value : "";
}
