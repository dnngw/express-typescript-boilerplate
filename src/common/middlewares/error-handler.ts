import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';

import {
  AppError,
  BadRequestError,
  ConflictError,
  ErrorCode,
  InternalServerError,
  NotFoundError,
  ValidationError,
} from '@/common/errors';
import { Prisma } from '@/generated/prisma/client';

interface ErrorBody {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId?: string;
  };
}

/** Errors thrown by Express' body parser (invalid JSON, body too large, ...). */
interface BodyParserError extends Error {
  type: string;
  status: number;
}

function isBodyParserError(error: unknown): error is BodyParserError {
  return error instanceof Error && 'type' in error && 'status' in error;
}

/**
 * Converts anything that was thrown into an `AppError`.
 * Unknown errors become a generic 500 so internal details never leak to clients.
 */
export function normalizeError(error: unknown): AppError {
  if (error instanceof AppError) return error;

  if (error instanceof ZodError) {
    return new ValidationError(
      error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
    );
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    // https://www.prisma.io/docs/orm/reference/error-reference
    if (error.code === 'P2002') return new ConflictError();
    if (error.code === 'P2025') return new NotFoundError();
  }

  if (isBodyParserError(error)) {
    if (error.type === 'entity.parse.failed') return new BadRequestError('Malformed JSON body');
    if (error.type === 'entity.too.large') {
      return new AppError(413, ErrorCode.PAYLOAD_TOO_LARGE, 'Request body is too large');
    }
    if (error.status < 500) return new BadRequestError(error.message);
  }

  return new InternalServerError();
}

/**
 * Global error handler — must be registered after every route.
 * Express 5 forwards errors thrown in async handlers here automatically.
 */
export const errorHandler: ErrorRequestHandler = (error: unknown, req, res, _next) => {
  const appError = normalizeError(error);

  // Attach the original error so pino-http logs it (once) together with the request line.
  if (appError.statusCode >= 500 && error instanceof Error) {
    res.err = error;
  }

  const body: ErrorBody = {
    success: false,
    error: {
      code: appError.code,
      message: appError.message,
      ...(appError.details !== undefined && { details: appError.details }),
      ...(typeof req.id === 'string' && { requestId: req.id }),
    },
  };

  res.status(appError.statusCode).json(body);
};
