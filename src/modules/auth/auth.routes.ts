import { Router } from 'express';

import { authenticate } from '@/common/auth';
import { authRateLimiter } from '@/common/middlewares/rate-limiter';

import type { AuthController } from './auth.controller';

export function createAuthRouter(controller: AuthController): Router {
  const router = Router();

  // Public
  router.post('/register', authRateLimiter, controller.register);
  router.post('/login', authRateLimiter, controller.login);
  router.post('/refresh', controller.refresh);
  router.post('/logout', controller.logout);

  // Authenticated
  router.get('/me', authenticate, controller.me);
  router.post('/logout-all', authenticate, controller.logoutAll);
  router.post('/change-password', authenticate, authRateLimiter, controller.changePassword);

  return router;
}
