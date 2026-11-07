import type { Request } from 'express';
import { z } from 'zod';

/**
 * Validates the parts of a request against a schema shaped like `{ body?, query?, params? }`
 * and returns fully typed data. Throws a `ZodError` (→ 422 response) when invalid.
 *
 * @example
 *   const getUserSchema = z.object({ params: z.object({ id: z.uuid() }) });
 *   const { params } = parseRequest(getUserSchema, req); // params.id is a string
 */
export function parseRequest<TSchema extends z.ZodType>(
  schema: TSchema,
  req: Request,
): z.output<TSchema> {
  return schema.parse({ body: req.body as unknown, query: req.query, params: req.params });
}

/** Reusable `:id` route param. */
export const idParamsSchema = z.object({
  id: z.uuid({ error: 'Must be a valid UUID' }),
});
