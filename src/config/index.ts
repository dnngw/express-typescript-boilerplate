import { env } from './env';

/**
 * Typed, grouped application configuration.
 * Always import from here instead of reading `process.env` directly.
 */
export const config = {
  env: env.NODE_ENV,
  isProduction: env.NODE_ENV === 'production',
  isDevelopment: env.NODE_ENV === 'development',
  isTest: env.NODE_ENV === 'test',

  server: {
    host: env.HOST,
    port: env.PORT,
    apiPrefix: env.API_PREFIX,
    trustProxy: env.TRUST_PROXY,
    corsOrigins: env.CORS_ORIGINS,
  },

  log: {
    level: env.LOG_LEVEL,
  },

  docs: {
    enabled: env.API_DOCS_ENABLED,
  },

  database: {
    url: env.DATABASE_URL,
  },

  redis: {
    url: env.REDIS_URL,
  },

  auth: {
    accessTokenSecret: env.JWT_ACCESS_SECRET,
    accessTokenTtlSeconds: env.JWT_ACCESS_TTL_SECONDS,
    issuer: env.JWT_ISSUER,
    refreshTokenTtlDays: env.REFRESH_TOKEN_TTL_DAYS,
  },

  rbac: {
    allowMultipleRoles: env.RBAC_ALLOW_MULTIPLE_ROLES,
    cacheTtlSeconds: env.RBAC_CACHE_TTL_SECONDS,
  },

  rateLimit: {
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_MAX,
    authMax: env.AUTH_RATE_LIMIT_MAX,
  },
} as const;

export type AppConfig = typeof config;
