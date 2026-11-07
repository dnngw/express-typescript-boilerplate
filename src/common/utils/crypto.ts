import { createHash, randomBytes } from 'node:crypto';

/** Cryptographically secure random token, URL-safe. 48 bytes ≈ 384 bits of entropy. */
export function generateSecureToken(bytes = 48): string {
  return randomBytes(bytes).toString('base64url');
}

/**
 * Fast one-way hash for high-entropy secrets such as refresh tokens.
 * (Passwords are low-entropy and must use Argon2 instead — see lib/password.ts.)
 */
export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
