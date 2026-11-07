import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { ConflictError, ErrorCode, NotFoundError } from '@/common/errors';
import { Prisma } from '@/generated/prisma/client';

import { normalizeError } from './error-handler';

function prismaError(code: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('db error', { code, clientVersion: 'test' });
}

describe('normalizeError', () => {
  it('returns AppErrors unchanged', () => {
    const error = new NotFoundError('Nope');
    expect(normalizeError(error)).toBe(error);
  });

  it('maps ZodError to a 422 with field paths', () => {
    const result = z.object({ body: z.object({ email: z.email() }) }).safeParse({ body: {} });
    const error = normalizeError(result.error);

    expect(error.statusCode).toBe(422);
    expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
    expect(error.details).toEqual([{ path: 'body.email', message: expect.any(String) }]);
  });

  it('maps Prisma unique constraint violations to 409', () => {
    expect(normalizeError(prismaError('P2002'))).toBeInstanceOf(ConflictError);
  });

  it('maps Prisma "record not found" to 404', () => {
    expect(normalizeError(prismaError('P2025'))).toBeInstanceOf(NotFoundError);
  });

  it('hides unknown errors behind a generic 500', () => {
    const error = normalizeError(new Error('connection string with password leaked'));

    expect(error.statusCode).toBe(500);
    expect(error.message).toBe('Internal server error');
  });
});
