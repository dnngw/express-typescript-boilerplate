import { z } from 'zod';

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

// Response shapes — what the API returns.

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
