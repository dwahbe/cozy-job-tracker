import { Ratelimit } from '@upstash/ratelimit';
import type { Duration } from '@upstash/ratelimit';
import { NextResponse } from 'next/server';
import { redis } from '@/lib/redis';

export type LimitKind = 'parse' | 'signin' | 'sheet';

// A slow Redis shouldn't take parsing or sign-in down with it: after this long the
// limiter lets the request through.
const TIMEOUT_MS = 2000;

interface Limiter {
  limiter: Ratelimit;
  /** Shown to the user when this window is the one that blocks. */
  message: string;
}

function slidingWindow(name: string, tokens: number, window: Duration, message: string): Limiter {
  return {
    limiter: new Ratelimit({
      redis,
      prefix: `rl:${name}`,
      limiter: Ratelimit.slidingWindow(tokens, window),
      timeout: TIMEOUT_MS,
    }),
    message,
  };
}

// Generous to start; tune after a week of watching the 429 logs. Windows are checked in order
// and the first one that blocks wins, so a burst-blocked request doesn't also spend a daily token.
const LIMITERS: Record<LimitKind, Limiter[]> = {
  // Per user — every parse is a page fetch plus an OpenAI call. The burst window covers a full
  // bulk import (MAX_BULK_JOBS URLs in one go, one parse each) with room for the single form.
  parse: [
    slidingWindow(
      'parse',
      60,
      '10 m',
      "You've hit the parsing limit for now — try again in a few minutes, or add the job manually."
    ),
    slidingWindow(
      'parse-day',
      300,
      '1 d',
      "You've hit today's parsing limit — try again tomorrow, or add the job manually."
    ),
  ],
  // Per client IP — every sign-in request sends a magic-link email.
  signin: [
    slidingWindow(
      'signin',
      10,
      '1 h',
      'Too many sign-in attempts from this network — try again in a little while.'
    ),
  ],
  // Per user — Google Sheet imports.
  sheet: [
    slidingWindow(
      'sheet',
      10,
      '10 m',
      'Too many imports in a row — wait a few minutes and try again.'
    ),
  ],
};

export type LimitVerdict = { ok: true } | { ok: false; retryAfter: number; message: string };

/**
 * Check `key` (a user id or client IP) against the limiters for `kind`.
 * Fails open: if Redis errors out the request is allowed and the error logged.
 */
export async function checkLimit(kind: LimitKind, key: string): Promise<LimitVerdict> {
  try {
    for (const { limiter, message } of LIMITERS[kind]) {
      const result = await limiter.limit(key);
      if (result.success) continue;
      const retryAfter = Math.max(1, Math.ceil((result.reset - Date.now()) / 1000));
      console.warn(`[ratelimit] ${kind} limit hit`, { key, retryAfter });
      return { ok: false, retryAfter, message };
    }
    return { ok: true };
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
