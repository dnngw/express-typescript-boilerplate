import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';

import { errorHandler } from '@/common/middlewares/error-handler';
import { httpLogger } from '@/common/middlewares/http-logger';
import { notFoundHandler } from '@/common/middlewares/not-found';
import { globalRateLimiter } from '@/common/middlewares/rate-limiter';
import { config } from '@/config';
import { buildOpenApiDocument } from '@/docs/openapi';
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

  // Order matters: logging → security → body parsing → routes → error handling.
  app.use(httpLogger);
  app.use(helmet());
  app.use(
    cors({
      origin: config.server.corsOrigins.includes('*') ? '*' : config.server.corsOrigins,
      exposedHeaders: ['X-Request-Id', 'RateLimit', 'RateLimit-Policy', 'Retry-After'],
    }),
  );
  app.use(express.json({ limit: '100kb' }));

  app.use('/health', healthRouter);

  if (config.docs.enabled) {
    const document = buildOpenApiDocument();
    app.get('/docs/openapi.json', (_req, res) => {
      res.json(document);
    });
    app.use('/docs', swaggerUi.serve, swaggerUi.setup(document, { customSiteTitle: 'API Docs' }));
  }

  app.use(config.server.apiPrefix, globalRateLimiter, apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
