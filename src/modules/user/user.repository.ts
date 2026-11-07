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

export interface FindUsersParams {
  skip: number;
  take: number;
  search?: string | undefined;
  roleName?: string | undefined;
  isActive?: boolean | undefined;
  sortBy: 'createdAt' | 'name' | 'email';
  sortOrder: 'asc' | 'desc';
}

export interface UpdateUserData {
  name?: string | undefined;
  isActive?: boolean | undefined;
}

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

  async findMany(params: FindUsersParams): Promise<{ items: UserRecord[]; total: number }> {
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(params.search && {
        OR: [
          { name: { contains: params.search, mode: 'insensitive' } },
          { email: { contains: params.search, mode: 'insensitive' } },
        ],
      }),
      ...(params.roleName && { roles: { some: { role: { name: params.roleName } } } }),
      ...(params.isActive !== undefined && { isActive: params.isActive }),
    };

    // Run both queries in one transaction so `total` matches `items`.
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: userSelect,
        skip: params.skip,
        take: params.take,
        orderBy: [{ [params.sortBy]: params.sortOrder }, { id: 'asc' }],
      }),
      this.prisma.user.count({ where }),
    ]);

    return { items, total };
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

  update(id: string, data: UpdateUserData): Promise<UserRecord> {
    return this.prisma.user.update({ where: { id }, data, select: userSelect });
  }

  /** Replaces every role of the user with the given ones. */
  replaceRoles(id: string, roleIds: string[]): Promise<UserRecord> {
    return this.prisma.user.update({
      where: { id },
      data: { roles: { deleteMany: {}, create: roleIds.map((roleId) => ({ roleId })) } },
      select: userSelect,
    });
  }

  /**
   * Soft delete: the row is kept (audit trail, foreign keys) but hidden from every query.
   * Bumping the token version kills existing access tokens; refresh tokens stop working
   * because refreshing looks the user up by id, which now finds nothing.
   */
  async softDelete(id: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false, tokenVersion: { increment: 1 } },
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
