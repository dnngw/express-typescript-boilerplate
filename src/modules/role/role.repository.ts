import type { PrismaClient } from '@/generated/prisma/client';

export class RoleRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findByName(name: string): Promise<{ id: string; name: string } | null> {
    return this.prisma.role.findUnique({ where: { name }, select: { id: true, name: true } });
  }
}
