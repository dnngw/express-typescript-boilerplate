import type { UserRecord } from './user.repository';
import type { UserResponse } from './user.schema';

/** Converts a database record into the public API shape (explicit allow-list of fields). */
export function toUserResponse(user: UserRecord): UserResponse {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    isActive: user.isActive,
    roles: user.roles.map(({ role }) => ({ id: role.id, name: role.name })),
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}
