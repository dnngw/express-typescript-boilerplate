import argon2 from 'argon2';

/**
 * Password hashing with Argon2id — the algorithm recommended by OWASP.
 * Exposed as an object so services can receive it via dependency injection (and mock it in tests).
 */
export const passwordHasher = {
  hash(plain: string): Promise<string> {
    return argon2.hash(plain, { type: argon2.argon2id });
  },

  async verify(hash: string, plain: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plain);
    } catch {
      // Malformed hash — treat as a mismatch instead of crashing the request.
      return false;
    }
  },
};

export type PasswordHasher = typeof passwordHasher;
