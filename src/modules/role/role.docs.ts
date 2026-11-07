import { z } from 'zod';

import { idParamsSchema } from '@/common/utils/validation';
import {
  errorResponses,
  jsonBody,
  noContentResponse,
  registry,
  secured,
  successResponse,
} from '@/docs/registry';

import {
  createRoleSchema,
  permissionResponseSchema,
  roleResponseSchema,
  updateRoleSchema,
} from './role.schema';

const tags = ['Roles & Permissions'];

registry.registerPath({
  method: 'get',
  path: '/roles',
  operationId: 'listRoles',
  tags,
  summary: 'List roles',
  description: 'Requires `role:read`.',
  security: secured,
  responses: { 200: successResponse(z.array(roleResponseSchema)), ...errorResponses(401, 403) },
});

registry.registerPath({
  method: 'post',
  path: '/roles',
  operationId: 'createRole',
  tags,
  summary: 'Create a role',
  description: 'Requires `role:create`. You can only grant permissions you hold yourself.',
  security: secured,
  request: { body: jsonBody(createRoleSchema.shape.body) },
  responses: {
    201: successResponse(roleResponseSchema, 'Role created'),
    ...errorResponses(401, 403, 409, 422),
  },
});

registry.registerPath({
  method: 'get',
  path: '/roles/{id}',
  operationId: 'getRole',
  tags,
  summary: 'Get a role',
  description: 'Requires `role:read`.',
  security: secured,
  request: { params: idParamsSchema },
  responses: { 200: successResponse(roleResponseSchema), ...errorResponses(401, 403, 404, 422) },
});

registry.registerPath({
  method: 'patch',
  path: '/roles/{id}',
  operationId: 'updateRole',
  tags,
  summary: 'Update a role',
  description: 'Requires `role:update`. `permissions` replaces the whole set.',
  security: secured,
  request: { params: idParamsSchema, body: jsonBody(updateRoleSchema.shape.body) },
  responses: {
    200: successResponse(roleResponseSchema),
    ...errorResponses(400, 401, 403, 404, 409, 422),
  },
});

registry.registerPath({
  method: 'delete',
  path: '/roles/{id}',
  operationId: 'deleteRole',
  tags,
  summary: 'Delete a role',
  description: 'Requires `role:delete`. System roles and roles still in use cannot be deleted.',
  security: secured,
  request: { params: idParamsSchema },
  responses: { 204: noContentResponse, ...errorResponses(400, 401, 403, 404, 409, 422) },
});

registry.registerPath({
  method: 'get',
  path: '/permissions',
  operationId: 'listPermissions',
  tags,
  summary: 'List every permission',
  description: 'Requires `role:read`.',
  security: secured,
  responses: {
    200: successResponse(z.array(permissionResponseSchema)),
    ...errorResponses(401, 403),
  },
});
