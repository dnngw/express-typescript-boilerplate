import { authContextService } from '@/common/auth';
import { config } from '@/config';
import { passwordHasher } from '@/lib/password';
import { prisma } from '@/lib/prisma';
import { RoleRepository } from '@/modules/role/role.repository';

import { UserController } from './user.controller';
import { UserRepository } from './user.repository';
import { createUserRouter } from './user.routes';
import { UserService } from './user.service';

const userService = new UserService(
  new UserRepository(prisma),
  new RoleRepository(prisma),
  authContextService,
  passwordHasher,
  { allowMultipleRoles: config.rbac.allowMultipleRoles },
);

export const userRouter = createUserRouter(new UserController(userService));
