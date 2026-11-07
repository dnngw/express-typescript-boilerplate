import { PERMISSIONS, WILDCARD_PERMISSION } from './permissions';

/** Roles created by the seeder. They can't be renamed or deleted through the API. */
export const SYSTEM_ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  USER: 'user',
} as const;

export type SystemRoleName = (typeof SYSTEM_ROLES)[keyof typeof SYSTEM_ROLES];

/** Role given to every self-registered user. */
export const DEFAULT_ROLE: SystemRoleName = SYSTEM_ROLES.USER;

export interface SystemRoleDefinition {
  name: SystemRoleName;
  description: string;
  permissions: readonly string[];
}

/**
 * Initial permissions of each system role. Only applied when the role is first created,
 * so changes made later through the API are not overwritten by re-running the seeder.
 */
export const SYSTEM_ROLE_DEFINITIONS: readonly SystemRoleDefinition[] = [
  {
    name: SYSTEM_ROLES.SUPER_ADMIN,
    description: 'Full access to everything',
    permissions: [WILDCARD_PERMISSION],
  },
  {
    name: SYSTEM_ROLES.ADMIN,
    description: 'Manage users and view roles',
    permissions: [
      PERMISSIONS.USER_READ,
      PERMISSIONS.USER_CREATE,
      PERMISSIONS.USER_UPDATE,
      PERMISSIONS.USER_DELETE,
      PERMISSIONS.ROLE_READ,
      PERMISSIONS.ROLE_ASSIGN,
    ],
  },
  {
    name: SYSTEM_ROLES.USER,
    description: 'Regular user, can only manage their own account',
    permissions: [],
  },
];
