export const dynamic = 'force-dynamic';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { RoleGate } from '@/components/layout/RoleGate';
import { SponsorClient } from './sponsor-client';

export const metadata = {
  title: 'Sponsors | Hrudhayam LIVE',
};

export default async function SponsorsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const adminClient = createAdminClient();

  // Fetch sponsors and sales in parallel
  const [sponsorsRes, salesRes] = await Promise.all([
    adminClient
      .from('sponsors')
      .select('*')
      .order('created_at', { ascending: false }),
    adminClient
      .from('sales')
      .select('*, band:bands(name, standard_price)')
      .eq('cancelled', false)
  ]);

  const sponsorsData = sponsorsRes.data || [];
  const sales = salesRes.data || [];

  return (
    <RoleGate allowedRoles={['super_admin', 'system_admin']}>
      <SponsorClient 
        sponsors={sponsorsData || []} 
        sales={sales as any} 
      />
    </RoleGate>
  );
}
