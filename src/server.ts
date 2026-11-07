import { createApp } from '@/app';
import { config } from '@/config';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';

const SHUTDOWN_TIMEOUT_MS = 10_000;

async function bootstrap(): Promise<void> {
  // Fail fast if the database is unreachable instead of failing on the first request.
  await prisma.$queryRaw`SELECT 1`;

  const app = createApp();
  const server = app.listen(config.server.port, config.server.host, () => {
    logger.info(
      `🚀 Server listening on http://${config.server.host}:${config.server.port} (${config.env})`,
    );
  });

  server.on('error', (error) => {
    logger.fatal({ err: error }, 'HTTP server error');
    process.exit(1);
  });

  let isShuttingDown = false;

  /** Stop accepting new connections, finish in-flight requests, then release resources. */
  const shutdown = (signal: NodeJS.Signals): void => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    logger.info({ signal }, 'Shutting down gracefully...');

    setTimeout(() => {
      logger.error('Graceful shutdown timed out, forcing exit');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS).unref();

    server.close((error) => {
      void prisma.$disconnect().finally(() => {
        logger.info('Shutdown complete');
        process.exit(error ? 1 : 0);
      });
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

process.on('unhandledRejection', (reason) => {
  logger.fatal({ err: reason }, 'Unhandled promise rejection');
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  logger.fatal({ err: error }, 'Uncaught exception');
  process.exit(1);
});

bootstrap().catch((error: unknown) => {
  logger.fatal({ err: error }, 'Failed to start server');
  process.exit(1);
});
