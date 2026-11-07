import { idParamsSchema } from '@/common/utils/validation';
import {
  errorResponses,
  jsonBody,
  noContentResponse,
  paginatedResponse,
  registry,
  secured,
  successResponse,
} from '@/docs/registry';

import {
  assignRolesSchema,
  createUserSchema,
  listUsersSchema,
  updateUserSchema,
  userResponseSchema,
} from './user.schema';

const tags = ['Users'];

registry.registerPath({
  method: 'get',
  path: '/users',
  operationId: 'listUsers',
  tags,
  summary: 'List users',
  description: 'Requires `user:read`.',
  security: secured,
  request: { query: listUsersSchema.shape.query },
  responses: {
    200: paginatedResponse(userResponseSchema),
    ...errorResponses(401, 403, 422),
  },
});

registry.registerPath({
  method: 'post',
  path: '/users',
  operationId: 'createUser',
  tags,
  summary: 'Create a user',
  description: 'Requires `user:create` (and `role:assign` when `roleIds` is given).',
  security: secured,
  request: { body: jsonBody(createUserSchema.shape.body) },
  responses: {
    201: successResponse(userResponseSchema, 'User created'),
    ...errorResponses(400, 401, 403, 409, 422),
  },
});

registry.registerPath({
  method: 'get',
  path: '/users/{id}',
  operationId: 'getUser',
  tags,
  summary: 'Get a user',
  description: 'Users can always read themselves; reading others requires `user:read`.',
  security: secured,
  request: { params: idParamsSchema },
  responses: {
    200: successResponse(userResponseSchema),
    ...errorResponses(401, 403, 404, 422),
  },
});

registry.registerPath({
  method: 'patch',
  path: '/users/{id}',
  operationId: 'updateUser',
  tags,
  summary: 'Update a user',
  description: 'Users can rename themselves. Updating others or `isActive` requires `user:update`.',
  security: secured,
  request: { params: idParamsSchema, body: jsonBody(updateUserSchema.shape.body) },
  responses: {
    200: successResponse(userResponseSchema),
    ...errorResponses(400, 401, 403, 404, 422),
  },
});

registry.registerPath({
  method: 'delete',
  path: '/users/{id}',
  operationId: 'deleteUser',
  tags,
  summary: 'Delete a user (soft delete)',
  description: 'Requires `user:delete`.',
  security: secured,
  request: { params: idParamsSchema },
  responses: { 204: noContentResponse, ...errorResponses(400, 401, 403, 404, 422) },
});

registry.registerPath({
  method: 'put',
  path: '/users/{id}/roles',
  operationId: 'assignUserRoles',
  tags,
  summary: "Replace a user's roles",
  description:
    'Requires `role:assign`. You can only assign roles whose permissions you hold yourself.',
  security: secured,
  request: { params: idParamsSchema, body: jsonBody(assignRolesSchema.shape.body) },
  responses: {
    200: successResponse(userResponseSchema),
    ...errorResponses(400, 401, 403, 404, 422),
  },
});
