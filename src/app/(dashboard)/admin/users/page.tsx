export const dynamic = 'force-dynamic';

import { getSessionUser } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { UsersClient } from './users-client';

export const metadata = {
  title: 'Groups, Members & Logins | Admin Console',
};

export default async function AdminUsersPage() {
  const user = await getSessionUser();
  if (!user || (user.role !== 'super_admin' && user.role !== 'system_admin')) {
    redirect('/dashboard');
  }

  const adminClient = createAdminClient();

  // Fetch groups, members, and user logins
  const [{ data: groups }, { data: members }, { data: systemUsers }] = await Promise.all([
    adminClient.from('groups').select('*').order('id', { ascending: true }),
    adminClient.from('members').select('*').order('group_id', { ascending: true }).order('id', { ascending: true }),
    adminClient
      .from('users')
      .select('id, login_id, role, full_name, member_id, is_active, must_change_password, created_at, updated_at')
      .order('created_at', { ascending: true }),
  ]);

  return (
    <UsersClient
      groups={groups || []}
      members={members || []}
      initialUsers={systemUsers || []}
      currentUser={user}
    />
  );
}
