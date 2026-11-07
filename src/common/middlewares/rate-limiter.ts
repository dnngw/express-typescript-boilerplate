import { rateLimit, type RateLimitRequestHandler } from 'express-rate-limit';

import { TooManyRequestsError } from '@/common/errors';
import { config } from '@/config';

interface RateLimiterOptions {
  windowMs: number;
  limit: number;
}

/**
 * Creates a rate limiter that responds with the standard error envelope.
 *
 * Note: the default store is in-memory, so limits are per process. When running several
 * instances, plug in a shared store such as `rate-limit-redis`.
 */
export function createRateLimiter({
  windowMs,
  limit,
}: RateLimiterOptions): RateLimitRequestHandler {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, _res, next) => {
      next(new TooManyRequestsError());
    },
  });
}

/** Applied to every API route. */
export const globalRateLimiter = createRateLimiter({
  windowMs: config.rateLimit.windowMs,
  limit: config.rateLimit.max,
});

/** Stricter limit for credential endpoints (login, register, ...) to slow down brute force. */
export const authRateLimiter = createRateLimiter({
  windowMs: config.rateLimit.windowMs,
  limit: config.rateLimit.authMax,
});
