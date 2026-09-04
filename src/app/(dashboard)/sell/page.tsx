export const dynamic = 'force-dynamic';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { RoleGate } from '@/components/layout/RoleGate';
import { SellClient } from './sell-client';
import { fetchBandsWithMetrics } from '@/lib/band-utils';
import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Sell Seats | Hrudhayam LIVE',
};

export default async function SellPage() {
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

  // Fetch bands with remaining counts, approvers (super & system admins), and sponsors in parallel
  const [bands, approversRes, sponsorsRes] = await Promise.all([
    fetchBandsWithMetrics(adminClient),
    adminClient
      .from('profiles')
      .select('*')
      .in('role', ['super_admin', 'system_admin'])
      .eq('is_active', true),
    adminClient
      .from('sponsors')
      .select('*')
      .order('name'),
  ]);

  const approvers = approversRes.data || [];
  const sponsors = sponsorsRes.data || [];

  return (
    <RoleGate allowedRoles={['super_admin', 'sub_admin', 'system_admin']}>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Sell Admission Passes
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Select a price band, enter donor details, and issue passes via WhatsApp or printed ticket.
          </p>
        </div>

        {profile.role === 'system_admin' ? (
          <div className="p-6 bg-[#131F2E] rounded-3xl border border-[#223345] text-center max-w-xl mx-auto space-y-3">
            <h3 className="text-lg font-bold text-white">System Admin Notice</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              As the System Administrator, you manage technical configurations, band capacities, and cancellations. Commercial sales are conducted by Sub-Admins and Super Admins.
            </p>
          </div>
        ) : (
          <SellClient 
            bands={bands} 
            approvers={approvers}
            sponsors={sponsors}
            currentUser={profile}
          />
        )}
      </div>
    </RoleGate>
  );
}
