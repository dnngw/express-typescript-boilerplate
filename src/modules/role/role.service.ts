import { assertHoldsPermissions, type AuthContextService, type AuthUser } from '@/common/auth';
import { WILDCARD_PERMISSION } from '@/common/constants/permissions';
import { BadRequestError, ConflictError, NotFoundError } from '@/common/errors';

import { getRolePermissionKeys, toRoleResponse } from './role.mapper';
import type { RoleRecord, RoleRepository } from './role.repository';
import type {
  CreateRoleInput,
  PermissionResponse,
  RoleResponse,
  UpdateRoleInput,
} from './role.schema';

export class RoleService {
  constructor(
    private readonly roles: RoleRepository,
    private readonly authContext: AuthContextService,
  ) {}

  async list(): Promise<RoleResponse[]> {
    return (await this.roles.findMany()).map(toRoleResponse);
  }

  async getById(id: string): Promise<RoleResponse> {
    return toRoleResponse(await this.findOrThrow(id));
  }

  listPermissions(): Promise<PermissionResponse[]> {
    return this.roles.findAllPermissions();
  }

  async create(actor: AuthUser, input: CreateRoleInput): Promise<RoleResponse> {
    assertHoldsPermissions(
      actor,
      input.permissions,
      'You cannot grant permissions you do not have',
    );
    await this.assertNameAvailable(input.name);

    const role = await this.roles.create({
      name: input.name,
      description: input.description,
      permissionKeys: input.permissions,
    });
    return toRoleResponse(role);
  }

  async update(actor: AuthUser, id: string, input: UpdateRoleInput): Promise<RoleResponse> {
    const role = await this.findOrThrow(id);
    const currentPermissions = getRolePermissionKeys(role);

    // You can only manage roles that are at or below your own level.
    assertHoldsPermissions(actor, currentPermissions, 'You cannot manage this role');

    if (input.name !== undefined && input.name !== role.name) {
      if (role.isSystem) throw new BadRequestError('System roles cannot be renamed');
      await this.assertNameAvailable(input.name);
    }

    if (input.permissions) {
      if (currentPermissions.includes(WILDCARD_PERMISSION)) {
        throw new BadRequestError('Permissions of a role with full access cannot be changed');
      }
      assertHoldsPermissions(
        actor,
        input.permissions,
        'You cannot grant permissions you do not have',
      );
    }

    const updated = await this.roles.update(id, {
      name: input.name,
      description: input.description,
      permissionKeys: input.permissions,
    });

    // Users holding this role must see their new permissions on the very next request.
    if (input.permissions) await this.authContext.invalidateByRole(id);

    return toRoleResponse(updated);
  }

  async delete(actor: AuthUser, id: string): Promise<void> {
    const role = await this.findOrThrow(id);

    if (role.isSystem) throw new BadRequestError('System roles cannot be deleted');
    assertHoldsPermissions(actor, getRolePermissionKeys(role), 'You cannot manage this role');
    if (role._count.users > 0) {
      throw new ConflictError(
        `Role is still assigned to ${role._count.users} user(s). Reassign them first`,
      );
    }

    await this.roles.delete(id);
  }

  private async findOrThrow(id: string): Promise<RoleRecord> {
    const role = await this.roles.findById(id);
    if (!role) throw new NotFoundError('Role not found');
    return role;
  }

  private async assertNameAvailable(name: string): Promise<void> {
    if (await this.roles.findByName(name)) {
      throw new ConflictError(`Role "${name}" already exists`);
    }
  }
}
