import { z } from 'zod';

import { PERMISSION_KEYS } from '@/common/constants/permissions';
import { idParamsSchema } from '@/common/utils/validation';

const roleNameField = z
  .string()
  .trim()
  .regex(/^[a-z][a-z0-9_]{1,49}$/, 'Must be 2-50 chars: lowercase letters, digits, underscores')
  .meta({ example: 'content_editor' });

const descriptionField = z.string().trim().max(255).nullable();

/** Only real permissions can be granted through the API — never the `*` wildcard. */
const permissionsField = z
  .array(z.enum(PERMISSION_KEYS))
  .transform((keys) => [...new Set(keys)])
  .meta({ example: ['user:read'] });

// ─── Requests ────────────────────────────────────────────────────────────────

export const createRoleSchema = z.object({
  body: z.object({
    name: roleNameField,
    description: descriptionField.optional(),
    permissions: permissionsField.default([]),
  }),
});

export const updateRoleSchema = z.object({
  params: idParamsSchema,
  body: z
    .object({
      name: roleNameField.optional(),
      description: descriptionField.optional(),
      permissions: permissionsField.optional(),
    })
    .refine((body) => Object.keys(body).length > 0, {
      error: 'At least one field must be provided',
    }),
});

export const roleIdSchema = z.object({ params: idParamsSchema });

export type CreateRoleInput = z.infer<typeof createRoleSchema>['body'];
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>['body'];

// ─── Responses ───────────────────────────────────────────────────────────────

export const roleResponseSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    description: z.string().nullable(),
    isSystem: z.boolean(),
    permissions: z.array(z.string()),
    userCount: z.number().int(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .meta({ id: 'Role' });

export const permissionResponseSchema = z
  .object({ key: z.string(), description: z.string().nullable() })
  .meta({ id: 'Permission' });

export type RoleResponse = z.infer<typeof roleResponseSchema>;
export type PermissionResponse = z.infer<typeof permissionResponseSchema>;
