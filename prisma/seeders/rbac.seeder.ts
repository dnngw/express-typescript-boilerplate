import {
  PERMISSION_DESCRIPTIONS,
  PERMISSION_KEYS,
  WILDCARD_PERMISSION,
} from '@/common/constants/permissions';
import { SYSTEM_ROLE_DEFINITIONS } from '@/common/constants/roles';
import type { PrismaClient } from '@/generated/prisma/client';

/**
 * Syncs permissions and system roles. Safe to run multiple times (idempotent).
 */
export async function seedRbac(prisma: PrismaClient): Promise<void> {
  const permissions = [
    { key: WILDCARD_PERMISSION, description: 'All permissions' },
    ...PERMISSION_KEYS.map((key) => ({ key, description: PERMISSION_DESCRIPTIONS[key] })),
  ];

  for (const permission of permissions) {
    await prisma.permission.upsert({
      where: { key: permission.key },
      update: { description: permission.description },
      create: permission,
    });
  }

  for (const role of SYSTEM_ROLE_DEFINITIONS) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: { description: role.description, isSystem: true },
      create: {
        name: role.name,
        description: role.description,
        isSystem: true,
        permissions: {
          create: role.permissions.map((key) => ({ permission: { connect: { key } } })),
        },
      },
    });
  }
}
