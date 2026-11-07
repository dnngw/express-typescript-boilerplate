import type { RequestHandler } from 'express';

import { NotFoundError } from '@/common/errors';

export const notFoundHandler: RequestHandler = (req) => {
  throw new NotFoundError(`Route ${req.method} ${req.originalUrl} not found`);
};
