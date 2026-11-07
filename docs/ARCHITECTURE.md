# Architecture

This document explains **why** the code is organized the way it is, so it is easy to understand and extend.

## 1. Modular + layered

Code is grouped **by feature** (`src/modules/<feature>/`), and each feature is split **by layer**. Everything about one feature lives in one folder, and each layer has a single responsibility.

```
HTTP request
    │
    ▼
┌──────────────┐  Declares endpoints and their middleware (authenticate, authorize, rate limit)
│    Route     │
└──────┬───────┘
       ▼
┌──────────────┐  Validates input (Zod) → calls the service → sends the response
│  Controller  │  ✗ no business logic, ✗ no database queries
└──────┬───────┘
       ▼
┌──────────────┐  Business logic and per-record authorization (ownership, privilege level)
│   Service    │  ✗ never touches req/res → easy to unit test
└──────┬───────┘
       ▼
┌──────────────┐  Database queries (Prisma). The only layer that knows about the ORM
│  Repository  │  ✗ no business logic
└──────┬───────┘
       ▼
   PostgreSQL
```

Any layer can `throw`. Express 5 forwards errors from async handlers to the **global error handler** ([error-handler.ts](../src/common/middlewares/error-handler.ts)), which turns them into the standard JSON error response.

### Manual dependency injection

Every class receives its dependencies through its constructor:

```ts
export class UserService {
  constructor(
    private readonly users: UserRepository,
    private readonly roles: RoleRepository,
    private readonly authContext: AuthContextService,
    ...
  ) {}
}
```

The object graph is wired in one place per module, `*.module.ts` (the _composition root_):

```ts
const userService = new UserService(new UserRepository(prisma), ...);
export const userRouter = createUserRouter(new UserController(userService));
```

In unit tests, dependencies are replaced with mocks (see [user.service.test.ts](../src/modules/user/user.service.test.ts)). No DI library is needed, only plain classes.

### Dependency direction

```
modules/*  ──►  common/*  ──►  lib/*  ──►  config/
```

`common/` and `lib/` must **never** import from `modules/`. Modules may import from each other (e.g. `auth` uses `UserRepository`) as long as there are no cycles.

### Request validation

Each endpoint has one Zod schema shaped like `{ body?, query?, params? }`:

```ts
export const updateUserSchema = z.object({
  params: idParamsSchema,
  body: z.object({ name: nameField.optional() }),
});

// in the controller
const { params, body } = parseRequest(updateUserSchema, req); // fully typed
```

When the input is invalid, `parseRequest` throws a `ZodError` and the error handler turns it into a `422` with field paths such as `body.email`. The same schemas generate the OpenAPI document, so the docs can't drift from the code.

## 2. Authentication

### Two kinds of tokens

|               | Access token                          | Refresh token                  |
| ------------- | ------------------------------------- | ------------------------------ |
| Format        | JWT (HS256)                           | Random 384-bit string (opaque) |
| Lifetime      | Short (15 minutes by default)         | Long (7 days by default)       |
| Stored in DB? | No                                    | Yes, **SHA-256 hash only**     |
| Sent in       | `Authorization: Bearer ...` header    | `POST /auth/refresh` body      |
| Claims        | `sub` (user id), `tv` (token version) | None                           |

### Flow

```
Login ──► { accessToken, refreshToken }
             │
             ├─ every request: Authorization: Bearer <accessToken>
             │
             └─ access token expired → POST /auth/refresh { refreshToken }
                      │
                      ├─ the old refresh token is marked as revoked
                      └─ a NEW token pair is returned (rotation)
```

### Refresh token rotation and reuse detection

Each refresh token can be used **once**. If an already-used token shows up again, either it was stolen or someone else is using it on the user's behalf. We can't tell which, so every session of the user is revoked (see `refresh` in [auth.service.ts](../src/modules/auth/auth.service.ts)). The attacker is locked out, and the real user simply logs in again.

### Instant revocation with `tokenVersion`

A JWT can't be "deleted": it stays valid until it expires. To work around this, the `users.token_version` column is embedded in the token (`tv`), and the `authenticate` middleware compares it against the current value (through the cache). Logout-all, password changes, user deletion and reuse detection simply **increment** `tokenVersion`, and every older access token is rejected immediately.

### The `authenticate` middleware

