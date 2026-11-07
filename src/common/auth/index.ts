import { config } from '@/config';
import { cache } from '@/lib/cache';
import { prisma } from '@/lib/prisma';

import { AuthContextService } from './auth-context.service';
import { createAuthenticate } from './authenticate';

export const authContextService = new AuthContextService(
  prisma,
  cache,
  config.rbac.cacheTtlSeconds,
);

/** Requires a valid access token. Populates `req.user`. */
export const authenticate = createAuthenticate(authContextService);

export { getAuthUser } from './authenticate';
export { signAccessToken } from './access-token';
export type { AuthContextService } from './auth-context.service';
export type { AuthContext, AuthUser } from './auth.types';
