import { randomUUID } from 'node:crypto';

import type { Express } from 'express';
import request from 'supertest';

import { SYSTEM_ROLES } from '@/common/constants/roles';
import { passwordHasher } from '@/lib/password';
import { prisma } from '@/lib/prisma';

export const DEFAULT_PASSWORD = 'Passw0rd!';

interface CreateUserOptions {
  name?: string;
  email?: string;
  password?: string;
  roles?: string[];
  isActive?: boolean;
}

export interface TestUser {
  id: string;
  email: string;
  password: string;
}

export async function createUser(options: CreateUserOptions = {}): Promise<TestUser> {
  const email = options.email ?? `user-${randomUUID()}@example.com`;
  const password = options.password ?? DEFAULT_PASSWORD;
  const roleNames = options.roles ?? [SYSTEM_ROLES.USER];

  const roles = await prisma.role.findMany({ where: { name: { in: roleNames } } });
  const user = await prisma.user.create({
    data: {
      name: options.name ?? 'Test User',
      email,
      passwordHash: await passwordHasher.hash(password),
      isActive: options.isActive ?? true,
      roles: { create: roles.map((role) => ({ roleId: role.id })) },
    },
  });

  return { id: user.id, email, password };
}

export interface LoggedInUser extends TestUser {
  accessToken: string;
  refreshToken: string;
}

export async function login(app: Express, user: TestUser): Promise<LoggedInUser> {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: user.email, password: user.password })
    .expect(200);

  return {
    ...user,
    accessToken: res.body.data.tokens.accessToken as string,
    refreshToken: res.body.data.tokens.refreshToken as string,
  };
}

export async function createUserAndLogin(
  app: Express,
  options: CreateUserOptions = {},
): Promise<LoggedInUser> {
  return login(app, await createUser(options));
}

export async function getRoleId(name: string): Promise<string> {
  const role = await prisma.role.findUniqueOrThrow({ where: { name } });
  return role.id;
}
