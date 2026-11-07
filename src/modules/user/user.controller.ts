import type { Request, Response } from 'express';

import { getAuthUser } from '@/common/auth';
import { created, noContent, ok } from '@/common/utils/response';
import { parseRequest } from '@/common/utils/validation';

import {
  assignRolesSchema,
  createUserSchema,
  listUsersSchema,
  updateUserSchema,
  userIdSchema,
} from './user.schema';
import type { UserService } from './user.service';

export class UserController {
  constructor(private readonly userService: UserService) {}

  list = async (req: Request, res: Response): Promise<void> => {
    const { query } = parseRequest(listUsersSchema, req);
    const { items, meta } = await this.userService.list(query);
    ok(res, items, meta);
  };

  getById = async (req: Request, res: Response): Promise<void> => {
    const { params } = parseRequest(userIdSchema, req);
    ok(res, await this.userService.getById(getAuthUser(req), params.id));
  };

  create = async (req: Request, res: Response): Promise<void> => {
    const { body } = parseRequest(createUserSchema, req);
    created(res, await this.userService.create(getAuthUser(req), body));
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const { params, body } = parseRequest(updateUserSchema, req);
    ok(res, await this.userService.update(getAuthUser(req), params.id, body));
  };

  delete = async (req: Request, res: Response): Promise<void> => {
    const { params } = parseRequest(userIdSchema, req);
    await this.userService.delete(getAuthUser(req), params.id);
    noContent(res);
  };

  assignRoles = async (req: Request, res: Response): Promise<void> => {
    const { params, body } = parseRequest(assignRolesSchema, req);
    ok(res, await this.userService.assignRoles(getAuthUser(req), params.id, body.roleIds));
  };
}
