import dotenv from 'dotenv';
import { defineConfig } from 'prisma/config';

// Mirror src/config/env.ts: `NODE_ENV=test npx prisma ...` targets the test database.
dotenv.config({
  path: process.env.NODE_ENV === 'test' ? '.env.test' : '.env',
  quiet: true,
});

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // Read lazily so `prisma generate` also works where no database is configured (e.g. Docker build).
    url: process.env.DATABASE_URL,
  },
});
