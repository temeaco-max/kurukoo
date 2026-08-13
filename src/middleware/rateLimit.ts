/**
 * Shared rate limiting — Blueprint / security audit priority #7.
 * In-memory per-instance buckets (move to Redis for multi-instance).
 */
import { Request, Response, NextFunction } from 'express';

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export interface RateLimitOptions {
  windowMs?: number;
  max?: number | (() => number);
  keyPrefix?: string;
  message?: string;
}

function clientKey(req: Request, prefix: string): string {
  const ip = String(req.ip || req.headers['x-forwarded-for'] || 'unknown')
    .split(',')[0]
    .trim();
  return `${prefix}:${ip}`;
}

export function createRateLimiter(options: RateLimitOptions = {}) {
  const windowMs = options.windowMs ?? 60_000;
  const max = typeof options.max === 'function' ? options.max : () => options.max ?? 60;
  const keyPrefix = options.keyPrefix ?? 'rl';
  const message = options.message ?? 'Too many requests';

  return function rateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
    const key = clientKey(req, keyPrefix);
    const limit = Math.max(1, Math.floor(Number(max()) || 1));
    const now = Date.now();
    let state = buckets.get(key);
    if (!state || state.resetAt <= now) {
      state = { count: 0, resetAt: now + windowMs };
      buckets.set(key, state);
    }
    state.count += 1;
    res.setHeader('X-RateLimit-Limit', String(limit));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, limit - state.count)));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(state.resetAt / 1000)));
    if (state.count > limit) {
      res.setHeader('Retry-After', String(Math.ceil((state.resetAt - now) / 1000)));
      res.status(429).json({ error: message });
      return;
    }
    next();
  };
}

/** Auth / OTP — strict */
export const authRateLimit = createRateLimiter({
  windowMs: 60_000,
  max: 20,
  keyPrefix: 'auth',
  message: 'Too many authentication attempts',
});

/** AI / streaming — cost discipline */
export const aiRateLimit = createRateLimiter({
  windowMs: 60_000,
  max: 30,
  keyPrefix: 'ai',
  message: 'AI rate limit reached — try again shortly',
});

/** Webhooks — absorb abuse without locking users out of chat */
export const webhookRateLimit = createRateLimiter({
  windowMs: 60_000,
  max: 300,
  keyPrefix: 'webhook',
  message: 'Webhook rate limit exceeded',
});

/** Payments / escrow mutations */
export const paymentRateLimit = createRateLimiter({
  windowMs: 60_000,
  max: 30,
  keyPrefix: 'pay',
  message: 'Payment rate limit exceeded',
});

// Periodic cleanup to avoid unbounded Map growth
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of buckets) {
    if (v.resetAt <= now) buckets.delete(k);
  }
}, 5 * 60_000).unref?.();
