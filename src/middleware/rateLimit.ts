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

/** Authenticated public-content mutations; Topic uses this shared in-process limiter. */
export const topicMutationRateLimit = createRateLimiter({
  windowMs: 60_000,
  max: 18,
  keyPrefix: 'topic-mutation',
  message: 'Too many Topic changes — try again shortly',
});

/** Topic reports are intentionally stricter to protect the private moderation queue. */
export const topicReportRateLimit = createRateLimiter({
  windowMs: 60_000,
  max: 6,
  keyPrefix: 'topic-report',
  message: 'Too many Topic reports — try again shortly',
});

/** Payments / escrow mutations */
export const paymentRateLimit = createRateLimiter({
  windowMs: 60_000,
  max: 30,
  keyPrefix: 'pay',
  message: 'Payment rate limit exceeded',
});

/** Authenticated binary uploads are intentionally bounded to protect local pilot storage. */
export const attachmentUploadRateLimit = createRateLimiter({
  windowMs: 60_000,
  max: 6,
  keyPrefix: 'chat-attachment',
  message: 'Too many attachment uploads — try again shortly',
});

// Periodic cleanup to avoid unbounded Map growth
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of buckets) {
    if (v.resetAt <= now) buckets.delete(k);
  }
}, 5 * 60_000).unref?.();

/** Device-token churn is bounded to protect owner notification routing and local pilot storage. */
export const fcmDeviceRegistrationRateLimit = createRateLimiter({
  windowMs: 60_000,
  max: 10,
  keyPrefix: 'fcm-device-registration',
  message: 'Too many device registration attempts — try again shortly',
});
