import { SYSTEM_ROLES } from '@/common/constants/roles';
import type { PrismaClient } from '@/generated/prisma/client';
import { passwordHasher } from '@/lib/password';

export interface SuperAdminSeedInput {
  name: string;
  email: string;
  password: string;
}

/**
 * Creates the initial super admin account if it doesn't exist yet.
 * Returns `false` when the account already existed.
 */
export async function seedSuperAdmin(
  prisma: PrismaClient,
  input: SuperAdminSeedInput,
): Promise<boolean> {
  const email = input.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return false;

  const role = await prisma.role.findUniqueOrThrow({ where: { name: SYSTEM_ROLES.SUPER_ADMIN } });

  await prisma.user.create({
    data: {
      name: input.name,
      email,
      passwordHash: await passwordHasher.hash(input.password),
      roles: { create: { roleId: role.id } },
    },
  });

  return true;
}
