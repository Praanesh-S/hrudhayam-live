import { getSessionUser, AuthUser } from './session';

export class AuthError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 401) {
    super(message);
    this.name = 'AuthError';
    this.statusCode = statusCode;
  }
}

/**
 * Requires an active logged-in user.
 */
export async function requireUser(): Promise<AuthUser> {
  const user = await getSessionUser();
  if (!user) {
    throw new AuthError('Authentication required. Please sign in.', 401);
  }
  return user;
}

/**
 * Requires System Admin role specifically (Rule R3: cancellations & moves).
 */
export async function requireSystemAdmin(): Promise<AuthUser> {
  const user = await requireUser();
  if (user.role !== 'system_admin' && user.role !== 'super_admin') {
    throw new AuthError('Access denied. Super Admin or System Admin authority required for this operation.', 403);
  }
  return user;
}

/**
 * Requires Super Admin or System Admin role.
 */
export async function requireSuperOrSystemAdmin(): Promise<AuthUser> {
  const user = await requireUser();
  if (user.role !== 'super_admin' && user.role !== 'system_admin') {
    throw new AuthError('Access denied. Super Admin or System Admin authority required.', 403);
  }
  return user;
}

/**
 * Requires Group Admin role (or Super/System Admin acting on admin screens).
 */
export async function requireGroupAdmin(): Promise<AuthUser> {
  const user = await requireUser();
  if (user.role !== 'group_admin' && user.role !== 'super_admin' && user.role !== 'system_admin') {
    throw new AuthError('Access denied. Group Admin privileges required.', 403);
  }
  return user;
}
