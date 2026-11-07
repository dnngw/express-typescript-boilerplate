import type { RequestHandler } from 'express';

import { type PermissionKey, WILDCARD_PERMISSION } from '@/common/constants/permissions';
import { ForbiddenError } from '@/common/errors';

import { getAuthUser } from './authenticate';
import type { AuthUser } from './auth.types';

type PermissionHolder = Pick<AuthUser, 'permissions'>;

export function hasPermission(user: PermissionHolder, permission: string): boolean {
  return user.permissions.has(WILDCARD_PERMISSION) || user.permissions.has(permission);
}

/**
 * Route guard: requires the authenticated user to hold **all** listed permissions.
 * Must be placed after `authenticate`.
 *
 * @example
 *   router.delete('/:id', authenticate, authorize(PERMISSIONS.USER_DELETE), controller.remove);
 */
export function authorize(...required: PermissionKey[]): RequestHandler {
  return (req, _res, next) => {
    const user = getAuthUser(req);
    if (!required.every((permission) => hasPermission(user, permission))) {
      throw new ForbiddenError();
    }
    next();
  };
}

/**
 * Prevents privilege escalation: a user may only grant — or manage someone who holds —
 * permissions they hold themselves. E.g. an admin can't create a role with `*` or edit a
 * super admin.
 */
export function assertHoldsPermissions(
  actor: PermissionHolder,
  permissions: Iterable<string>,
  message = 'You cannot manage permissions you do not have',
): void {
  const missing = [...permissions].filter((permission) => !hasPermission(actor, permission));
  if (missing.length > 0) throw new ForbiddenError(`${message}: ${missing.join(', ')}`);
}
