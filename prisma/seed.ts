import { z } from 'zod';

import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';

import { seedRbac } from './seeders/rbac.seeder';
import { seedSuperAdmin } from './seeders/super-admin.seeder';

const seedEnvSchema = z.object({
  SEED_SUPER_ADMIN_NAME: z.string().min(1).default('Super Admin'),
  SEED_SUPER_ADMIN_EMAIL: z.email().optional(),
  SEED_SUPER_ADMIN_PASSWORD: z.string().min(8).optional(),
});

async function main(): Promise<void> {
  const env = seedEnvSchema.parse(process.env);

  await seedRbac(prisma);
  logger.info('Permissions and system roles synced');

  if (!env.SEED_SUPER_ADMIN_EMAIL || !env.SEED_SUPER_ADMIN_PASSWORD) {
    logger.warn(
      'SEED_SUPER_ADMIN_EMAIL / SEED_SUPER_ADMIN_PASSWORD not set — skipping super admin',
    );
    return;
  }

  const created = await seedSuperAdmin(prisma, {
    name: env.SEED_SUPER_ADMIN_NAME,
    email: env.SEED_SUPER_ADMIN_EMAIL,
    password: env.SEED_SUPER_ADMIN_PASSWORD,
  });
  logger.info(
    { email: env.SEED_SUPER_ADMIN_EMAIL },
    created ? 'Super admin created' : 'Super admin already exists',
  );
}

main()
  .catch((error: unknown) => {
    logger.error({ err: error }, 'Seeding failed');
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
