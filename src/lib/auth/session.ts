import { cookies } from 'next/headers';
import crypto from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';

export const SESSION_COOKIE_NAME = 'hl_session';
export const SESSION_DURATION_DAYS = 14;

export interface AuthUser {
  id: string;
  loginId: string;
  role: 'super_admin' | 'system_admin' | 'group_admin';
  mustChangePassword: boolean;
  memberId: number | null;
  fullName: string;
  groupId: number | null;
  groupName: string | null;
  phone: string | null;
}

/**
 * Creates a new database session and sets the session cookie.
 */
export async function createSession(userId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_DURATION_DAYS);

  const adminClient = createAdminClient();
  const { error } = await adminClient.from('user_sessions').insert({
    user_id: userId,
    token,
    expires_at: expiresAt.toISOString(),
  });

  if (error) {
    console.error('Failed to create session in DB:', error);
    throw new Error('Could not establish session');
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: expiresAt,
    path: '/',
  });

  return token;
}

/**
 * Retrieves the currently authenticated user from the session cookie.
 */
export async function getSessionUser(): Promise<AuthUser | null> {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (!sessionToken) {
      return null;
    }

    const adminClient = createAdminClient();

    // Fetch session and user
    const { data: sessionData, error: sessionError } = await adminClient
      .from('user_sessions')
      .select(`
        token,
        expires_at,
        users!inner (
          id,
          login_id,
          role,
          must_change_password,
          is_active,
          member_id,
          members (
            id,
            full_name,
            phone_raw,
            phone_e164,
            group_id,
            groups (
              id,
              name
            )
          )
        )
      `)
      .eq('token', sessionToken)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (sessionError || !sessionData) {
      return null;
    }

    const u = (sessionData as any).users;
    if (!u || !u.is_active) {
      return null;
    }

    const m = u.members;
    const g = m?.groups;

    return {
      id: u.id,
      loginId: u.login_id,
      role: u.role,
      mustChangePassword: !!u.must_change_password,
      memberId: u.member_id || null,
      fullName: m?.full_name || (u.login_id.toLowerCase() === 'praanesh' ? 'Praanesh S' : u.login_id),
      groupId: m?.group_id || null,
      groupName: g?.name || null,
      phone: m?.phone_e164 || m?.phone_raw || null,
    };
  } catch (err) {
    console.error('Error fetching session user:', err);
    return null;
  }
}

/**
 * Destroys the current session and clears the cookie.
 */
export async function destroySession(): Promise<void> {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (sessionToken) {
      const adminClient = createAdminClient();
      await adminClient.from('user_sessions').delete().eq('token', sessionToken);
    }

    cookieStore.delete(SESSION_COOKIE_NAME);
  } catch (err) {
    console.error('Error destroying session:', err);
  }
}
