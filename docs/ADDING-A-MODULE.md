# Adding a Module

This guide builds a **`post`** (article) module from scratch with these rules:

- Any authenticated user can create posts
- Any authenticated user can list posts
- Only the **author** can update or delete a post, **unless** the user has the `post:manage` permission

This pattern (ownership + permission override) is the one you'll need most often.

---

## 1. Database table

Add the model to [prisma/schema.prisma](../prisma/schema.prisma):

```prisma
model Post {
  id        String   @id @default(uuid(7)) @db.Uuid
  title     String
  content   String
  authorId  String   @map("author_id") @db.Uuid
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz(3)

  author User @relation(fields: [authorId], references: [id], onDelete: Cascade)

  @@index([authorId])
  @@map("posts")
}
```

Add the back-relation to the `User` model:

```prisma
model User {
  // ...
  posts Post[]
}
```

Then create the migration and regenerate the client:

```bash
npm run db:migrate -- --name add_posts
npm run db:generate
```

## 2. Permission

In [permissions.ts](../src/common/constants/permissions.ts):

```ts
export const PERMISSIONS = {
  // ...
  POST_MANAGE: 'post:manage',
} as const;

export const PERMISSION_DESCRIPTIONS: Record<PermissionKey, string> = {
  // ...
  [PERMISSIONS.POST_MANAGE]: 'Update or delete any post',
};
```

Store it in the database:

```bash
npm run db:seed
```

> The seeder only sets the permissions of system roles **when the role is first created**. To give `post:manage` to an existing `admin` role, call `PATCH /api/v1/roles/:id` as a super admin.

## 3. Schema (`post.schema.ts`)

```ts
import { z } from 'zod';

import { paginationQuerySchema } from '@/common/utils/pagination';
import { idParamsSchema } from '@/common/utils/validation';

export const listPostsSchema = z.object({ query: paginationQuerySchema });

export const createPostSchema = z.object({
  body: z.object({
    title: z.string().trim().min(1).max(200),
    content: z.string().trim().min(1),
  }),
});

export const updatePostSchema = z.object({
  params: idParamsSchema,
  body: createPostSchema.shape.body.partial(),
});

export const postIdSchema = z.object({ params: idParamsSchema });

export type CreatePostInput = z.infer<typeof createPostSchema>['body'];
export type UpdatePostInput = z.infer<typeof updatePostSchema>['body'];

export const postResponseSchema = z
  .object({
    id: z.uuid(),
    title: z.string(),
    content: z.string(),
    authorId: z.uuid(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .meta({ id: 'Post' });

export type PostResponse = z.infer<typeof postResponseSchema>;
```

## 4. Repository (`post.repository.ts`)

```ts
import type { Post, PrismaClient } from '@/generated/prisma/client';

export class PostRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findMany(skip: number, take: number): Promise<{ items: Post[]; total: number }> {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.post.findMany({ skip, take, orderBy: { createdAt: 'desc' } }),
      this.prisma.post.count(),
    ]);
    return { items, total };
  }

  findById(id: string): Promise<Post | null> {
    return this.prisma.post.findUnique({ where: { id } });
  }

  create(data: { title: string; content: string; authorId: string }): Promise<Post> {
    return this.prisma.post.create({ data });
  }

  update(id: string, data: { title?: string; content?: string }): Promise<Post> {
    return this.prisma.post.update({ where: { id }, data });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.post.delete({ where: { id } });
  }
}
```

## 5. Service (`post.service.ts`): the business rules

```ts
import { type AuthUser, hasPermission } from '@/common/auth';
import { PERMISSIONS } from '@/common/constants/permissions';
import { ForbiddenError, NotFoundError } from '@/common/errors';
import {
  buildPaginationMeta,
  type Paginated,
  type PaginationQuery,
  toSkipTake,
} from '@/common/utils/pagination';
import type { Post } from '@/generated/prisma/client';

import type { PostRepository } from './post.repository';
import type { CreatePostInput, PostResponse, UpdatePostInput } from './post.schema';

function toPostResponse(post: Post): PostResponse {
  return {
    id: post.id,
    title: post.title,
    content: post.content,
    authorId: post.authorId,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
  };
}

export class PostService {
  constructor(private readonly posts: PostRepository) {}

  async list(query: PaginationQuery): Promise<Paginated<PostResponse>> {
    const { skip, take } = toSkipTake(query);
    const { items, total } = await this.posts.findMany(skip, take);
    return { items: items.map(toPostResponse), meta: buildPaginationMeta(query, total) };
  }

  async create(actor: AuthUser, input: CreatePostInput): Promise<PostResponse> {
    return toPostResponse(await this.posts.create({ ...input, authorId: actor.id }));
  }

  async update(actor: AuthUser, id: string, input: UpdatePostInput): Promise<PostResponse> {
    await this.findOwnedOrThrow(actor, id);
    return toPostResponse(await this.posts.update(id, input));
  }

  async delete(actor: AuthUser, id: string): Promise<void> {
    await this.findOwnedOrThrow(actor, id);
    await this.posts.delete(id);
  }

  /** Ownership check: owner, or anyone with `post:manage`. */
  private async findOwnedOrThrow(actor: AuthUser, id: string): Promise<Post> {
    const post = await this.posts.findById(id);
    if (!post) throw new NotFoundError('Post not found');

    const isOwner = post.authorId === actor.id;
    if (!isOwner && !hasPermission(actor, PERMISSIONS.POST_MANAGE)) {
      throw new ForbiddenError('You can only modify your own posts');
    }
    return post;
  }
}
```

