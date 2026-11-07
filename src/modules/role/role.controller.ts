import type { Request, Response } from 'express';

import { getAuthUser } from '@/common/auth';
import { created, noContent, ok } from '@/common/utils/response';
import { parseRequest } from '@/common/utils/validation';

import { createRoleSchema, roleIdSchema, updateRoleSchema } from './role.schema';
import type { RoleService } from './role.service';

export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  list = async (_req: Request, res: Response): Promise<void> => {
    ok(res, await this.roleService.list());
  };

  getById = async (req: Request, res: Response): Promise<void> => {
    const { params } = parseRequest(roleIdSchema, req);
    ok(res, await this.roleService.getById(params.id));
  };

  create = async (req: Request, res: Response): Promise<void> => {
    const { body } = parseRequest(createRoleSchema, req);
    created(res, await this.roleService.create(getAuthUser(req), body));
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const { params, body } = parseRequest(updateRoleSchema, req);
    ok(res, await this.roleService.update(getAuthUser(req), params.id, body));
  };

  delete = async (req: Request, res: Response): Promise<void> => {
    const { params } = parseRequest(roleIdSchema, req);
    await this.roleService.delete(getAuthUser(req), params.id);
    noContent(res);
  };

  listPermissions = async (_req: Request, res: Response): Promise<void> => {
    ok(res, await this.roleService.listPermissions());
  };
}
