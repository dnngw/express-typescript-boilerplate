import type { Prisma, PrismaClient } from '@/generated/prisma/client';

export const roleSelect = {
  id: true,
  name: true,
  description: true,
  isSystem: true,
  createdAt: true,
  updatedAt: true,
  permissions: {
    select: { permission: { select: { key: true } } },
    orderBy: { permission: { key: 'asc' } },
  },
  _count: { select: { users: true } },
} satisfies Prisma.RoleSelect;

export type RoleRecord = Prisma.RoleGetPayload<{ select: typeof roleSelect }>;

export interface CreateRoleData {
  name: string;
  description?: string | null | undefined;
  permissionKeys: string[];
}

export interface UpdateRoleData {
  name?: string | undefined;
  description?: string | null | undefined;
  permissionKeys?: string[] | undefined;
}

const connectPermissions = (keys: string[]) =>
  keys.map((key) => ({ permission: { connect: { key } } }));

export class RoleRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findMany(): Promise<RoleRecord[]> {
    return this.prisma.role.findMany({ select: roleSelect, orderBy: { createdAt: 'asc' } });
  }

  findById(id: string): Promise<RoleRecord | null> {
    return this.prisma.role.findUnique({ where: { id }, select: roleSelect });
  }

  findManyByIds(ids: string[]): Promise<RoleRecord[]> {
    return this.prisma.role.findMany({ where: { id: { in: ids } }, select: roleSelect });
  }

  findByName(name: string): Promise<RoleRecord | null> {
    return this.prisma.role.findUnique({ where: { name }, select: roleSelect });
  }

  create({ name, description, permissionKeys }: CreateRoleData): Promise<RoleRecord> {
    return this.prisma.role.create({
      data: { name, description, permissions: { create: connectPermissions(permissionKeys) } },
      select: roleSelect,
    });
  }

  update(id: string, { name, description, permissionKeys }: UpdateRoleData): Promise<RoleRecord> {
    return this.prisma.role.update({
      where: { id },
      data: {
        name,
        description,
        // Replace the whole permission set: delete the old links, then create the new ones.
        ...(permissionKeys && {
          permissions: { deleteMany: {}, create: connectPermissions(permissionKeys) },
        }),
      },
      select: roleSelect,
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.role.delete({ where: { id } });
  }

  findAllPermissions(): Promise<{ key: string; description: string | null }[]> {
    return this.prisma.permission.findMany({
      select: { key: true, description: true },
      orderBy: { key: 'asc' },
    });
  }
}
