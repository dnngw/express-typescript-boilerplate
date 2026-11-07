import {
  assertHoldsPermissions,
  type AuthContextService,
  type AuthUser,
  hasPermission,
} from '@/common/auth';
import { PERMISSIONS } from '@/common/constants/permissions';
import { DEFAULT_ROLE } from '@/common/constants/roles';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '@/common/errors';
import { buildPaginationMeta, type Paginated, toSkipTake } from '@/common/utils/pagination';
import type { PasswordHasher } from '@/lib/password';
import { getRolePermissionKeys } from '@/modules/role/role.mapper';
import type { RoleRepository } from '@/modules/role/role.repository';

import { toUserResponse } from './user.mapper';
import type { UserRecord, UserRepository } from './user.repository';
import type { CreateUserInput, ListUsersQuery, UpdateUserInput, UserResponse } from './user.schema';

export interface UserServiceOptions {
  /** When `false`, every user must have exactly one role. */
  allowMultipleRoles: boolean;
}

/**
 * Authorization happens on two levels:
 * 1. Route level (`authorize(...)`): "may this user do this action at all?"
 * 2. Here, per record: "may this user do it to *this* user?" (ownership, privilege level)
 */
export class UserService {
  constructor(
    private readonly users: UserRepository,
    private readonly roles: RoleRepository,
    private readonly authContext: AuthContextService,
    private readonly passwordHasher: PasswordHasher,
    private readonly options: UserServiceOptions,
  ) {}

  async list(query: ListUsersQuery): Promise<Paginated<UserResponse>> {
    const { items, total } = await this.users.findMany({
      ...toSkipTake(query),
      search: query.search,
      roleName: query.role,
      isActive: query.isActive,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    });

    return { items: items.map(toUserResponse), meta: buildPaginationMeta(query, total) };
  }

  /** Users can always see themselves; seeing others requires `user:read`. */
  async getById(actor: AuthUser, id: string): Promise<UserResponse> {
    if (actor.id !== id && !hasPermission(actor, PERMISSIONS.USER_READ)) {
      throw new ForbiddenError();
    }
    return toUserResponse(await this.findOrThrow(id));
  }

  async create(actor: AuthUser, input: CreateUserInput): Promise<UserResponse> {
    if (await this.users.existsByEmail(input.email)) {
      throw new ConflictError('Email is already registered');
    }

    let roleIds: string[];
    if (input.roleIds) {
      if (!hasPermission(actor, PERMISSIONS.ROLE_ASSIGN)) {
        throw new ForbiddenError('Assigning roles requires the role:assign permission');
      }
      roleIds = await this.resolveAssignableRoles(actor, input.roleIds);
    } else {
      roleIds = [await this.getDefaultRoleId()];
    }

    const user = await this.users.create({
      name: input.name,
      email: input.email,
      passwordHash: await this.passwordHasher.hash(input.password),
      isActive: input.isActive,
      roleIds,
    });
    return toUserResponse(user);
  }

  /** Users can edit their own name; editing others or the account status needs `user:update`. */
  async update(actor: AuthUser, id: string, input: UpdateUserInput): Promise<UserResponse> {
    const isSelf = actor.id === id;
    const canUpdateAnyone = hasPermission(actor, PERMISSIONS.USER_UPDATE);

    if (!isSelf && !canUpdateAnyone) throw new ForbiddenError();
    if (input.isActive !== undefined) {
      if (!canUpdateAnyone) throw new ForbiddenError('You cannot change the account status');
      if (isSelf) throw new BadRequestError('You cannot change your own account status');
    }

    await this.findOrThrow(id);
    if (!isSelf) await this.assertCanManage(actor, id);

    const user = await this.users.update(id, { name: input.name, isActive: input.isActive });
    await this.authContext.invalidate(id);
    return toUserResponse(user);
  }

  async delete(actor: AuthUser, id: string): Promise<void> {
    if (actor.id === id) throw new BadRequestError('You cannot delete your own account');

    await this.findOrThrow(id);
    await this.assertCanManage(actor, id);

    await this.users.softDelete(id);
    await this.authContext.invalidate(id);
  }

  async assignRoles(actor: AuthUser, id: string, roleIds: string[]): Promise<UserResponse> {
    if (actor.id === id) throw new BadRequestError('You cannot change your own roles');

    await this.findOrThrow(id);
    await this.assertCanManage(actor, id);
    const validRoleIds = await this.resolveAssignableRoles(actor, roleIds);

    const user = await this.users.replaceRoles(id, validRoleIds);
    await this.authContext.invalidate(id);
    return toUserResponse(user);
  }

  private async findOrThrow(id: string): Promise<UserRecord> {
    const user = await this.users.findById(id);
    if (!user) throw new NotFoundError('User not found');
    return user;
  }

  /** You can't manage a user who holds permissions you don't have (e.g. admin → super admin). */
  private async assertCanManage(actor: AuthUser, targetId: string): Promise<void> {
    const target = await this.authContext.get(targetId);
    if (!target) throw new NotFoundError('User not found');
    assertHoldsPermissions(
      actor,
      target.permissions,
      'You cannot manage a user with permissions you do not have',
    );
  }

  /** Validates role ids: they must exist, respect the single/multi role setting, and not escalate. */
  private async resolveAssignableRoles(actor: AuthUser, roleIds: string[]): Promise<string[]> {
    if (!this.options.allowMultipleRoles && roleIds.length !== 1) {
      throw new BadRequestError('A user must have exactly one role');
    }

    const roles = await this.roles.findManyByIds(roleIds);
    if (roles.length !== roleIds.length) {
      throw new BadRequestError('One or more roles do not exist');
    }

    assertHoldsPermissions(
      actor,
      roles.flatMap(getRolePermissionKeys),
      'You cannot assign a role with permissions you do not have',
    );
    return roleIds;
  }

  private async getDefaultRoleId(): Promise<string> {
    const role = await this.roles.findByName(DEFAULT_ROLE);
    if (!role)
      throw new Error(`Default role "${DEFAULT_ROLE}" is missing. Run \`npm run db:seed\`.`);
    return role.id;
  }
}
