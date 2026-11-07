import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';

import { PERMISSIONS, WILDCARD_PERMISSION } from '@/common/constants/permissions';
import { ForbiddenError, UnauthorizedError } from '@/common/errors';

import type { AuthUser } from './auth.types';
import { assertHoldsPermissions, authorize, hasPermission } from './authorize';

function makeUser(permissions: string[]): AuthUser {
  return { id: 'u1', email: 'u@x.com', name: 'U', roles: [], permissions: new Set(permissions) };
}

function run(middleware: ReturnType<typeof authorize>, user?: AuthUser): NextFunction {
  const next = vi.fn();
  middleware({ user } as Request, {} as Response, next);
  return next;
}

describe('hasPermission', () => {
  it('returns true when the user holds the permission', () => {
    expect(hasPermission(makeUser([PERMISSIONS.USER_READ]), PERMISSIONS.USER_READ)).toBe(true);
  });

  it('returns false when the user lacks the permission', () => {
    expect(hasPermission(makeUser([PERMISSIONS.USER_READ]), PERMISSIONS.USER_DELETE)).toBe(false);
  });

  it('treats the wildcard as every permission', () => {
    expect(hasPermission(makeUser([WILDCARD_PERMISSION]), PERMISSIONS.ROLE_DELETE)).toBe(true);
  });
});

describe('authorize', () => {
  it('calls next when every required permission is held', () => {
    const user = makeUser([PERMISSIONS.USER_READ, PERMISSIONS.USER_UPDATE]);
    const next = run(authorize(PERMISSIONS.USER_READ, PERMISSIONS.USER_UPDATE), user);
    expect(next).toHaveBeenCalledOnce();
  });

  it('throws ForbiddenError when one permission is missing', () => {
    const user = makeUser([PERMISSIONS.USER_READ]);
    expect(() => run(authorize(PERMISSIONS.USER_READ, PERMISSIONS.USER_DELETE), user)).toThrow(
      ForbiddenError,
    );
  });

  it('throws UnauthorizedError when there is no authenticated user', () => {
    expect(() => run(authorize(PERMISSIONS.USER_READ))).toThrow(UnauthorizedError);
  });
});

describe('assertHoldsPermissions', () => {
  it('lists the missing permissions in the error message', () => {
    const actor = makeUser([PERMISSIONS.USER_READ]);
    expect(() => {
      assertHoldsPermissions(actor, [PERMISSIONS.USER_READ, WILDCARD_PERMISSION], 'Nope');
    }).toThrow('Nope: *');
  });

  it('passes for an empty permission list', () => {
    expect(() => {
      assertHoldsPermissions(makeUser([]), []);
    }).not.toThrow();
  });
});
