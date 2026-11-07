import type { Request, RequestHandler } from 'express';

import { UnauthorizedError } from '@/common/errors';

import { extractBearerToken, verifyAccessToken } from './access-token';
import type { AuthContextService } from './auth-context.service';
import type { AuthUser } from './auth.types';

/**
 * Verifies the access token and loads the user's auth context into `req.user`.
 * Rejects tokens of deleted/deactivated users and tokens revoked via `tokenVersion`.
 */
export function createAuthenticate(authContextService: AuthContextService): RequestHandler {
  return async (req, _res, next) => {
    const token = extractBearerToken(req.headers.authorization);
    if (!token) throw new UnauthorizedError('Missing access token');

    const payload = verifyAccessToken(token);
    const context = await authContextService.get(payload.sub);

    if (!context?.isActive || context.tokenVersion !== payload.tv) {
      throw new UnauthorizedError('Invalid or revoked access token');
    }

    req.user = {
      id: context.id,
      email: context.email,
      name: context.name,
      roles: context.roles,
      permissions: new Set(context.permissions),
    };
    next();
  };
}

/** Returns `req.user` in handlers placed behind `authenticate`. */
export function getAuthUser(req: Request): AuthUser {
  if (!req.user) throw new UnauthorizedError();
  return req.user;
}
