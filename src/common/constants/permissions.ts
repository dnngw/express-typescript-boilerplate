/**
 * Single source of truth for every permission in the system.
 *
 * Format: `resource:action`. Code checks permissions — never role names — so roles can be
 * created or changed at runtime without touching the code. Run `npm run db:seed` after adding
 * a new permission to store it in the database.
 */
export const PERMISSIONS = {
  USER_READ: 'user:read',
  USER_CREATE: 'user:create',
  USER_UPDATE: 'user:update',
  USER_DELETE: 'user:delete',

  ROLE_READ: 'role:read',
  ROLE_CREATE: 'role:create',
  ROLE_UPDATE: 'role:update',
  ROLE_DELETE: 'role:delete',
  ROLE_ASSIGN: 'role:assign',
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/** Grants every permission. Only assigned to the `super_admin` role by the seeder. */
export const WILDCARD_PERMISSION = '*';

export const PERMISSION_KEYS = Object.values(PERMISSIONS) as [PermissionKey, ...PermissionKey[]];

export const PERMISSION_DESCRIPTIONS: Record<PermissionKey, string> = {
  [PERMISSIONS.USER_READ]: 'View users',
  [PERMISSIONS.USER_CREATE]: 'Create users',
  [PERMISSIONS.USER_UPDATE]: 'Update any user',
  [PERMISSIONS.USER_DELETE]: 'Delete users',
  [PERMISSIONS.ROLE_READ]: 'View roles and permissions',
  [PERMISSIONS.ROLE_CREATE]: 'Create roles',
  [PERMISSIONS.ROLE_UPDATE]: 'Update roles',
  [PERMISSIONS.ROLE_DELETE]: 'Delete roles',
  [PERMISSIONS.ROLE_ASSIGN]: 'Assign roles to users',
};
