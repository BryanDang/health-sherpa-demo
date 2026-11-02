/**
 * Fixed-window request limit per client address. Applied only when
 * BACKEND_MODE=live, where a request can reach a paid API.
 * In memory, so it holds per server process only.
 */

import type { NextRequest } from 'next/server';

const WINDOW_MS = 60_000;
const MAX_REQUESTS = Number(process.env.LIVE_RATE_LIMIT_PER_MINUTE) || 20;
const hits = new Map<string, { count: number; resetAt: number }>();

export function overLimit(request: NextRequest): boolean {
  if (process.env.BACKEND_MODE !== 'live') return false;
  const client =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  const now = Date.now();
  const entry = hits.get(client);
  if (!entry || entry.resetAt <= now) {
    if (hits.size > 5000) hits.clear();
    hits.set(client, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_REQUESTS;
}
