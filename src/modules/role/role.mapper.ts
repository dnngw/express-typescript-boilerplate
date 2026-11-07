import type { RoleRecord } from './role.repository';
import type { RoleResponse } from './role.schema';

export function getRolePermissionKeys(role: RoleRecord): string[] {
  return role.permissions.map(({ permission }) => permission.key);
}

export function toRoleResponse(role: RoleRecord): RoleResponse {
  return {
    id: role.id,
    name: role.name,
    description: role.description,
    isSystem: role.isSystem,
    permissions: getRolePermissionKeys(role),
    userCount: role._count.users,
    createdAt: role.createdAt.toISOString(),
    updatedAt: role.updatedAt.toISOString(),
  };
}
