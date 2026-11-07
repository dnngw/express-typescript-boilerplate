import { config } from '@/config';
import { prisma } from '@/lib/prisma';

import { seedRbac } from '../../prisma/seeders/rbac.seeder';

/** Refuse to wipe anything that doesn't look like a test database. */
function assertTestDatabase(): void {
  const databaseName = new URL(config.database.url).pathname.slice(1);
  if (!databaseName.includes('test')) {
    throw new Error(
      `Refusing to reset "${databaseName}": the test database name must contain "test".`,
    );
  }
}

/** Empties every table and re-seeds permissions and system roles. */
export async function resetDatabase(): Promise<void> {
  assertTestDatabase();

  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `;
  if (tables.length > 0) {
    const list = tables.map(({ tablename }) => `"public"."${tablename}"`).join(', ');
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} CASCADE`);
  }

  await seedRbac(prisma);
}
