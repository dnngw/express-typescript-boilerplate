import { authContextService } from '@/common/auth';
import { prisma } from '@/lib/prisma';

import { RoleController } from './role.controller';
import { RoleRepository } from './role.repository';
import { createPermissionRouter, createRoleRouter } from './role.routes';
import { RoleService } from './role.service';

const roleService = new RoleService(new RoleRepository(prisma), authContextService);
const roleController = new RoleController(roleService);

export const roleRouter = createRoleRouter(roleController);
export const permissionRouter = createPermissionRouter(roleController);
