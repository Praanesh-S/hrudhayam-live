export const dynamic = 'force-dynamic';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { RoleGate } from '@/components/layout/RoleGate';
import { GuestsClient } from './guests-client';
import { fetchBandsWithMetrics } from '@/lib/band-utils';
import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Team Sales & Passes | Hrudhayam LIVE',
};

export default async function GuestsPage() {
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

  // Open team visibility: Fetch all sales, bands, and active profiles in parallel
  const [salesRes, bands, teamRes] = await Promise.all([
    adminClient
      .from('sales')
      .select('*, band:bands(name, standard_price), seller:profiles!sales_sold_by_fkey(full_name, email)')
      .order('created_at', { ascending: false }),
    fetchBandsWithMetrics(adminClient),
    adminClient
      .from('profiles')
      .select('*')
      .eq('is_active', true)
      .order('full_name'),
  ]);

  const sales = salesRes.data || [];
  const teamMembers = teamRes.data || [];

  return (
    <RoleGate allowedRoles={['super_admin', 'sub_admin', 'system_admin']}>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Team Sales & Passes
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Complete transparent list of all donor sales, payment collections, and issued WhatsApp & printed passes.
          </p>
        </div>

        <GuestsClient 
          initialSales={sales} 
          bands={bands}
          teamMembers={teamMembers}
          currentUser={profile}
        />
      </div>
    </RoleGate>
  );
}
