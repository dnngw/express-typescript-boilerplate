import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthContextService } from '@/common/auth';
import { BadRequestError, ForbiddenError, UnauthorizedError } from '@/common/errors';
import type { RoleRepository } from '@/modules/role/role.repository';
import type { UserRepository, UserWithPassword } from '@/modules/user/user.repository';

import { AuthService } from './auth.service';
import type { AuthTokens, TokenService } from './token.service';

const tokens: AuthTokens = {
  accessToken: 'access',
  refreshToken: 'refresh',
  tokenType: 'Bearer',
  expiresIn: 900,
};

const user: UserWithPassword = {
  id: 'user-1',
  email: 'jane@example.com',
  name: 'Jane',
  isActive: true,
  tokenVersion: 0,
  lastLoginAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  roles: [],
  passwordHash: 'stored-hash',
};

function setup() {
  const users = {
    findByEmailWithPassword: vi.fn(),
    findByIdWithPassword: vi.fn(),
    findById: vi.fn(),
    updateLastLoginAt: vi.fn(),
    updatePassword: vi.fn(),
    incrementTokenVersion: vi.fn(),
  };
  const tokenService = {
    issue: vi.fn().mockResolvedValue(tokens),
    consume: vi.fn(),
    revokeAllForUser: vi.fn(),
  };
  const authContext = { invalidate: vi.fn(), get: vi.fn() };
  const passwordHasher = {
    hash: vi.fn().mockResolvedValue('new-hash'),
    verify: vi.fn(),
  };

  const service = new AuthService(
    users as unknown as UserRepository,
    {} as RoleRepository,
    tokenService as unknown as TokenService,
    authContext as unknown as AuthContextService,
    passwordHasher,
  );

  return { service, users, tokenService, authContext, passwordHasher };
}

describe('AuthService', () => {
  let ctx: ReturnType<typeof setup>;

  beforeEach(() => {
    ctx = setup();
  });

  describe('login', () => {
    it('returns tokens for valid credentials', async () => {
      ctx.users.findByEmailWithPassword.mockResolvedValue(user);
      ctx.passwordHasher.verify.mockResolvedValue(true);

      const result = await ctx.service.login({ email: user.email, password: 'x' }, {});

      expect(result.tokens).toEqual(tokens);
      expect(result.user).not.toHaveProperty('passwordHash');
      expect(ctx.users.updateLastLoginAt).toHaveBeenCalledWith(user.id);
    });

    it('still verifies a hash for unknown emails (timing-attack protection)', async () => {
      ctx.users.findByEmailWithPassword.mockResolvedValue(null);
      ctx.passwordHasher.verify.mockResolvedValue(false);

      await expect(ctx.service.login({ email: 'nobody@x.com', password: 'x' }, {})).rejects.toThrow(
        UnauthorizedError,
      );
      expect(ctx.passwordHasher.verify).toHaveBeenCalledOnce();
    });

    it('rejects deactivated accounts with 403 only after a correct password', async () => {
      ctx.users.findByEmailWithPassword.mockResolvedValue({ ...user, isActive: false });
      ctx.passwordHasher.verify.mockResolvedValue(true);

      await expect(ctx.service.login({ email: user.email, password: 'x' }, {})).rejects.toThrow(
        ForbiddenError,
      );
      expect(ctx.tokenService.issue).not.toHaveBeenCalled();
    });
  });

  describe('refresh', () => {
    it('revokes every session when a refresh token is reused', async () => {
      ctx.tokenService.consume.mockResolvedValue({ status: 'reused', userId: user.id });

      await expect(ctx.service.refresh('stolen', {})).rejects.toThrow(/reuse detected/);
      expect(ctx.tokenService.revokeAllForUser).toHaveBeenCalledWith(user.id);
      expect(ctx.users.incrementTokenVersion).toHaveBeenCalledWith(user.id);
      expect(ctx.authContext.invalidate).toHaveBeenCalledWith(user.id);
    });

    it('rejects refresh for a deactivated user', async () => {
      ctx.tokenService.consume.mockResolvedValue({ status: 'valid', userId: user.id });
      ctx.users.findById.mockResolvedValue({ ...user, isActive: false });

      await expect(ctx.service.refresh('token', {})).rejects.toThrow(UnauthorizedError);
    });
  });

  describe('changePassword', () => {
    it('rejects an incorrect current password', async () => {
      ctx.users.findByIdWithPassword.mockResolvedValue(user);
      ctx.passwordHasher.verify.mockResolvedValue(false);

      await expect(
        ctx.service.changePassword(user.id, { currentPassword: 'a', newPassword: 'b' }, {}),
      ).rejects.toThrow(BadRequestError);
    });

    it('rejects reusing the current password', async () => {
      ctx.users.findByIdWithPassword.mockResolvedValue(user);
      ctx.passwordHasher.verify.mockResolvedValue(true);

      await expect(
        ctx.service.changePassword(user.id, { currentPassword: 'same1', newPassword: 'same1' }, {}),
      ).rejects.toThrow(/must be different/);
    });

    it('revokes other sessions and issues new tokens', async () => {
      ctx.users.findByIdWithPassword.mockResolvedValue(user);
      ctx.passwordHasher.verify.mockResolvedValue(true);
      ctx.users.updatePassword.mockResolvedValue({ ...user, tokenVersion: 1 });

      const result = await ctx.service.changePassword(
        user.id,
        { currentPassword: 'old1', newPassword: 'new1' },
        {},
      );

      expect(ctx.users.updatePassword).toHaveBeenCalledWith(user.id, 'new-hash');
      expect(ctx.tokenService.revokeAllForUser).toHaveBeenCalledWith(user.id);
      expect(ctx.tokenService.issue).toHaveBeenCalledWith(
        expect.objectContaining({ tokenVersion: 1 }),
        {},
      );
      expect(result).toEqual(tokens);
    });
  });
});
