export const dynamic = 'force-dynamic';

import { getSessionUser } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchBandsWithMetrics } from '@/lib/band-utils';
import { SellClient } from './sell-client';

export const metadata = {
  title: 'Sell a Pass | Hrudhayam LIVE',
};

export default async function SellPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect('/login');
  }

  const adminClient = createAdminClient();

  // 1. Fetch bands with live remaining counts
  const bands = await fetchBandsWithMetrics(adminClient);

  // 2. Fetch eligible sellers
  // Rule R2: Group Admin only sees members of their own team!
  let membersQuery = adminClient
    .from('members')
    .select(`
      id,
      full_name,
      phone_raw,
      phone_e164,
      phone_status,
      group_id,
      is_group_admin,
      is_active,
      groups (
        id,
        name
      )
    `)
    .eq('is_active', true)
    .order('full_name');

  if (user.role === 'group_admin' && user.groupId) {
    membersQuery = membersQuery.eq('group_id', user.groupId);
  } else {
    membersQuery = membersQuery.order('group_id');
  }

  const { data: membersData } = await membersQuery;
  const eligibleSellers = membersData || [];

  // 3. Fetch active soft holds
  const { data: activeHolds } = await adminClient
    .from('soft_holds')
    .select('*, bands(label)')
    .eq('status', 'active')
    .gt('expires_at', new Date().toISOString())
    .order('expires_at', { ascending: true });

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto pb-16">
      <div>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
          Sell a Pass
        </h1>
        <p className="text-slate-400 text-sm sm:text-base mt-1">
          {user.role === 'group_admin' 
            ? `Issuing passes for ${user.groupName || 'Team'} • ${user.fullName}`
            : `Administrative Sales Console • ${user.fullName} (${user.role.replace('_', ' ').toUpperCase()})`}
        </p>
      </div>

      <SellClient
        bands={bands}
        sellers={eligibleSellers}
        currentUser={user}
        initialHolds={activeHolds || []}
      />
    </div>
  );
}
