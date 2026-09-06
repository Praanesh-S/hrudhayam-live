'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { verifyPassword, hashPassword } from '@/lib/auth/password';
import { createSession, destroySession, getSessionUser } from '@/lib/auth/session';
import { logAudit } from '@/lib/audit';
import { redirect } from 'next/navigation';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

/**
 * Handle user login with login_id (phone or username) and password.
 */
export async function loginAction(formData: FormData) {
  const loginId = (formData.get('loginId') as string)?.trim();
  const password = formData.get('password') as string;

  if (!loginId || !password) {
    return { error: 'Please enter both Login ID and Password.' };
  }

  const adminClient = createAdminClient();

  // 1. Rate Limiting Check (lock after 5 failed attempts in last 15 minutes)
  const lockoutThreshold = new Date(Date.now() - LOCKOUT_MINUTES * 60 * 1000).toISOString();
  const { data: recentAttempts } = await adminClient
    .from('login_attempts')
    .select('id, success')
    .eq('login_id', loginId)
    .gt('attempted_at', lockoutThreshold)
    .order('attempted_at', { ascending: false });

  if (recentAttempts && recentAttempts.length >= MAX_FAILED_ATTEMPTS) {
    const failedStreak = recentAttempts.slice(0, MAX_FAILED_ATTEMPTS).filter(a => !a.success).length;
    if (failedStreak >= MAX_FAILED_ATTEMPTS) {
      return { 
        error: `Too many failed attempts. Account temporarily locked. Please try again after ${LOCKOUT_MINUTES} minutes.` 
      };
    }
  }

  // 2. Fetch User
  const { data: user, error: userError } = await adminClient
    .from('users')
    .select('id, login_id, password_hash, role, must_change_password, is_active')
    .eq('login_id', loginId)
    .maybeSingle();

  if (userError || !user) {
    // Record failed attempt
    await adminClient.from('login_attempts').insert({
      login_id: loginId,
      success: false,
    });
    return { error: 'Invalid login ID or password.' };
  }

  if (!user.is_active) {
    return { error: 'This account has been deactivated. Please contact the System Admin.' };
  }

  // 3. Verify Password
  const isValid = await verifyPassword(password, user.password_hash);
  if (!isValid) {
    await adminClient.from('login_attempts').insert({
      login_id: loginId,
      success: false,
    });
    return { error: 'Invalid login ID or password.' };
  }

  // Record successful login
  await adminClient.from('login_attempts').insert({
    login_id: loginId,
    success: true,
  });

  // 4. Create Session
  await createSession(user.id);

  // 5. Audit Log
  await logAudit(user.id, 'LOGIN', 'users', user.id, { login_id: user.login_id, role: user.role });

  if (user.must_change_password) {
    return { success: true, mustChangePassword: true };
  }

  redirect('/dashboard');
}

/**
 * Handle initial or mandatory password change.
 */
export async function setInitialPasswordAction(formData: FormData) {
  const user = await getSessionUser();
  if (!user) {
    return { error: 'Session expired. Please sign in again.' };
  }

  const newPassword = formData.get('newPassword') as string;
  const confirmPassword = formData.get('confirmPassword') as string;

  if (!newPassword || newPassword.length < 6) {
    return { error: 'Password must be at least 6 characters long.' };
  }

  if (newPassword !== confirmPassword) {
    return { error: 'Passwords do not match.' };
  }

  const newHash = await hashPassword(newPassword);
  const adminClient = createAdminClient();

  const { error: updateError } = await adminClient
    .from('users')
    .update({
      password_hash: newHash,
      must_change_password: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id);

  if (updateError) {
    console.error('Failed to update password:', updateError);
    return { error: 'Could not update password. Please try again.' };
  }

  await logAudit(user.id, 'PASSWORD_CHANGE', 'users', user.id, { login_id: user.loginId });

  redirect('/dashboard');
}

/**
 * Log out and clear session.
 */
export async function logoutAction() {
  await destroySession();
  redirect('/login');
}
