import type { CacheStore } from '@/lib/cache';
import type { PrismaClient } from '@/lib/prisma';

import type { AuthContext } from './auth.types';

const cacheKey = (userId: string): string => `auth:context:${userId}`;

/**
 * Loads a user's roles and effective permissions (union of all their roles) and caches them.
 *
 * The access token only carries the user id, so permission changes take effect immediately —
 * as long as every change calls `invalidate()` / `invalidateByRole()`.
 */
export class AuthContextService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly cache: CacheStore,
    private readonly ttlSeconds: number,
  ) {}

  /** Returns `null` when the user doesn't exist or was deleted. */
  async get(userId: string): Promise<AuthContext | null> {
    const cached = await this.cache.get<AuthContext>(cacheKey(userId));
    if (cached) return cached;

    const context = await this.load(userId);
    if (context) await this.cache.set(cacheKey(userId), context, this.ttlSeconds);
    return context;
  }

  async invalidate(...userIds: string[]): Promise<void> {
    await this.cache.delete(...userIds.map(cacheKey));
  }

  /** Call after changing a role's permissions: every user holding the role is affected. */
  async invalidateByRole(roleId: string): Promise<void> {
    const assignments = await this.prisma.userRole.findMany({
      where: { roleId },
      select: { userId: true },
    });
    await this.invalidate(...assignments.map((assignment) => assignment.userId));
  }

  private async load(userId: string): Promise<AuthContext | null> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: {
        id: true,
        email: true,
        name: true,
        isActive: true,
        tokenVersion: true,
        roles: {
          select: {
            role: {
              select: {
                name: true,
                permissions: { select: { permission: { select: { key: true } } } },
              },
            },
          },
        },
      },
    });
    if (!user) return null;

    const roles = user.roles.map(({ role }) => role.name);
    const permissions = new Set(
      user.roles.flatMap(({ role }) => role.permissions.map(({ permission }) => permission.key)),
    );

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      isActive: user.isActive,
      tokenVersion: user.tokenVersion,
      roles,
      permissions: [...permissions].sort(),
    };
  }
}