[authenticate.ts](../src/common/auth/authenticate.ts):

1. Reads the token from the `Authorization` header
2. Verifies signature, expiry and issuer (algorithm pinned to HS256)
3. Loads the user's **auth context** (id, active flag, tokenVersion, roles, permissions) from the cache, or from the database on a miss
4. Rejects the request if the user is missing, inactive, or the `tokenVersion` doesn't match
5. Stores the result in `req.user`

## 3. Authorization (RBAC)

### Data model

```
User ──< UserRole >── Role ──< RolePermission >── Permission
```

The user–role relation is always **many-to-many**. Projects that need a _single role_ per user set `RBAC_ALLOW_MULTIPLE_ROLES=false`, and the service rejects assigning more than one role. The database schema stays exactly the same.

A user's **effective permissions** are the union of the permissions of all their roles.

### Check permissions, not roles

```ts
// ❌ Brittle: every new role requires code changes
if (user.role === 'admin' || user.role === 'manager') ...

// ✅ Flexible: roles can be created or changed at runtime without touching code
router.delete('/:id', authorize(PERMISSIONS.USER_DELETE), controller.delete);
```

Permissions are defined in [permissions.ts](../src/common/constants/permissions.ts) using the `resource:action` format. The `*` permission grants everything and is only held by `super_admin`.

### Two levels of authorization

| Level  | Where                      | Question                                                  |
| ------ | -------------------------- | --------------------------------------------------------- |
| Route  | `authorize(...)` on routes | "Can this user perform this action **at all**?"           |
| Record | Service                    | "Can this user perform it on **this particular** record?" |

Record-level example from [user.service.ts](../src/modules/user/user.service.ts):

```ts
// Ownership: users can read themselves; reading others requires user:read
if (actor.id !== id && !hasPermission(actor, PERMISSIONS.USER_READ)) {
  throw new ForbiddenError();
}
```

### Preventing privilege escalation

The rule: **you can only grant or manage permissions you hold yourself** (`assertHoldsPermissions`). As a result:

- An `admin` (who has `role:assign`) can't give the `super_admin` role (`*`) to anyone, including themselves
- An `admin` can't delete, deactivate, or change the roles of a `super_admin`
- Role creators can't include permissions they don't have
- Nobody can change their own roles or status, or delete their own account

### Auth context cache and invalidation

To avoid hitting the database on every request, the auth context is cached (Redis or memory) for `RBAC_CACHE_TTL_SECONDS`. Every change that affects access rights **must** invalidate it:

| Change                                  | Invalidation                            |
| --------------------------------------- | --------------------------------------- |
| A user's roles are replaced             | `authContext.invalidate(userId)`        |
| A role's permissions are changed        | `authContext.invalidateByRole(roleId)`  |
| A user is updated, deactivated, deleted | `authContext.invalidate(userId)`        |
| Logout-all / password change            | `tokenVersion++` + `invalidate(userId)` |

As a result, permission changes take effect on the very next request, without the user logging in again. The integration tests cover this.

## 4. Supporting components

| Component       | File                                                         | Notes                                                     |
| --------------- | ------------------------------------------------------------ | --------------------------------------------------------- |
| Config          | [config/](../src/config)                                     | The only place that reads `process.env`                   |
| Logger          | [lib/logger.ts](../src/lib/logger.ts)                        | JSON in production, pretty in dev, secrets redacted       |
| Request logging | [http-logger.ts](../src/common/middlewares/http-logger.ts)   | One line per request + `X-Request-Id`                     |
| Cache           | [lib/cache/](../src/lib/cache)                               | `CacheStore` interface, Redis and memory implementations  |
| Passwords       | [lib/password.ts](../src/lib/password.ts)                    | Argon2id (OWASP recommendation)                           |
| Rate limiting   | [rate-limiter.ts](../src/common/middlewares/rate-limiter.ts) | Global limit + stricter limit for credential endpoints    |
| Soft delete     | [user.repository.ts](../src/modules/user/user.repository.ts) | `deletedAt`; every query filters `deletedAt: null`        |
| Health          | [modules/health/](../src/modules/health)                     | `/health` (liveness), `/health/ready` (DB + cache)        |
| Shutdown        | [server.ts](../src/server.ts)                                | SIGTERM → stop accepting connections → close DB and cache |
