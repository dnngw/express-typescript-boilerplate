import {
  errorResponses,
  jsonBody,
  noContentResponse,
  registry,
  secured,
  successResponse,
} from '@/docs/registry';

import {
  authResultSchema,
  authTokensSchema,
  changePasswordSchema,
  currentUserSchema,
  loginSchema,
  refreshTokenSchema,
  registerSchema,
} from './auth.schema';

const tags = ['Auth'];

registry.registerPath({
  method: 'post',
  path: '/auth/register',
  operationId: 'register',
  tags,
  security: [],
  summary: 'Register a new account',
  request: { body: jsonBody(registerSchema.shape.body) },
  responses: {
    201: successResponse(authResultSchema, 'Account created'),
    ...errorResponses(409, 422, 429),
  },
});

registry.registerPath({
  method: 'post',
  path: '/auth/login',
  operationId: 'login',
  tags,
  security: [],
  summary: 'Log in with email and password',
  request: { body: jsonBody(loginSchema.shape.body) },
  responses: {
    200: successResponse(authResultSchema),
    ...errorResponses(401, 403, 422, 429),
  },
});

registry.registerPath({
  method: 'post',
  path: '/auth/refresh',
  operationId: 'refreshTokens',
  tags,
  security: [],
  summary: 'Get a new token pair',
  description:
    'Refresh tokens are single-use. Reusing one revokes every session of the user (theft detection).',
  request: { body: jsonBody(refreshTokenSchema.shape.body) },
  responses: {
    200: successResponse(authTokensSchema),
    ...errorResponses(401, 422),
  },
});

registry.registerPath({
  method: 'post',
  path: '/auth/logout',
  operationId: 'logout',
  tags,
  security: [],
  summary: 'Log out of the current session',
  request: { body: jsonBody(refreshTokenSchema.shape.body) },
  responses: { 204: noContentResponse, ...errorResponses(422) },
});

registry.registerPath({
  method: 'post',
  path: '/auth/logout-all',
  operationId: 'logoutAll',
  tags,
  summary: 'Log out of every session on every device',
  security: secured,
  responses: { 204: noContentResponse, ...errorResponses(401) },
});

registry.registerPath({
  method: 'get',
  path: '/auth/me',
  operationId: 'getCurrentUser',
  tags,
  summary: 'Get the current user with their effective permissions',
  security: secured,
  responses: { 200: successResponse(currentUserSchema), ...errorResponses(401) },
});

registry.registerPath({
  method: 'post',
  path: '/auth/change-password',
  operationId: 'changePassword',
  tags,
  summary: 'Change password',
  description: 'Signs out every other session and returns a fresh token pair.',
  security: secured,
  request: { body: jsonBody(changePasswordSchema.shape.body) },
  responses: {
    200: successResponse(authTokensSchema),
    ...errorResponses(400, 401, 422, 429),
  },
});
