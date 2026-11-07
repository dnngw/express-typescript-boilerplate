import { AppError, ErrorCode } from './app-error';

export interface ValidationIssue {
  /** Dot-notation path of the invalid field, e.g. `body.email`. */
  path: string;
  message: string;
}

export class BadRequestError extends AppError {
  constructor(message = 'Bad request', details?: unknown) {
    super(400, ErrorCode.BAD_REQUEST, message, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(401, ErrorCode.UNAUTHORIZED, message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission to perform this action') {
    super(403, ErrorCode.FORBIDDEN, message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(404, ErrorCode.NOT_FOUND, message);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource already exists') {
    super(409, ErrorCode.CONFLICT, message);
  }
}

export class ValidationError extends AppError {
  declare readonly details: ValidationIssue[];

  constructor(issues: ValidationIssue[], message = 'Validation failed') {
    super(422, ErrorCode.VALIDATION_ERROR, message, issues);
  }
}

export class InternalServerError extends AppError {
  constructor(message = 'Internal server error') {
    super(500, ErrorCode.INTERNAL_SERVER_ERROR, message);
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message = 'Too many requests, please try again later') {
    super(429, ErrorCode.TOO_MANY_REQUESTS, message);
  }
}
