# Express TypeScript Boilerplate

Production-ready REST API boilerplate built with **Express 5**, **TypeScript**, **Prisma 7 (PostgreSQL)**, **JWT authentication with refresh token rotation**, and **permission-based RBAC**.

The goal: every new project starts with a solid, consistent foundation (structure, auth, error handling, logging, testing, docs, Docker, CI), so you can focus on business features from day one.

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Scripts](#scripts)
- [Project Structure](#project-structure)
- [API Endpoints](#api-endpoints)
- [Response Format](#response-format)
- [Environment Variables](#environment-variables)
- [Testing](#testing)
- [Conventions](#conventions)
- [Production Notes](#production-notes)
- [Further Reading](#further-reading)

## Features

**Authentication**

- Register, login, logout, logout from all devices, change password
- Short-lived JWT access tokens (15 minutes by default)
- Opaque refresh tokens, stored hashed and **rotated** on every use
- **Reuse detection**: replaying an old refresh token revokes every session of the user
- Instant token revocation through a per-user `tokenVersion`
- Constant-time login to prevent email enumeration

**Authorization (RBAC)**

- User ↔ Role ↔ Permission (many-to-many), supporting both **single-role and multi-role** setups (`RBAC_ALLOW_MULTIPLE_ROLES`)
- Code checks **permissions**, never role names
- **Ownership** checks (users can manage their own data)
- **Privilege escalation** protection: nobody can grant or manage permissions they don't hold
- Role and permission changes apply **immediately**, without re-login (cached auth context with invalidation)

**Foundation**

- Feature-based modular architecture (route → controller → service → repository)
- Zod validation for environment and requests, consistent success and error envelopes
- Structured logging (Pino) with request IDs and redaction of sensitive fields
- Helmet, CORS, rate limiting
- OpenAPI 3.1 docs generated from the Zod schemas (Swagger UI)
- Liveness and readiness health checks, graceful shutdown
- Unit and integration tests (Vitest + Supertest)
- Multi-stage Docker image, docker-compose, GitHub Actions CI
- ESLint (strict type-checked), Prettier, Husky, lint-staged, commitlint

## Tech Stack

| Concern        | Technology                                         |
| -------------- | -------------------------------------------------- |
| Runtime        | Node.js 26 (22.12 minimum)                         |
| Language       | TypeScript 6 (strict)                              |
| Framework      | Express 5                                          |
| Database & ORM | PostgreSQL + Prisma 7 (`pg` driver adapter)        |
| Cache          | Redis (ioredis) or in-memory                       |
| Validation     | Zod 4                                              |
| Auth           | jsonwebtoken, argon2                               |
| Security       | helmet, cors, express-rate-limit                   |
| Logging        | Pino, pino-http                                    |
| API docs       | @asteasolutions/zod-to-openapi, swagger-ui-express |
| Testing        | Vitest, Supertest                                  |
| Build / dev    | tsup, tsx                                          |
| Code quality   | ESLint, Prettier, Husky, lint-staged, commitlint   |

## Getting Started

### Prerequisites

- Node.js ≥ 22.12 (see `.nvmrc`)
- PostgreSQL ≥ 14 (or Docker)
- Redis (optional)

### Option A: run locally

```bash
# 1. Install dependencies (also runs `prisma generate`)
npm install

# 2. Configure the environment
cp .env.example .env
#    → set DATABASE_URL and JWT_ACCESS_SECRET (openssl rand -base64 48)

# 3. Create the tables and seed initial data (permissions, roles, super admin)
npm run db:migrate
npm run db:seed

# 4. Start the dev server (auto-reload)
npm run dev
```

Then open:

- API: http://localhost:3000/api/v1
- Swagger UI: http://localhost:3000/docs
- Health check: http://localhost:3000/health/ready

Initial account created by the seeder (configurable via `SEED_SUPER_ADMIN_*` in `.env`):

```
email:    superadmin@example.com
password: ChangeMe123!
```

### Option B: Docker

```bash
cp .env.example .env   # at least set JWT_ACCESS_SECRET
docker compose up --build
```

Compose starts PostgreSQL and Redis, runs a one-off migrate and seed job, then starts the API on port 3000.

## Scripts

| Script                      | Description                                    |
| --------------------------- | ---------------------------------------------- |
| `npm run dev`               | Start the dev server with auto-reload          |
| `npm run build`             | Build for production into `dist/`              |
| `npm start`                 | Run the production build                       |
| `npm run typecheck`         | Type-check with TypeScript                     |
| `npm run lint` / `lint:fix` | Run ESLint                                     |
| `npm run format`            | Format every file with Prettier                |
| `npm test`                  | Run all tests (unit + integration)             |
| `npm run test:unit`         | Unit tests only (no database needed)           |
| `npm run test:integration`  | Integration tests (needs the test database)    |
| `npm run test:coverage`     | Tests with a coverage report                   |
| `npm run db:migrate`        | Create and apply migrations (development)      |
| `npm run db:migrate:deploy` | Apply existing migrations (production / CI)    |
| `npm run db:seed`           | Sync permissions, system roles and super admin |
| `npm run db:studio`         | Open Prisma Studio                             |

## Project Structure

```
├── prisma/
│   ├── schema.prisma          # Database schema
│   ├── migrations/            # SQL migration history (committed)
│   ├── seed.ts                # Seeder entry point
│   └── seeders/               # Seeders per concern (RBAC, super admin)
├── src/
│   ├── config/                # Validated env + grouped config
│   ├── lib/                   # Infrastructure clients: prisma, logger, cache, password
│   ├── common/                # Shared across modules
│   │   ├── auth/              # JWT, authenticate, authorize, auth context
│   │   ├── constants/         # PERMISSIONS & SYSTEM_ROLES (single source of truth)
│   │   ├── errors/            # AppError and subclasses
│   │   ├── middlewares/       # Error handler, request logger, rate limiter, 404
│   │   ├── types/             # Express type augmentation (req.user)
│   │   └── utils/             # Response, pagination, validation, crypto helpers
│   ├── docs/                  # OpenAPI registry and generator
│   ├── modules/               # One folder per feature
│   │   ├── auth/
│   │   ├── user/
│   │   ├── role/
│   │   └── health/
│   ├── generated/             # Prisma client (generated, not committed)
│   ├── routes.ts              # Mounts every module router
│   ├── app.ts                 # Builds the Express app (without listening)
│   └── server.ts              # Entry point: listen + graceful shutdown
└── tests/
    ├── integration/           # End-to-end HTTP tests
    └── helpers/               # Database reset, user factories
```

Anatomy of a module (e.g. `user/`):

| File                 | Responsibility                                               |
| -------------------- | ------------------------------------------------------------ |
| `user.routes.ts`     | Endpoints and their middleware (`authenticate`, `authorize`) |
| `user.controller.ts` | Parse and validate the request → call the service → respond  |
| `user.service.ts`    | **Business logic** and per-record authorization rules        |
| `user.repository.ts` | Database queries (Prisma)                                    |
| `user.schema.ts`     | Zod request and response schemas, and their inferred types   |
| `user.mapper.ts`     | Converts database records into API response shapes           |
| `user.docs.ts`       | Registers the endpoints in the OpenAPI document              |
| `user.module.ts`     | Wires dependencies (manual DI) and exports the router        |
| `*.test.ts`          | Unit tests, placed next to the file under test               |

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full explanation.

## API Endpoints

Prefix: `/api/v1`. Full details are available in Swagger UI (`/docs`).

| Method | Path                       | Access                                             |
| ------ | -------------------------- | -------------------------------------------------- |
| POST   | `/auth/register`           | Public                                             |
| POST   | `/auth/login`              | Public                                             |
| POST   | `/auth/refresh`            | Public (requires a refresh token)                  |
| POST   | `/auth/logout`             | Public (requires a refresh token)                  |
| POST   | `/auth/logout-all`         | Authenticated                                      |
| GET    | `/auth/me`                 | Authenticated                                      |
| POST   | `/auth/change-password`    | Authenticated                                      |
| GET    | `/users`                   | `user:read`                                        |
| POST   | `/users`                   | `user:create` (+ `role:assign` when setting roles) |
| GET    | `/users/:id`               | Self, or `user:read`                               |
| PATCH  | `/users/:id`               | Self (name only), or `user:update`                 |
| DELETE | `/users/:id`               | `user:delete`                                      |
| PUT    | `/users/:id/roles`         | `role:assign`                                      |
| GET    | `/roles`                   | `role:read`                                        |
| POST   | `/roles`                   | `role:create`                                      |
| GET    | `/roles/:id`               | `role:read`                                        |
| PATCH  | `/roles/:id`               | `role:update`                                      |
| DELETE | `/roles/:id`               | `role:delete`                                      |
| GET    | `/permissions`             | `role:read`                                        |
| GET    | `/health`, `/health/ready` | Public (outside the API prefix)                    |

System roles created by the seeder:

| Role          | Permissions                                                         |
| ------------- | ------------------------------------------------------------------- |
| `super_admin` | `*` (everything)                                                    |
| `admin`       | `user:read/create/update/delete`, `role:read`, `role:assign`        |
| `user`        | None. Can only manage their own account through the ownership rules |

## Response Format

Success:

```json
{ "success": true, "data": { "id": "..." } }
```

Success with pagination:

```json
{
  "success": true,
  "data": [{ "id": "..." }],
  "meta": { "page": 1, "limit": 20, "total": 42, "totalPages": 3 }
}
```

Error (always the same shape):

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [{ "path": "body.email", "message": "Must be a valid email address" }],
    "requestId": "a1b2c3..."
  }
}
```

| Status | `code`                  | When                                              |
| ------ | ----------------------- | ------------------------------------------------- |
| 400    | `BAD_REQUEST`           | The request makes no sense for the business rules |
| 401    | `UNAUTHORIZED`          | Missing, invalid, expired, or revoked token       |
| 403    | `FORBIDDEN`             | Authenticated but not allowed                     |
| 404    | `NOT_FOUND`             | Resource or route not found                       |
| 409    | `CONFLICT`              | Duplicate (email, role name, ...)                 |
| 422    | `VALIDATION_ERROR`      | Input failed validation                           |
| 429    | `TOO_MANY_REQUESTS`     | Rate limit exceeded                               |
| 500    | `INTERNAL_SERVER_ERROR` | Unexpected error (details are only in the logs)   |

The `requestId` is also sent in the `X-Request-Id` header. Search for it in the logs when debugging.

## Environment Variables

Every variable is validated on startup in [src/config/env.ts](src/config/env.ts). The app exits with a clear message when something is wrong. See [.env.example](.env.example) for the full list with explanations.

**Required**: `DATABASE_URL`, `JWT_ACCESS_SECRET` (at least 32 characters).

## Testing

```bash
cp .env.test.example .env.test   # point it to a DEDICATED test database
createdb boilerplate_test
npm test
```

- **Unit tests** (`src/**/*.test.ts`) exercise services and helpers with mocked dependencies. They are fast and need no database.
- **Integration tests** (`tests/integration/`) send real HTTP requests to the app, backed by a real PostgreSQL database. Every test starts from an empty database plus the RBAC seed.

> ⚠️ Integration tests `TRUNCATE` every table. As a safeguard, they refuse to run unless the database name contains `test`.

## Conventions

- **Commits**: [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`, ...), enforced by commitlint.
- **Pre-commit**: ESLint and Prettier run automatically on staged files.
- **File names**: `kebab-case` with a role suffix (`*.service.ts`, `*.repository.ts`, ...).
- **Imports**: use the `@/` alias across folders, relative paths within a module.
- **Database**: singular `PascalCase` models, plural `snake_case` tables and `snake_case` columns (`@@map` / `@map`).

## Production Notes

- Use a long, random `JWT_ACCESS_SECRET` and never commit `.env`.
- When running **more than one instance**, set `REDIS_URL` so auth cache invalidation reaches every instance, and use a shared store for the rate limiter (e.g. `rate-limit-redis`).
- Behind a reverse proxy or load balancer, set `TRUST_PROXY` (e.g. `1`) so client IPs and rate limits are correct.
- Consider `API_DOCS_ENABLED=false` for public APIs.
- Run `npm run db:migrate:deploy` (not `db:migrate`) in production.
- Emails stay unique even for soft-deleted users.

## Further Reading

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): architecture, request flow, how authentication and authorization work
- [docs/ADDING-A-MODULE.md](docs/ADDING-A-MODULE.md): step-by-step guide to building a new module
