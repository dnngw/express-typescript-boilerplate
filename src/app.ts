import express, { type Express } from 'express';

import { errorHandler } from '@/common/middlewares/error-handler';
import { httpLogger } from '@/common/middlewares/http-logger';
import { notFoundHandler } from '@/common/middlewares/not-found';
import { config } from '@/config';
import { healthRouter } from '@/modules/health/health.module';
import { apiRouter } from '@/routes';

/**
 * Builds the Express application without starting the HTTP server,
 * so tests can use it directly with Supertest.
 */
export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', config.server.trustProxy);

  // Order matters: logging first, then body parsing, then routes, then error handling.
  app.use(httpLogger);
  app.use(express.json({ limit: '100kb' }));

  app.use('/health', healthRouter);
  app.use(config.server.apiPrefix, apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
