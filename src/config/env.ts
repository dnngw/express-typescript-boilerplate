import dotenv from 'dotenv';
import { z } from 'zod';

// Load `.env.test` when running tests, `.env` otherwise.
// Variables that already exist in the environment are never overwritten (e.g. in CI or Docker).
dotenv.config({
  path: process.env.NODE_ENV === 'test' ? '.env.test' : '.env',
  quiet: true,
});

/** Accepts a comma-separated list, e.g. "http://localhost:5173,https://app.example.com". */
const commaSeparated = z.string().transform((value) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean),
);

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // Server
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  API_PREFIX: z.string().startsWith('/').default('/api/v1'),
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  CORS_ORIGINS: commaSeparated.default(['*']),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  API_DOCS_ENABLED: z.stringbool().default(true),

  // Infrastructure
  DATABASE_URL: z.url(),
  REDIS_URL: z.url().optional(),

  // Authentication
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  JWT_ISSUER: z.string().default('express-typescript-boilerplate'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),

  // Authorization
  RBAC_ALLOW_MULTIPLE_ROLES: z.stringbool().default(true),
  RBAC_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(300),

  // Rate limiting
  RATE_LIMIT_WINDOW_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(15 * 60 * 1000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),
});

export type Env = z.infer<typeof envSchema>;

function parseEnv(): Env {
  // Treat empty values (e.g. `REDIS_URL=`) as "not set" so defaults and optionals apply.
  const definedVariables = Object.fromEntries(
    Object.entries(process.env).filter(([, value]) => value !== undefined && value !== ''),
  );
  const result = envSchema.safeParse(definedVariables);

  if (!result.success) {
    // The logger depends on this config, so we fail fast with a plain message instead.
    process.stderr.write(`❌ Invalid environment variables:\n${z.prettifyError(result.error)}\n`);
    process.exit(1);
  }

  return result.data;
}

export const env = parseEnv();
