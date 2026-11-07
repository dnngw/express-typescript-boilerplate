import jwt from 'jsonwebtoken';
import { z } from 'zod';

import { UnauthorizedError } from '@/common/errors';
import { config } from '@/config';

const ALGORITHM = 'HS256';

export interface AccessTokenPayload {
  /** User id. */
  sub: string;
  /** User's token version at the time of issuing. A mismatch means the token was revoked. */
  tv: number;
}

const payloadSchema = z.object({
  sub: z.string().min(1),
  tv: z.number().int().nonnegative(),
});

export function signAccessToken({ sub, tv }: AccessTokenPayload): string {
  return jwt.sign({ tv }, config.auth.accessTokenSecret, {
    algorithm: ALGORITHM,
    subject: sub,
    issuer: config.auth.issuer,
    expiresIn: config.auth.accessTokenTtlSeconds,
  });
}

/** Verifies signature, expiry, and issuer. Throws `UnauthorizedError` on any problem. */
export function verifyAccessToken(token: string): AccessTokenPayload {
  let decoded: unknown;
  try {
    // Pin the algorithm to prevent "alg: none" / algorithm confusion attacks.
    decoded = jwt.verify(token, config.auth.accessTokenSecret, {
      algorithms: [ALGORITHM],
      issuer: config.auth.issuer,
    });
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new UnauthorizedError('Access token has expired');
    }
    throw new UnauthorizedError('Invalid access token');
  }

  const result = payloadSchema.safeParse(decoded);
  if (!result.success) throw new UnauthorizedError('Invalid access token');
  return result.data;
}

/** Extracts the token from an `Authorization: Bearer <token>` header. */
export function extractBearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : null;
}
