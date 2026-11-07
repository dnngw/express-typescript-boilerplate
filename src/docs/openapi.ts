import { OpenApiGeneratorV31 } from '@asteasolutions/zod-to-openapi';

import { config } from '@/config';

import { registry } from './registry';

// Side-effect imports: each file registers its module's endpoints.
import '@/modules/auth/auth.docs';
import '@/modules/role/role.docs';
import '@/modules/user/user.docs';

type OpenApiDocument = ReturnType<OpenApiGeneratorV31['generateDocument']>;

export function buildOpenApiDocument(): OpenApiDocument {
  return new OpenApiGeneratorV31(registry.definitions).generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'Express TypeScript Boilerplate API',
      version: '1.0.0',
      description:
        'REST API with JWT authentication and permission-based access control (RBAC).\n\n' +
        'Log in via `POST /auth/login`, then click **Authorize** and paste the `accessToken`.',
    },
    servers: [{ url: config.server.apiPrefix }],
  });
}
