import { describe, expect, it, vi } from 'vitest';

import type { AuthContextService, AuthUser } from '@/common/auth';
import { PERMISSIONS, WILDCARD_PERMISSION } from '@/common/constants/permissions';
import { BadRequestError, ForbiddenError } from '@/common/errors';
import type { PasswordHasher } from '@/lib/password';
import type { RoleRepository } from '@/modules/role/role.repository';

import type { UserRepository } from './user.repository';
import { UserService } from './user.service';

const admin: AuthUser = {
  id: 'admin-1',
  email: 'admin@example.com',
  name: 'Admin',
  roles: ['admin'],
  permissions: new Set([PERMISSIONS.USER_UPDATE, PERMISSIONS.USER_DELETE, PERMISSIONS.ROLE_ASSIGN]),
};

function setup({ allowMultipleRoles = true } = {}) {
  const users = { findById: vi.fn().mockResolvedValue({ id: 'target' }), softDelete: vi.fn() };
  const roles = { findManyByIds: vi.fn() };
  const authContext = { get: vi.fn(), invalidate: vi.fn() };

  const service = new UserService(
    users as unknown as UserRepository,
    roles as unknown as RoleRepository,
    authContext as unknown as AuthContextService,
    {} as PasswordHasher,
    { allowMultipleRoles },
  );
  return { service, users, roles, authContext };
}

describe('UserService', () => {
  it('prevents users from deleting themselves', async () => {
    const { service } = setup();
    await expect(service.delete(admin, admin.id)).rejects.toThrow(BadRequestError);
  });

  it('prevents managing a user with more permissions (privilege escalation)', async () => {
    const { service, authContext, users } = setup();
    authContext.get.mockResolvedValue({ permissions: [WILDCARD_PERMISSION] });

    await expect(service.delete(admin, 'super-admin')).rejects.toThrow(ForbiddenError);
    expect(users.softDelete).not.toHaveBeenCalled();
  });

  it('rejects several roles when multiple roles are disabled', async () => {
    const { service, authContext } = setup({ allowMultipleRoles: false });
    authContext.get.mockResolvedValue({ permissions: [] });

    await expect(service.assignRoles(admin, 'target', ['role-a', 'role-b'])).rejects.toThrow(
      'A user must have exactly one role',
    );
  });

  it('rejects assigning a role with permissions the actor does not hold', async () => {
    const { service, authContext, roles } = setup();
    authContext.get.mockResolvedValue({ permissions: [] });
    roles.findManyByIds.mockResolvedValue([
      { permissions: [{ permission: { key: WILDCARD_PERMISSION } }] },
    ]);

    await expect(service.assignRoles(admin, 'target', ['super-admin-role'])).rejects.toThrow(
      ForbiddenError,
    );
  });
});
