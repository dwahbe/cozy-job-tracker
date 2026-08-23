import { Ratelimit } from '@upstash/ratelimit';
import type { Duration } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { NextResponse } from 'next/server';

// One client for the limiters. Phase 4a replaces this with the shared lib/redis.ts client.
const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

export type LimitKind = 'parse' | 'signin' | 'sheet';

// A slow Redis shouldn't take parsing or sign-in down with it: after this long the
// limiter lets the request through.
const TIMEOUT_MS = 2000;

function slidingWindow(name: string, tokens: number, window: Duration): Ratelimit {
  return new Ratelimit({
    redis,
    prefix: `rl:${name}`,
    limiter: Ratelimit.slidingWindow(tokens, window),
    timeout: TIMEOUT_MS,
  });
}

// Generous to start; tune after a week of watching the 429 logs.
const LIMITERS: Record<LimitKind, Ratelimit[]> = {
  // Per user — every parse is a page fetch plus an OpenAI call. Burst window + daily cap.
  parse: [slidingWindow('parse', 30, '10 m'), slidingWindow('parse-day', 300, '1 d')],
  // Per client IP — every sign-in request sends a magic-link email.
  signin: [slidingWindow('signin', 10, '1 h')],
  // Per user — Google Sheet imports.
  sheet: [slidingWindow('sheet', 10, '10 m')],
};

const MESSAGES: Record<LimitKind, string> = {
  parse:
    "You've hit the parsing limit for now — try again in a few minutes, or add the job manually.",
  signin: 'Too many sign-in attempts from this network — try again in a little while.',
  sheet: 'Too many imports in a row — wait a few minutes and try again.',
};

export type LimitVerdict = { ok: true } | { ok: false; retryAfter: number; message: string };

/**
 * Check `key` (a user id or client IP) against the limiters for `kind`.
 * Fails open: if Redis errors out the request is allowed and the error logged.
 */
export async function checkLimit(kind: LimitKind, key: string): Promise<LimitVerdict> {
  try {
    const results = await Promise.all(LIMITERS[kind].map((limiter) => limiter.limit(key)));
    const blocked = results.filter((result) => !result.success);
    if (blocked.length === 0) return { ok: true };

    const reset = Math.max(...blocked.map((result) => result.reset));
    const retryAfter = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
    console.warn(`[ratelimit] ${kind} limit hit`, { key, retryAfter });
    return { ok: false, retryAfter, message: MESSAGES[kind] };
  } catch (error) {
    console.error(`[ratelimit] ${kind} check failed, allowing request:`, error);
    return { ok: true };
  }
}

/** A 429 response (with Retry-After) when `key` is over the limit for `kind`, otherwise null. */
export async function limited(kind: LimitKind, key: string): Promise<NextResponse | null> {
  const verdict = await checkLimit(kind, key);
  if (verdict.ok) return null;
  return NextResponse.json(
    { error: verdict.message, retryAfter: verdict.retryAfter },
    { status: 429, headers: { 'Retry-After': String(verdict.retryAfter) } }
  );
}

/** Client IP for per-IP limits: first x-forwarded-for hop (set by Vercel), else x-real-ip. */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const first = forwarded?.split(',')[0].trim();
  if (first) return first;
  return request.headers.get('x-real-ip')?.trim() || 'unknown';
}
