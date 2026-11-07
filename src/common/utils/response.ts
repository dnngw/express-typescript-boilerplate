import type { Response } from 'express';

import type { PaginationMeta } from './pagination';

/**
 * Every successful response has the same envelope:
 *   { "success": true, "data": ..., "meta"?: ... }
 *
 * Errors use { "success": false, "error": { ... } } — see the error handler middleware.
 */
export interface SuccessBody<T> {
  success: true;
  data: T;
  meta?: PaginationMeta;
}

export function ok(res: Response, data: unknown, meta?: PaginationMeta): void {
  const body: SuccessBody<unknown> = meta ? { success: true, data, meta } : { success: true, data };
  res.status(200).json(body);
}

export function created(res: Response, data: unknown): void {
  res.status(201).json({ success: true, data } satisfies SuccessBody<unknown>);
}

export function noContent(res: Response): void {
  res.status(204).end();
}
