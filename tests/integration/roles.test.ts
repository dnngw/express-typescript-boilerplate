import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '@/app';

import { createUser, createUserAndLogin, getRoleId } from '../helpers/factories';

const app = createApp();
const api = '/api/v1/roles';
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

describe('Roles', () => {
  it('lists roles and permissions for users with role:read', async () => {
    const admin = await createUserAndLogin(app, { roles: ['admin'] });

    const roles = await request(app).get(api).set(auth(admin.accessToken)).expect(200);
    expect(roles.body.data.map((r: { name: string }) => r.name)).toEqual(
      expect.arrayContaining(['super_admin', 'admin', 'user']),
    );

    const permissions = await request(app)
      .get('/api/v1/permissions')
      .set(auth(admin.accessToken))
      .expect(200);
    expect(permissions.body.data.map((p: { key: string }) => p.key)).toContain('user:read');
  });

  it('forbids creating roles without role:create', async () => {
    const admin = await createUserAndLogin(app, { roles: ['admin'] });
    await request(app).post(api).set(auth(admin.accessToken)).send({ name: 'editor' }).expect(403);
  });

  it('creates a custom role whose permission changes apply immediately', async () => {
    const superAdmin = await createUserAndLogin(app, { roles: ['super_admin'] });
    const editor = await createUserAndLogin(app);

    const role = await request(app)
      .post(api)
      .set(auth(superAdmin.accessToken))
      .send({ name: 'editor', permissions: ['user:read'] })
      .expect(201);
    expect(role.body.data).toMatchObject({ name: 'editor', isSystem: false });

    await request(app)
      .put(`/api/v1/users/${editor.id}/roles`)
      .set(auth(superAdmin.accessToken))
      .send({ roleIds: [role.body.data.id] })
      .expect(200);
    await request(app).get('/api/v1/users').set(auth(editor.accessToken)).expect(200);

    // Revoke the permission from the role: the editor loses access on the next request.
    await request(app)
      .patch(`${api}/${role.body.data.id}`)
      .set(auth(superAdmin.accessToken))
      .send({ permissions: [] })
      .expect(200);
    await request(app).get('/api/v1/users').set(auth(editor.accessToken)).expect(403);
  });

  it('rejects duplicate role names', async () => {
    const superAdmin = await createUserAndLogin(app, { roles: ['super_admin'] });
    await request(app)
      .post(api)
      .set(auth(superAdmin.accessToken))
      .send({ name: 'admin' })
      .expect(409);
  });

  it('protects system roles', async () => {
    const superAdmin = await createUserAndLogin(app, { roles: ['super_admin'] });
    const userRoleId = await getRoleId('user');
    const superAdminRoleId = await getRoleId('super_admin');

    await request(app).delete(`${api}/${userRoleId}`).set(auth(superAdmin.accessToken)).expect(400);
    await request(app)
      .patch(`${api}/${userRoleId}`)
      .set(auth(superAdmin.accessToken))
      .send({ name: 'member' })
      .expect(400);
    await request(app)
      .patch(`${api}/${superAdminRoleId}`)
      .set(auth(superAdmin.accessToken))
      .send({ permissions: ['user:read'] })
      .expect(400);
  });

  it('refuses to delete a role that is still assigned', async () => {
    const superAdmin = await createUserAndLogin(app, { roles: ['super_admin'] });
    const role = await request(app)
      .post(api)
      .set(auth(superAdmin.accessToken))
      .send({ name: 'temp' })
      .expect(201);
    const user = await createUser();
    await request(app)
      .put(`/api/v1/users/${user.id}/roles`)
      .set(auth(superAdmin.accessToken))
      .send({ roleIds: [role.body.data.id] })
      .expect(200);

    await request(app)
      .delete(`${api}/${role.body.data.id}`)
      .set(auth(superAdmin.accessToken))
      .expect(409);
  });
});
