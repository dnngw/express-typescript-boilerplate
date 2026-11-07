import { z } from 'zod';

import { paginationQuerySchema } from '@/common/utils/pagination';
import { idParamsSchema } from '@/common/utils/validation';

// Reusable field rules — shared by the auth and user modules.

export const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .pipe(z.email({ error: 'Must be a valid email address' }))
  .meta({ example: 'jane@example.com' });

export const passwordField = z
  .string()
  .min(8, 'Must be at least 8 characters')
  .max(128, 'Must be at most 128 characters')
  .regex(/[a-zA-Z]/, 'Must contain at least one letter')
  .regex(/\d/, 'Must contain at least one number')
  .meta({ example: 'Str0ngPassw0rd' });

export const nameField = z.string().trim().min(1).max(100).meta({ example: 'Jane Doe' });

const roleIdsField = z
  .array(z.uuid())
  .min(1, 'At least one role is required')
  .transform((ids) => [...new Set(ids)]);

// ─── Requests ────────────────────────────────────────────────────────────────

export const listUsersSchema = z.object({
  query: paginationQuerySchema.extend({
    search: z.string().trim().min(1).max(100).optional(),
    role: z.string().trim().min(1).optional().meta({ description: 'Filter by role name' }),
    isActive: z.stringbool().optional(),
    sortBy: z.enum(['createdAt', 'name', 'email']).default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  }),
});

export const createUserSchema = z.object({
  body: z.object({
    name: nameField,
    email: emailField,
    password: passwordField,
    isActive: z.boolean().default(true),
    roleIds: roleIdsField
      .optional()
      .meta({ description: 'Requires `role:assign`. Defaults to the default role.' }),
  }),
});

export const updateUserSchema = z.object({
  params: idParamsSchema,
  body: z
    .object({
      name: nameField.optional(),
      isActive: z.boolean().optional().meta({ description: 'Requires `user:update`' }),
    })
    .refine((body) => Object.keys(body).length > 0, {
      error: 'At least one field must be provided',
    }),
});

export const assignRolesSchema = z.object({
  params: idParamsSchema,
  body: z.object({ roleIds: roleIdsField }),
});

export const userIdSchema = z.object({ params: idParamsSchema });

export type ListUsersQuery = z.infer<typeof listUsersSchema>['query'];
export type CreateUserInput = z.infer<typeof createUserSchema>['body'];
export type UpdateUserInput = z.infer<typeof updateUserSchema>['body'];

// ─── Responses ───────────────────────────────────────────────────────────────

export const userResponseSchema = z
  .object({
    id: z.uuid(),
    email: z.email(),
    name: z.string(),
    isActive: z.boolean(),
    roles: z.array(z.object({ id: z.uuid(), name: z.string() })),
    lastLoginAt: z.iso.datetime().nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .meta({ id: 'User' });

export type UserResponse = z.infer<typeof userResponseSchema>;
