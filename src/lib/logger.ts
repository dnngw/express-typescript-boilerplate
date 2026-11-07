import { pino } from 'pino';

import { config } from '@/config';

/**
 * Application-wide structured logger.
 * - Development: human-readable output via pino-pretty.
 * - Production: JSON lines, ready for log aggregators (Loki, ELK, Datadog, ...).
 */
export const logger = pino({
  level: config.log.level,
  base: { env: config.env },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
      '*.password',
      '*.currentPassword',
      '*.newPassword',
      '*.refreshToken',
      '*.accessToken',
    ],
    censor: '[REDACTED]',
  },
  ...(config.isDevelopment && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:HH:MM:ss.l',
        ignore: 'pid,hostname,env',
      },
    },
  }),
});

export type Logger = typeof logger;
