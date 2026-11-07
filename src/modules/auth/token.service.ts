import { signAccessToken } from '@/common/auth';
import { UnauthorizedError } from '@/common/errors';
import { generateSecureToken, sha256 } from '@/common/utils/crypto';

import type { RefreshTokenRepository } from './refresh-token.repository';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  /** Access token lifetime in seconds. */
  expiresIn: number;
}

/** Metadata stored with each session, useful for a "active sessions" screen or audits. */
export interface ClientInfo {
  userAgent?: string | undefined;
  ipAddress?: string | undefined;
}

export type ConsumeResult =
  | { status: 'valid'; userId: string }
  /** An already-used token was presented again: it was most likely stolen. */
  | { status: 'reused'; userId: string };

export interface TokenServiceOptions {
  accessTokenTtlSeconds: number;
  refreshTokenTtlDays: number;
}

/**
 * Issues token pairs and implements refresh token rotation:
 * every refresh token can be used exactly once and is replaced by a new one.
 */
export class TokenService {
  constructor(
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly options: TokenServiceOptions,
  ) {}

  async issue(user: { id: string; tokenVersion: number }, client: ClientInfo): Promise<AuthTokens> {
    const accessToken = signAccessToken({ sub: user.id, tv: user.tokenVersion });

    // The refresh token is an opaque random string; only its hash is stored, so a database
    // leak doesn't expose usable tokens.
    const refreshToken = generateSecureToken();
    await this.refreshTokens.create({
      userId: user.id,
      tokenHash: sha256(refreshToken),
      expiresAt: new Date(Date.now() + this.options.refreshTokenTtlDays * DAY_MS),
      userAgent: client.userAgent,
      ipAddress: client.ipAddress,
    });

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: this.options.accessTokenTtlSeconds,
    };
  }

  /** Validates a refresh token and marks it as used. */
  async consume(rawToken: string): Promise<ConsumeResult> {
    const token = await this.refreshTokens.findByHash(sha256(rawToken));
    if (!token) throw new UnauthorizedError('Invalid refresh token');

    if (token.revokedAt) return { status: 'reused', userId: token.userId };
    if (token.expiresAt <= new Date()) throw new UnauthorizedError('Refresh token has expired');

    const revoked = await this.refreshTokens.revoke(token.id);
    if (!revoked) return { status: 'reused', userId: token.userId };

    return { status: 'valid', userId: token.userId };
  }

  /** Logout of one session. Idempotent: unknown or already revoked tokens are ignored. */
  async revoke(rawToken: string): Promise<void> {
    const token = await this.refreshTokens.findByHash(sha256(rawToken));
    if (token && !token.revokedAt) await this.refreshTokens.revoke(token.id);
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.refreshTokens.revokeAllForUser(userId);
  }
}
