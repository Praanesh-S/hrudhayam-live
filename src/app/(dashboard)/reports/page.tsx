export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { RoleGate } from '@/components/layout/RoleGate';
import { fetchAllSeats } from '@/lib/seat-utils';
import { ReportsClient } from './reports-client';

export const metadata = {
  title: 'Financial & Operational Reports | Hrudhayam LIVE',
};

export default async function ReportsPage() {
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

  const isSuperAdmin = profile.role === 'super_admin';

  // Fetch all report datasets in parallel
  const [seats, teamMembersRes, sponsorsRes] = await Promise.all([
    fetchAllSeats(adminClient, {
      ownerId: isSuperAdmin ? undefined : user.id,
    }),
    adminClient
      .from('profiles')
      .select('*')
      .eq('is_active', true)
      .order('full_name'),
    adminClient
      .from('sponsors')
      .select('*')
      .order('created_at', { ascending: false })
  ]);

  const teamMembers = teamMembersRes.data || [];
  const sponsors = sponsorsRes.data || [];

  return (
    <RoleGate allowedRoles={['super_admin', 'sub_admin']}>
      <ReportsClient
        seats={seats}
        teamMembers={teamMembers || []}
        sponsors={sponsors || []}
        isSuperAdmin={isSuperAdmin}
      />
    </RoleGate>
  );
}
