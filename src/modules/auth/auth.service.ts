import type { AuthContextService } from '@/common/auth';
import { DEFAULT_ROLE } from '@/common/constants/roles';
import { BadRequestError, ConflictError, ForbiddenError, UnauthorizedError } from '@/common/errors';
import type { PasswordHasher } from '@/lib/password';
import type { RoleRepository } from '@/modules/role/role.repository';
import { toUserResponse } from '@/modules/user/user.mapper';
import type { UserRepository } from '@/modules/user/user.repository';

import type {
  AuthResult,
  ChangePasswordInput,
  CurrentUser,
  LoginInput,
  RegisterInput,
} from './auth.schema';
import type { AuthTokens, ClientInfo, TokenService } from './token.service';

export class AuthService {
  /** Hash used to keep login timing constant when the email doesn't exist. */
  private dummyPasswordHash?: Promise<string>;

  constructor(
    private readonly users: UserRepository,
    private readonly roles: RoleRepository,
    private readonly tokens: TokenService,
    private readonly authContext: AuthContextService,
    private readonly passwordHasher: PasswordHasher,
  ) {}

  async register(input: RegisterInput, client: ClientInfo): Promise<AuthResult> {
    if (await this.users.existsByEmail(input.email)) {
      throw new ConflictError('Email is already registered');
    }

    const defaultRole = await this.roles.findByName(DEFAULT_ROLE);
    if (!defaultRole) {
      // A deployment problem, not a client error → 500 (and logged).
      throw new Error(`Default role "${DEFAULT_ROLE}" is missing. Run \`npm run db:seed\`.`);
    }

    const user = await this.users.create({
      name: input.name,
      email: input.email,
      passwordHash: await this.passwordHasher.hash(input.password),
      roleIds: [defaultRole.id],
    });

    const tokens = await this.tokens.issue(user, client);
    return { user: toUserResponse(user), tokens };
  }

  async login(input: LoginInput, client: ClientInfo): Promise<AuthResult> {
    const user = await this.users.findByEmailWithPassword(input.email);

    // Always run the (slow) hash verification, even for unknown emails, so attackers can't
    // discover registered emails by measuring response times.
    const hash = user?.passwordHash ?? (await this.getDummyPasswordHash());
    const isPasswordValid = await this.passwordHasher.verify(hash, input.password);

    if (!user || !isPasswordValid) throw new UnauthorizedError('Invalid email or password');
    if (!user.isActive) throw new ForbiddenError('Your account has been deactivated');

    await this.users.updateLastLoginAt(user.id);
    const tokens = await this.tokens.issue(user, client);
    return { user: toUserResponse(user), tokens };
  }

  /** Exchanges a refresh token for a new token pair (rotation). */
  async refresh(refreshToken: string, client: ClientInfo): Promise<AuthTokens> {
    const result = await this.tokens.consume(refreshToken);

    if (result.status === 'reused') {
      // Reuse means the token leaked. Kill every session so the attacker is locked out too.
      await this.revokeAllSessions(result.userId);
      throw new UnauthorizedError('Refresh token reuse detected. All sessions have been revoked');
    }

    const user = await this.users.findById(result.userId);
    if (!user?.isActive) throw new UnauthorizedError('Invalid refresh token');

    return this.tokens.issue(user, client);
  }

  /** Ends the session that owns this refresh token. */
  async logout(refreshToken: string): Promise<void> {
    await this.tokens.revoke(refreshToken);
  }

  /** Ends every session of the user, on every device. */
  async logoutAll(userId: string): Promise<void> {
    await this.revokeAllSessions(userId);
  }

  async getCurrentUser(userId: string): Promise<CurrentUser> {
    const [user, context] = await Promise.all([
      this.users.findById(userId),
      this.authContext.get(userId),
    ]);
    if (!user || !context) throw new UnauthorizedError();

    return { ...toUserResponse(user), permissions: context.permissions };
  }

  /** Changes the password, signs out every other session, and returns fresh tokens. */
  async changePassword(
    userId: string,
    input: ChangePasswordInput,
    client: ClientInfo,
  ): Promise<AuthTokens> {
    const user = await this.users.findByIdWithPassword(userId);
    if (!user) throw new UnauthorizedError();

    if (!(await this.passwordHasher.verify(user.passwordHash, input.currentPassword))) {
      throw new BadRequestError('Current password is incorrect');
    }
    if (input.currentPassword === input.newPassword) {
      throw new BadRequestError('New password must be different from the current password');
    }

    const updated = await this.users.updatePassword(
      userId,
      await this.passwordHasher.hash(input.newPassword),
    );
    await this.tokens.revokeAllForUser(userId);
    await this.authContext.invalidate(userId);

    return this.tokens.issue(updated, client);
  }

  private async revokeAllSessions(userId: string): Promise<void> {
    await this.tokens.revokeAllForUser(userId);
    await this.users.incrementTokenVersion(userId);
    await this.authContext.invalidate(userId);
  }

  private getDummyPasswordHash(): Promise<string> {
    this.dummyPasswordHash ??= this.passwordHasher.hash('dummy-password-for-timing-safety');
    return this.dummyPasswordHash;
  }
}
