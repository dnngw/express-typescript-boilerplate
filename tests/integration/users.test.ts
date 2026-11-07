import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '@/app';

import { createUser, createUserAndLogin, getRoleId } from '../helpers/factories';

const app = createApp();
const api = '/api/v1/users';
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

describe('Users', () => {
  describe('GET /users', () => {
    it('is forbidden without user:read', async () => {
      const user = await createUserAndLogin(app);
      await request(app).get(api).set(auth(user.accessToken)).expect(403);
    });

    it('paginates, searches, and filters', async () => {
      const admin = await createUserAndLogin(app, { roles: ['admin'], name: 'Admin' });
      await createUser({ name: 'Alice Smith' });
      await createUser({ name: 'Bob Smith', isActive: false });

      const page = await request(app)
        .get(`${api}?limit=2&page=1`)
        .set(auth(admin.accessToken))
        .expect(200);
      expect(page.body.data).toHaveLength(2);
      expect(page.body.meta).toEqual({ page: 1, limit: 2, total: 3, totalPages: 2 });

      const search = await request(app)
        .get(`${api}?search=smith&isActive=true`)
        .set(auth(admin.accessToken))
        .expect(200);
      expect(search.body.data.map((u: { name: string }) => u.name)).toEqual(['Alice Smith']);
    });
  });

  describe('ownership', () => {
    it('lets users read and rename themselves but not others', async () => {
      const user = await createUserAndLogin(app);
      const other = await createUser();

      await request(app).get(`${api}/${user.id}`).set(auth(user.accessToken)).expect(200);
      await request(app).get(`${api}/${other.id}`).set(auth(user.accessToken)).expect(403);

      const res = await request(app)
        .patch(`${api}/${user.id}`)
        .set(auth(user.accessToken))
        .send({ name: 'New Name' })
        .expect(200);
      expect(res.body.data.name).toBe('New Name');

      await request(app)
        .patch(`${api}/${other.id}`)
        .set(auth(user.accessToken))
        .send({ name: 'Hacked' })
        .expect(403);
    });

    it('does not let users change their own account status', async () => {
      const user = await createUserAndLogin(app);
      await request(app)
        .patch(`${api}/${user.id}`)
        .set(auth(user.accessToken))
        .send({ isActive: false })
        .expect(403);
    });
  });

  describe('privilege escalation', () => {
    it('prevents an admin from managing a super admin', async () => {
      const admin = await createUserAndLogin(app, { roles: ['admin'] });
      const superAdmin = await createUser({ roles: ['super_admin'] });

      await request(app).delete(`${api}/${superAdmin.id}`).set(auth(admin.accessToken)).expect(403);
      await request(app)
        .patch(`${api}/${superAdmin.id}`)
        .set(auth(admin.accessToken))
        .send({ isActive: false })
        .expect(403);
    });

    it('prevents an admin from assigning the super_admin role', async () => {
      const admin = await createUserAndLogin(app, { roles: ['admin'] });
      const user = await createUser();

      await request(app)
        .put(`${api}/${user.id}/roles`)
        .set(auth(admin.accessToken))
        .send({ roleIds: [await getRoleId('super_admin')] })
        .expect(403);
    });

    it('prevents users from changing their own roles', async () => {
      const admin = await createUserAndLogin(app, { roles: ['admin'] });
      await request(app)
        .put(`${api}/${admin.id}/roles`)
        .set(auth(admin.accessToken))
        .send({ roleIds: [await getRoleId('admin')] })
        .expect(400);
    });
  });

  describe('PUT /users/:id/roles', () => {
    it('applies new permissions immediately, without a new token', async () => {
      const admin = await createUserAndLogin(app, { roles: ['admin'] });
      const user = await createUserAndLogin(app);

      await request(app).get(api).set(auth(user.accessToken)).expect(403);

      await request(app)
        .put(`${api}/${user.id}/roles`)
        .set(auth(admin.accessToken))
        .send({ roleIds: [await getRoleId('admin')] })
        .expect(200);

      await request(app).get(api).set(auth(user.accessToken)).expect(200);
    });

    it('supports multiple roles', async () => {
      const superAdmin = await createUserAndLogin(app, { roles: ['super_admin'] });
      const user = await createUser();

      const res = await request(app)
        .put(`${api}/${user.id}/roles`)
        .set(auth(superAdmin.accessToken))
        .send({ roleIds: [await getRoleId('user'), await getRoleId('admin')] })
        .expect(200);
      expect(res.body.data.roles).toHaveLength(2);
    });
  });

  describe('POST /users', () => {
    it('creates a user with the default role', async () => {
      const admin = await createUserAndLogin(app, { roles: ['admin'] });

      const res = await request(app)
        .post(api)
        .set(auth(admin.accessToken))
        .send({ name: 'New', email: 'new@example.com', password: 'Passw0rd!' })
        .expect(201);
      expect(res.body.data.roles.map((r: { name: string }) => r.name)).toEqual(['user']);
    });
  });

  describe('DELETE /users/:id', () => {
    it('soft deletes the user and revokes their access', async () => {
      const admin = await createUserAndLogin(app, { roles: ['admin'] });
      const user = await createUserAndLogin(app);

      await request(app).delete(`${api}/${user.id}`).set(auth(admin.accessToken)).expect(204);

      await request(app).get('/api/v1/auth/me').set(auth(user.accessToken)).expect(401);
      await request(app).get(`${api}/${user.id}`).set(auth(admin.accessToken)).expect(404);
      await request(app)
        .post('/api/v1/auth/login')
        .send({ email: user.email, password: user.password })
        .expect(401);
    });

    it('prevents users from deleting themselves', async () => {
      const admin = await createUserAndLogin(app, { roles: ['admin'] });
      await request(app).delete(`${api}/${admin.id}`).set(auth(admin.accessToken)).expect(400);
    });
  });
});
