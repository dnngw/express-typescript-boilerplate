import { PrismaPg } from '@prisma/adapter-pg';

import { config } from '@/config';
import { PrismaClient } from '@/generated/prisma/client';

import { logger } from './logger';

const adapter = new PrismaPg({ connectionString: config.database.url });

/**
 * Single shared Prisma client for the whole process.
 * Inject it into repositories instead of importing it everywhere, so it can be mocked in tests.
 */
export const prisma = new PrismaClient({
  adapter,
  log: [
    { emit: 'event', level: 'warn' },
    { emit: 'event', level: 'error' },
  ],
});

prisma.$on('warn', (event) => {
  logger.warn({ target: event.target }, event.message);
});
prisma.$on('error', (event) => {
  logger.error({ target: event.target }, event.message);
});

export type { PrismaClient };
