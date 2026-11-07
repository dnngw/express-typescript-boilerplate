import { prisma } from '@/lib/prisma';

import { HealthController } from './health.controller';
import { createHealthRouter } from './health.routes';
import { HealthService } from './health.service';

// Composition root of the module: build the dependency graph once and expose the router.
const healthService = new HealthService(prisma);
const healthController = new HealthController(healthService);

export const healthRouter = createHealthRouter(healthController);
