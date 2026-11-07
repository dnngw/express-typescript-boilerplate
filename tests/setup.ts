import { afterAll, beforeEach } from 'vitest';

import { prisma } from '@/lib/prisma';

import { resetDatabase } from './helpers/database';

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});
