export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { RoleGate } from '@/components/layout/RoleGate';
import { fetchAllSeats } from '@/lib/seat-utils';
import { GroupsClient } from './groups-client';

export const metadata = {
  title: 'Group Seating | Hrudhayam LIVE',
};

export default async function GroupsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const adminClient = createAdminClient();

  const { data: profile } = await adminClient
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile || !profile.is_active) {
    redirect('/onboard');
  }

  // Fetch groups
  const { data: groupsData } = await adminClient
    .from('groups')
    .select('*')
    .order('created_at', { ascending: false });

  // Fetch seats
  const isSuperAdmin = profile.role === 'super_admin';
  const seats = await fetchAllSeats(adminClient, {
    ownerId: isSuperAdmin ? undefined : user.id,
  });

  return (
    <RoleGate allowedRoles={['super_admin', 'sub_admin']}>
      <GroupsClient 
        groups={groupsData || []} 
        seats={seats} 
        userProfile={profile} 
      />
    </RoleGate>
  );
}
