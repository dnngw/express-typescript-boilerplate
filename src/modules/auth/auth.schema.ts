import { z } from 'zod';

import {
  emailField,
  nameField,
  passwordField,
  userResponseSchema,
} from '@/modules/user/user.schema';

// ─── Requests ────────────────────────────────────────────────────────────────

export const registerSchema = z.object({
  body: z.object({
    name: nameField,
    email: emailField,
    password: passwordField,
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: emailField,
    // Don't validate the password policy on login: it only matters when setting a password.
    password: z.string().min(1, 'Password is required').max(128),
  }),
});

export const refreshTokenSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1, 'Refresh token is required'),
  }),
});

export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1, 'Current password is required').max(128),
    newPassword: passwordField,
  }),
});

export type RegisterInput = z.infer<typeof registerSchema>['body'];
export type LoginInput = z.infer<typeof loginSchema>['body'];
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>['body'];

// ─── Responses ───────────────────────────────────────────────────────────────

export const authTokensSchema = z
  .object({
    accessToken: z.string(),
    refreshToken: z.string(),
    tokenType: z.literal('Bearer'),
    expiresIn: z.number().int().meta({ description: 'Access token lifetime in seconds' }),
  })
  .meta({ id: 'AuthTokens' });

export const authResultSchema = z
  .object({ user: userResponseSchema, tokens: authTokensSchema })
  .meta({ id: 'AuthResult' });

export const currentUserSchema = userResponseSchema
  .extend({ permissions: z.array(z.string()) })
  .meta({ id: 'CurrentUser' });

export type AuthResult = z.infer<typeof authResultSchema>;
export type CurrentUser = z.infer<typeof currentUserSchema>;
