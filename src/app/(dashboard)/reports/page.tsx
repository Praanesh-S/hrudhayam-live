export const dynamic = 'force-dynamic';

import { requireUser } from '@/lib/auth/guards';
import { createAdminClient } from '@/lib/supabase/admin';
import { ReportsClient } from './reports-client';
import { fetchBandsWithMetrics } from '@/lib/band-utils';

export const metadata = {
  title: 'Reports & Reconciliation | Hrudhayam LIVE',
};

export default async function ReportsPage() {
  const user = await requireUser();
  const adminClient = createAdminClient();

  // Fetch all reports data in parallel
  const [bands, passesRes, groupsRes, membersRes, sponsorsRes, clubsRes] = await Promise.all([
    fetchBandsWithMetrics(adminClient),
    adminClient
      .from('passes')
      .select(`
        *,
        band:bands(*),
        seller:members(id, full_name, group_id, group:groups(name)),
        payment:payments(*)
      `)
      .order('created_at', { ascending: false }),
    adminClient
      .from('groups')
      .select('*')
      .order('id'),
    adminClient
      .from('members')
      .select('*, group:groups(name)')
      .eq('is_active', true)
      .order('full_name'),
    adminClient
      .from('sponsors')
      .select('*, brought_by_member:members(id, full_name, group_id)')
      .order('amount', { ascending: false }),
    adminClient
      .from('participating_clubs')
      .select('*, brought_by_member:members(id, full_name, group_id)')
      .order('created_at', { ascending: false }),
  ]);

  const passes = passesRes.data || [];
  const groups = groupsRes.data || [];
  const members = membersRes.data || [];
  const sponsors = sponsorsRes.data || [];
  const clubs = clubsRes.data || [];

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-16">
      <ReportsClient 
        bands={bands} 
        passes={passes}
        groups={groups}
        members={members}
        sponsors={sponsors}
        clubs={clubs}
        currentUser={user}
      />
    </div>
  );
}
