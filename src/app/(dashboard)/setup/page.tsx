export const dynamic = 'force-dynamic';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { RoleGate } from '@/components/layout/RoleGate';
import { SetupClient } from './setup-client';
import { fetchBandsWithMetrics } from '@/lib/band-utils';
import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Set Up Bands & Quotas | Hrudhayam LIVE',
};

export default async function SetupPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const adminClient = createAdminClient();

  const { data: profile } = await adminClient
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!profile || !profile.is_active) {
    redirect('/onboard');
  }

  // Fetch bands with live sales metrics & reserved pools with entries
  const [bands, poolsRes] = await Promise.all([
    fetchBandsWithMetrics(adminClient),
    adminClient
      .from('reserved_pools')
      .select('*, entries:reserved_entries(*)')
      .order('display_order', { ascending: true }),
  ]);

  const pools = poolsRes.data || [];

  return (
    <RoleGate allowedRoles={['super_admin', 'system_admin']}>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Set Up Bands & Reserved Quotas
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Configure total capacities, standard pricing, and reserved pools for VIPs & event staff.
          </p>
        </div>

        <SetupClient 
          initialBands={bands} 
          initialPools={pools}
          userRole={profile.role || 'sub_admin'} 
        />
      </div>
    </RoleGate>
  );
}
