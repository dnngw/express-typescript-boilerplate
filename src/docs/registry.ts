import { OpenAPIRegistry, type ResponseConfig } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

/**
 * Central OpenAPI registry. Each module registers its endpoints in its own `*.docs.ts`,
 * reusing the same Zod schemas used for validation — so the docs can't drift from the code.
 */
export const registry = new OpenAPIRegistry();

export const bearerAuth = registry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
});

/** Shorthand for `security` on protected endpoints. */
export const secured = [{ [bearerAuth.name]: [] }];

const errorResponseSchema = z
  .object({
    success: z.literal(false),
    error: z.object({
      code: z.string().meta({ example: 'VALIDATION_ERROR' }),
      message: z.string(),
      details: z.unknown().optional(),
      requestId: z.string().optional(),
    }),
  })
  .meta({ id: 'ErrorResponse' });

const paginationMetaSchema = z
  .object({
    page: z.number().int(),
    limit: z.number().int(),
    total: z.number().int(),
    totalPages: z.number().int(),
  })
  .meta({ id: 'PaginationMeta' });

export function jsonBody(schema: z.ZodType): {
  content: { 'application/json': { schema: z.ZodType } };
} {
  return { content: { 'application/json': { schema } } };
}

export function successResponse(schema: z.ZodType, description = 'Success'): ResponseConfig {
  return jsonResponse(description, z.object({ success: z.literal(true), data: schema }));
}

export function paginatedResponse(itemSchema: z.ZodType, description = 'Success'): ResponseConfig {
  return jsonResponse(
    description,
    z.object({ success: z.literal(true), data: z.array(itemSchema), meta: paginationMetaSchema }),
  );
}

export const noContentResponse: ResponseConfig = { description: 'No content' };

const ERROR_DESCRIPTIONS = {
  400: 'Bad request',
  401: 'Missing, invalid, or expired access token',
  403: 'Not enough permissions',
  404: 'Resource not found',
  409: 'Conflict with an existing resource',
  422: 'Validation failed',
  429: 'Too many requests',
} as const;

type ErrorStatus = keyof typeof ERROR_DESCRIPTIONS;

export function errorResponses(...statuses: ErrorStatus[]): Record<number, ResponseConfig> {
  return Object.fromEntries(
    statuses.map((status) => [
      status,
      jsonResponse(ERROR_DESCRIPTIONS[status], errorResponseSchema),
    ]),
  );
}

function jsonResponse(description: string, schema: z.ZodType): ResponseConfig {
  return { description, content: { 'application/json': { schema } } };
}
