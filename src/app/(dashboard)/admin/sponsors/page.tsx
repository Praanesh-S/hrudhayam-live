export const dynamic = 'force-dynamic';

import { requireSuperOrSystemAdmin } from '@/lib/auth/guards';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchAllSeats } from '@/lib/seat-utils';
import { SponsorClient } from './sponsor-client';

export const metadata = {
  title: 'Corporate Sponsors | Hrudhayam LIVE',
};

export default async function SponsorsPage() {
  const user = await requireSuperOrSystemAdmin();
  const adminClient = createAdminClient();

  // Fetch sponsors with member info, active members for the dropdown, and all venue seats
  const [sponsorsRes, membersRes, seats] = await Promise.all([
    adminClient
      .from('sponsors')
      .select('*, brought_by_member:members(id, full_name, group_id, group:groups(name)), payment:payments(*)')
      .order('created_at', { ascending: false }),
    adminClient
      .from('members')
      .select('id, full_name, group_id, group:groups(name)')
      .eq('is_active', true)
      .order('full_name'),
    fetchAllSeats(adminClient),
  ]);

  const sponsors = sponsorsRes.data || [];
  const members = membersRes.data || [];

  return (
    <SponsorClient 
      sponsors={sponsors} 
      members={members}
      seats={seats || []}
      currentUser={user}
    />
  );
}
