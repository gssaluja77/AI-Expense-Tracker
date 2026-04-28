import "server-only";
import type { SupportedCurrencyCode } from "@/lib/constants/currencies";

/**
 * FX rate fetcher for the app's supported currencies (INR + USD only).
 *
 * Design notes:
 *   • Deterministic, no LLM calls (per AI usage policy).
 *   • Source: open.er-api.com — free, no API key, ECB-sourced daily rates.
 *   • Cached in a process-local Map for 1h. No Redis dependency — Mongo
 *     is our single source of truth for anything durable, and FX rates
 *     are safe to re-fetch on each serverless cold start.
 *   • On *any* failure — network down, parse error, missing code — we fall
 *     back to the hardcoded {@link FALLBACK_RATES} so a transaction save
 *     never fails because of FX.
 *   • `baseAmount` is always stored rounded to 2 decimals to avoid
 *     drift across reads.
 */

type FxCode = SupportedCurrencyCode;

const API_URL = "https://open.er-api.com/v6/latest"; // + /{base}

/**
 * Last-known-good rates. Keep these conservative; they only matter when
 * the network is unreachable. Review roughly once a quarter.
 */
const FALLBACK_RATES: Record<FxCode, Record<FxCode, number>> = {
  USD: { USD: 1, INR: 83.5 },
  INR: { USD: 1 / 83.5, INR: 1 },
};

const FETCH_TIMEOUT_MS = 4000;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1h

interface CacheEntry {
  rate: number;
  expiresAt: number;
}

/**
 * Process-local cache. Survives across requests within a warm serverless
 * instance; repopulates on cold start. Totally fine at the current scale —
 * upgrade to a shared store only when we start seeing rate-limit hits.
 */
const rateCache = new Map<string, CacheEntry>();

interface ERApiResponse {
  result?: string;
  base_code?: string;
  rates?: Record<string, number>;
  time_last_update_unix?: number;
}

function cacheKey(from: FxCode, to: FxCode): string {
  return `${from}:${to}`;
}

/**
 * Resolve the exchange rate needed to convert an amount in `from`
 * currency into `to` currency. Always returns a positive finite number.
 */
export async function getExchangeRate(from: FxCode, to: FxCode): Promise<number> {
  if (from === to) return 1;

  const key = cacheKey(from, to);
  const now = Date.now();
  const hit = rateCache.get(key);
  if (hit && hit.expiresAt > now) return hit.rate;

  const fresh = await fetchRate(from, to);
  rateCache.set(key, { rate: fresh, expiresAt: now + CACHE_TTL_MS });
  return fresh;
}

/**
 * Convert `amount` from `from` to `to` and round to 2 decimals.
 */
export async function convertAmount(
  amount: number,
  from: FxCode,
  to: FxCode
): Promise<{ amount: number; rate: number }> {
  const rate = await getExchangeRate(from, to);
  const converted = Math.round(amount * rate * 100) / 100;
  return { amount: converted, rate };
}

async function fetchRate(from: FxCode, to: FxCode): Promise<number> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(`${API_URL}/${from}`, {
        signal: controller.signal,
        cache: "no-store",
      });
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      throw new Error(`FX HTTP ${res.status}`);
    }
    const data = (await res.json()) as ERApiResponse;
    if (data.result && data.result !== "success") {
      throw new Error(`FX result=${data.result}`);
    }
    const rate = data.rates?.[to];
    if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) {
      throw new Error(`FX missing ${to} in response`);
    }
    return rate;
  } catch (err) {
    console.warn("[fx] falling back to static rate", {
      from,
      to,
      err: err instanceof Error ? err.message : err,
    });
    return FALLBACK_RATES[from][to];
  }
}
