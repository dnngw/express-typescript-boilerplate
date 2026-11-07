import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '@/app';

import { createUser, createUserAndLogin, DEFAULT_PASSWORD, login } from '../helpers/factories';

const app = createApp();
const api = '/api/v1/auth';

describe('Auth', () => {
  describe('POST /auth/register', () => {
    it('creates an account with the default role and returns tokens', async () => {
      const res = await request(app)
        .post(`${api}/register`)
        .send({ name: 'Jane', email: '  Jane@Example.COM ', password: DEFAULT_PASSWORD })
        .expect(201);

      expect(res.body.data.user).toMatchObject({ email: 'jane@example.com', isActive: true });
      expect(res.body.data.user.roles.map((r: { name: string }) => r.name)).toEqual(['user']);
      expect(res.body.data.user).not.toHaveProperty('passwordHash');
      expect(res.body.data.tokens).toMatchObject({ tokenType: 'Bearer', expiresIn: 900 });
    });

    it('rejects an email that is already registered', async () => {
      await createUser({ email: 'taken@example.com' });

      const res = await request(app)
        .post(`${api}/register`)
        .send({ name: 'X', email: 'taken@example.com', password: DEFAULT_PASSWORD })
        .expect(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });

    it('returns every validation issue with its field path', async () => {
      const res = await request(app)
        .post(`${api}/register`)
        .send({ email: 'not-an-email', password: 'short' })
        .expect(422);

      const paths = res.body.error.details.map((d: { path: string }) => d.path);
      expect(paths).toEqual(expect.arrayContaining(['body.name', 'body.email', 'body.password']));
    });
  });

  describe('POST /auth/login', () => {
    it('rejects a wrong password and an unknown email with the same message', async () => {
      const user = await createUser();

      const wrongPassword = await request(app)
        .post(`${api}/login`)
        .send({ email: user.email, password: 'Wrong123' })
        .expect(401);
      const unknownEmail = await request(app)
        .post(`${api}/login`)
        .send({ email: 'nobody@example.com', password: 'Wrong123' })
        .expect(401);

      expect(wrongPassword.body.error.message).toBe(unknownEmail.body.error.message);
    });

    it('rejects deactivated accounts', async () => {
      const user = await createUser({ isActive: false });
      await request(app)
        .post(`${api}/login`)
        .send({ email: user.email, password: user.password })
        .expect(403);
    });
  });

  describe('GET /auth/me', () => {
    it('requires an access token', async () => {
      await request(app).get(`${api}/me`).expect(401);
      await request(app).get(`${api}/me`).set('Authorization', 'Bearer garbage').expect(401);
    });

    it('returns the user with their effective permissions', async () => {
      const admin = await createUserAndLogin(app, { roles: ['admin'] });

      const res = await request(app)
        .get(`${api}/me`)
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .expect(200);

      expect(res.body.data.email).toBe(admin.email);
      expect(res.body.data.permissions).toContain('user:read');
    });
  });

  describe('POST /auth/refresh', () => {
    it('rotates the refresh token', async () => {
      const user = await createUserAndLogin(app);

      const first = await request(app)
        .post(`${api}/refresh`)
        .send({ refreshToken: user.refreshToken })
        .expect(200);
      expect(first.body.data.refreshToken).not.toBe(user.refreshToken);

      await request(app)
        .post(`${api}/refresh`)
        .send({ refreshToken: first.body.data.refreshToken })
        .expect(200);
    });

    it('detects reuse of an old refresh token and revokes every session', async () => {
      const user = await createUserAndLogin(app);
      const rotated = await request(app)
        .post(`${api}/refresh`)
        .send({ refreshToken: user.refreshToken })
        .expect(200);

      // An attacker replays the original token.
      await request(app)
        .post(`${api}/refresh`)
        .send({ refreshToken: user.refreshToken })
        .expect(401);

      // The legitimate user's newer tokens are now revoked as well.
      await request(app)
        .post(`${api}/refresh`)
        .send({ refreshToken: rotated.body.data.refreshToken })
        .expect(401);
      await request(app)
        .get(`${api}/me`)
        .set('Authorization', `Bearer ${rotated.body.data.accessToken}`)
        .expect(401);
    });
  });

  describe('logout', () => {
    it('POST /auth/logout revokes the refresh token', async () => {
      const user = await createUserAndLogin(app);

      await request(app)
        .post(`${api}/logout`)
        .send({ refreshToken: user.refreshToken })
        .expect(204);
      await request(app)
        .post(`${api}/refresh`)
        .send({ refreshToken: user.refreshToken })
        .expect(401);
    });

    it('POST /auth/logout-all revokes every access and refresh token', async () => {
      const user = await createUser();
      const sessionA = await login(app, user);
      const sessionB = await login(app, user);

      await request(app)
        .post(`${api}/logout-all`)
        .set('Authorization', `Bearer ${sessionA.accessToken}`)
        .expect(204);

      await request(app)
        .get(`${api}/me`)
        .set('Authorization', `Bearer ${sessionB.accessToken}`)
        .expect(401);
      await request(app)
        .post(`${api}/refresh`)
        .send({ refreshToken: sessionB.refreshToken })
        .expect(401);
    });
  });

  describe('POST /auth/change-password', () => {
    it('changes the password and invalidates other sessions', async () => {
      const user = await createUser();
      const other = await login(app, user);
      const current = await login(app, user);

      const res = await request(app)
        .post(`${api}/change-password`)
        .set('Authorization', `Bearer ${current.accessToken}`)
        .send({ currentPassword: user.password, newPassword: 'NewPassw0rd' })
        .expect(200);

      await request(app)
        .get(`${api}/me`)
        .set('Authorization', `Bearer ${other.accessToken}`)
        .expect(401);
      await request(app)
        .get(`${api}/me`)
        .set('Authorization', `Bearer ${res.body.data.accessToken}`)
        .expect(200);
      await login(app, { ...user, password: 'NewPassw0rd' });
    });

    it('rejects an incorrect current password', async () => {
      const user = await createUserAndLogin(app);
      await request(app)
        .post(`${api}/change-password`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ currentPassword: 'Wrong1234', newPassword: 'NewPassw0rd' })
        .expect(400);
    });
  });
});
