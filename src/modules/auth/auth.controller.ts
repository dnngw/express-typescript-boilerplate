import type { Request, Response } from 'express';

import { getAuthUser } from '@/common/auth';
import { created, noContent, ok } from '@/common/utils/response';
import { parseRequest } from '@/common/utils/validation';

import {
  changePasswordSchema,
  loginSchema,
  refreshTokenSchema,
  registerSchema,
} from './auth.schema';
import type { AuthService } from './auth.service';
import type { ClientInfo } from './token.service';

function getClientInfo(req: Request): ClientInfo {
  return { userAgent: req.get('user-agent'), ipAddress: req.ip };
}

/**
 * HTTP layer only: parse/validate input → call the service → send the response.
 * No business logic lives here.
 */
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  register = async (req: Request, res: Response): Promise<void> => {
    const { body } = parseRequest(registerSchema, req);
    created(res, await this.authService.register(body, getClientInfo(req)));
  };

  login = async (req: Request, res: Response): Promise<void> => {
    const { body } = parseRequest(loginSchema, req);
    ok(res, await this.authService.login(body, getClientInfo(req)));
  };

  refresh = async (req: Request, res: Response): Promise<void> => {
    const { body } = parseRequest(refreshTokenSchema, req);
    ok(res, await this.authService.refresh(body.refreshToken, getClientInfo(req)));
  };

  logout = async (req: Request, res: Response): Promise<void> => {
    const { body } = parseRequest(refreshTokenSchema, req);
    await this.authService.logout(body.refreshToken);
    noContent(res);
  };

  logoutAll = async (req: Request, res: Response): Promise<void> => {
    await this.authService.logoutAll(getAuthUser(req).id);
    noContent(res);
  };

  me = async (req: Request, res: Response): Promise<void> => {
    ok(res, await this.authService.getCurrentUser(getAuthUser(req).id));
  };

  changePassword = async (req: Request, res: Response): Promise<void> => {
    const { body } = parseRequest(changePasswordSchema, req);
    const tokens = await this.authService.changePassword(
      getAuthUser(req).id,
      body,
      getClientInfo(req),
    );
    ok(res, tokens);
  };
}
