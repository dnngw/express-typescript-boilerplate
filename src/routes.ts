import { Router } from 'express';

import { authRouter } from '@/modules/auth/auth.module';
import { permissionRouter, roleRouter } from '@/modules/role/role.module';
import { userRouter } from '@/modules/user/user.module';

/** Every versioned API route is mounted here (under `config.server.apiPrefix`). */
export const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/users', userRouter);
apiRouter.use('/roles', roleRouter);
apiRouter.use('/permissions', permissionRouter);