## 6. Controller (`post.controller.ts`)

```ts
import type { Request, Response } from 'express';

import { getAuthUser } from '@/common/auth';
import { created, noContent, ok } from '@/common/utils/response';
import { parseRequest } from '@/common/utils/validation';

import { createPostSchema, listPostsSchema, postIdSchema, updatePostSchema } from './post.schema';
import type { PostService } from './post.service';

export class PostController {
  constructor(private readonly postService: PostService) {}

  list = async (req: Request, res: Response): Promise<void> => {
    const { query } = parseRequest(listPostsSchema, req);
    const { items, meta } = await this.postService.list(query);
    ok(res, items, meta);
  };

  create = async (req: Request, res: Response): Promise<void> => {
    const { body } = parseRequest(createPostSchema, req);
    created(res, await this.postService.create(getAuthUser(req), body));
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const { params, body } = parseRequest(updatePostSchema, req);
    ok(res, await this.postService.update(getAuthUser(req), params.id, body));
  };

  delete = async (req: Request, res: Response): Promise<void> => {
    const { params } = parseRequest(postIdSchema, req);
    await this.postService.delete(getAuthUser(req), params.id);
    noContent(res);
  };
}
```

> Controller methods are arrow functions (`list = async () => {}`) so `this` stays bound when they are passed to the router.

## 7. Routes & module

`post.routes.ts`:

```ts
import { Router } from 'express';

import { authenticate } from '@/common/auth';

import type { PostController } from './post.controller';

export function createPostRouter(controller: PostController): Router {
  const router = Router();
  router.use(authenticate);

  router.get('/', controller.list);
  router.post('/', controller.create);
  // Ownership is checked in the service.
  router.patch('/:id', controller.update);
  router.delete('/:id', controller.delete);

  return router;
}
```

`post.module.ts`:

```ts
import { prisma } from '@/lib/prisma';

import { PostController } from './post.controller';
import { PostRepository } from './post.repository';
import { createPostRouter } from './post.routes';
import { PostService } from './post.service';

const postService = new PostService(new PostRepository(prisma));

export const postRouter = createPostRouter(new PostController(postService));
```

Mount it in [src/routes.ts](../src/routes.ts):

```ts
import { postRouter } from '@/modules/post/post.module';

apiRouter.use('/posts', postRouter);
```

When an endpoint needs a permission at the route level, add `authorize(...)` to it:

```ts
router.get('/stats', authorize(PERMISSIONS.POST_MANAGE), controller.stats);
```

## 8. API docs (`post.docs.ts`)

```ts
import { errorResponses, jsonBody, registry, secured, successResponse } from '@/docs/registry';

import { createPostSchema, postResponseSchema } from './post.schema';

registry.registerPath({
  method: 'post',
  path: '/posts',
  operationId: 'createPost',
  tags: ['Posts'],
  summary: 'Create a post',
  security: secured,
  request: { body: jsonBody(createPostSchema.shape.body) },
  responses: {
    201: successResponse(postResponseSchema, 'Post created'),
    ...errorResponses(401, 422),
  },
});
```

Then import it in [src/docs/openapi.ts](../src/docs/openapi.ts):

```ts
import '@/modules/post/post.docs';
```

## 9. Tests

Integration test `tests/integration/posts.test.ts`:

```ts
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '@/app';

import { createUserAndLogin } from '../helpers/factories';

const app = createApp();
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

describe('Posts', () => {
  it('only lets the author update a post', async () => {
    const author = await createUserAndLogin(app);
    const other = await createUserAndLogin(app);

    const post = await request(app)
      .post('/api/v1/posts')
      .set(auth(author.accessToken))
      .send({ title: 'Hello', content: 'World' })
      .expect(201);

    await request(app)
      .patch(`/api/v1/posts/${post.body.data.id}`)
      .set(auth(other.accessToken))
      .send({ title: 'Hacked' })
      .expect(403);

    const res = await request(app)
      .patch(`/api/v1/posts/${post.body.data.id}`)
      .set(auth(author.accessToken))
      .send({ title: 'Updated' })
      .expect(200);
    expect(res.body.data.title).toBe('Updated');
  });
});
```

Run:

```bash
npm test
```

## Checklist

- [ ] Prisma model + migration
- [ ] New permissions (if any) + `npm run db:seed`
- [ ] `*.schema.ts`: request and response schemas
- [ ] `*.repository.ts`: queries only
- [ ] `*.service.ts`: business logic + ownership
- [ ] `*.controller.ts`: parse → service → response
- [ ] `*.routes.ts`: `authenticate` / `authorize`
- [ ] `*.module.ts` + mount in `src/routes.ts`
- [ ] `*.docs.ts` + import in `src/docs/openapi.ts`
- [ ] Tests (unit for business rules, integration for HTTP flows)
- [ ] If you change user or role access rights: call `authContextService.invalidate...`
