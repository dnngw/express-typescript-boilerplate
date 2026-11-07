import { randomUUID } from 'node:crypto';

import { pinoHttp } from 'pino-http';

import { logger } from '@/lib/logger';

const REQUEST_ID_HEADER = 'x-request-id';
const VALID_REQUEST_ID = /^[\w-]{1,128}$/;

/**
 * Logs one line per request and attaches `req.log` (a child logger) and `req.id`.
 * The request id is taken from the incoming `X-Request-Id` header (so it can be traced across
 * services) or generated, and is echoed back in the response header.
 */
export const httpLogger = pinoHttp({
  logger,
  genReqId(req, res) {
    const incoming = req.headers[REQUEST_ID_HEADER];
    const id =
      typeof incoming === 'string' && VALID_REQUEST_ID.test(incoming) ? incoming : randomUUID();
    res.setHeader('X-Request-Id', id);
    return id;
  },
  customLogLevel(_req, res, error) {
    if (error || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  customSuccessMessage(req, res, responseTime) {
    return `${req.method ?? ''} ${req.url ?? ''} ${res.statusCode} - ${Math.round(responseTime)}ms`;
  },
  customErrorMessage(req, res) {
    return `${req.method ?? ''} ${req.url ?? ''} ${res.statusCode} - failed`;
  },
  serializers: {
    req: (req: { id: string; method: string; url: string; remoteAddress?: string }) => ({
      id: req.id,
      method: req.method,
      url: req.url,
      remoteAddress: req.remoteAddress,
    }),
    res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
  },
  autoLogging: {
    // Health checks are polled every few seconds by orchestrators — don't flood the logs.
    ignore: (req) => req.url?.startsWith('/health') ?? false,
  },
});
