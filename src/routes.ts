import { Router } from 'express';

import { authRouter } from '@/modules/auth/auth.module';

/** Every versioned API route is mounted here (under `config.server.apiPrefix`). */
export const apiRouter = Router();

apiRouter.use('/auth', authRouter);
