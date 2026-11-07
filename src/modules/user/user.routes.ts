import { Router } from 'express';

import { authenticate, authorize } from '@/common/auth';
import { PERMISSIONS } from '@/common/constants/permissions';

import type { UserController } from './user.controller';

export function createUserRouter(controller: UserController): Router {
  const router = Router();
  router.use(authenticate);

  router.get('/', authorize(PERMISSIONS.USER_READ), controller.list);
  router.post('/', authorize(PERMISSIONS.USER_CREATE), controller.create);
  // Ownership rules ("self, or has permission") are enforced in the service.
  router.get('/:id', controller.getById);
  router.patch('/:id', controller.update);
  router.delete('/:id', authorize(PERMISSIONS.USER_DELETE), controller.delete);
  router.put('/:id/roles', authorize(PERMISSIONS.ROLE_ASSIGN), controller.assignRoles);

  return router;
}
