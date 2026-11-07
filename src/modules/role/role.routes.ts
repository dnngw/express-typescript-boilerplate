import { Router } from 'express';

import { authenticate, authorize } from '@/common/auth';
import { PERMISSIONS } from '@/common/constants/permissions';

import type { RoleController } from './role.controller';

export function createRoleRouter(controller: RoleController): Router {
  const router = Router();
  router.use(authenticate);

  router.get('/', authorize(PERMISSIONS.ROLE_READ), controller.list);
  router.post('/', authorize(PERMISSIONS.ROLE_CREATE), controller.create);
  router.get('/:id', authorize(PERMISSIONS.ROLE_READ), controller.getById);
  router.patch('/:id', authorize(PERMISSIONS.ROLE_UPDATE), controller.update);
  router.delete('/:id', authorize(PERMISSIONS.ROLE_DELETE), controller.delete);

  return router;
}

export function createPermissionRouter(controller: RoleController): Router {
  const router = Router();

  router.get('/', authenticate, authorize(PERMISSIONS.ROLE_READ), controller.listPermissions);

  return router;
}
