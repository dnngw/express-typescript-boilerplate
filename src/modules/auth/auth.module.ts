import { authContextService } from '@/common/auth';
import { config } from '@/config';
import { passwordHasher } from '@/lib/password';
import { prisma } from '@/lib/prisma';
import { RoleRepository } from '@/modules/role/role.repository';
import { UserRepository } from '@/modules/user/user.repository';

import { AuthController } from './auth.controller';
import { createAuthRouter } from './auth.routes';
import { AuthService } from './auth.service';
import { RefreshTokenRepository } from './refresh-token.repository';
import { TokenService } from './token.service';

const tokenService = new TokenService(new RefreshTokenRepository(prisma), {
  accessTokenTtlSeconds: config.auth.accessTokenTtlSeconds,
  refreshTokenTtlDays: config.auth.refreshTokenTtlDays,
});

const authService = new AuthService(
  new UserRepository(prisma),
  new RoleRepository(prisma),
  tokenService,
  authContextService,
  passwordHasher,
);

export const authRouter = createAuthRouter(new AuthController(authService));
