import type { Prisma, PrismaClient } from '@/generated/prisma/client';

/** Columns returned to the service layer. Never includes the password hash. */
export const userSelect = {
  id: true,
  email: true,
  name: true,
  isActive: true,
  tokenVersion: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  roles: {
    select: { role: { select: { id: true, name: true } } },
    orderBy: { assignedAt: 'asc' },
  },
} satisfies Prisma.UserSelect;

export type UserRecord = Prisma.UserGetPayload<{ select: typeof userSelect }>;
export type UserWithPassword = UserRecord & { passwordHash: string };

export interface CreateUserData {
  name: string;
  email: string;
  passwordHash: string;
  roleIds: string[];
  isActive?: boolean;
}

/**
 * Data access for users. Soft-deleted users (`deletedAt` set) are invisible to every query.
 */
export class UserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findById(id: string): Promise<UserRecord | null> {
    return this.prisma.user.findFirst({ where: { id, deletedAt: null }, select: userSelect });
  }

  /** Includes the password hash — only use it to verify credentials. */
  findByEmailWithPassword(email: string): Promise<UserWithPassword | null> {
    return this.prisma.user.findFirst({
      where: { email, deletedAt: null },
      select: { ...userSelect, passwordHash: true },
    });
  }

  /** Includes the password hash — only use it to verify credentials. */
  findByIdWithPassword(id: string): Promise<UserWithPassword | null> {
    return this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: { ...userSelect, passwordHash: true },
    });
  }

  /** Also matches soft-deleted users, because the email column is unique. */
  async existsByEmail(email: string): Promise<boolean> {
    return (await this.prisma.user.count({ where: { email } })) > 0;
  }

  create({ roleIds, ...data }: CreateUserData): Promise<UserRecord> {
    return this.prisma.user.create({
      data: { ...data, roles: { create: roleIds.map((roleId) => ({ roleId })) } },
      select: userSelect,
    });
  }

  async updateLastLoginAt(id: string): Promise<void> {
    await this.prisma.user.update({ where: { id }, data: { lastLoginAt: new Date() } });
  }

  /** Changes the password and invalidates every access token issued so far. */
  updatePassword(id: string, passwordHash: string): Promise<UserRecord> {
    return this.prisma.user.update({
      where: { id },
      data: { passwordHash, tokenVersion: { increment: 1 } },
      select: userSelect,
    });
  }

  /** Invalidates every access token issued so far. */
  async incrementTokenVersion(id: string): Promise<void> {
    await this.prisma.user.update({ where: { id }, data: { tokenVersion: { increment: 1 } } });
  }
}
