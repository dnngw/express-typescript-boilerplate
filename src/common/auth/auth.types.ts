/** Snapshot of everything needed to authorize a user, cached per user id. */
export interface AuthContext {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
  tokenVersion: number;
  roles: string[];
  permissions: string[];
}

/** The authenticated user, available as `req.user` after the `authenticate` middleware. */
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  roles: readonly string[];
  permissions: ReadonlySet<string>;
}
