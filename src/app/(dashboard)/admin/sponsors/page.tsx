export const dynamic = 'force-dynamic';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { RoleGate } from '@/components/layout/RoleGate';
import { fetchAllSeats } from '@/lib/seat-utils';
import { SponsorClient } from './sponsor-client';

export const metadata = {
  title: 'Sponsors | Hrudhayam LIVE',
};

export default async function SponsorsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const adminClient = createAdminClient();

  // Fetch sponsors and seats in parallel
  const [sponsorsRes, seats] = await Promise.all([
    adminClient
      .from('sponsors')
      .select('*')
      .order('created_at', { ascending: false }),
    fetchAllSeats(adminClient)
  ]);

  const sponsorsData = sponsorsRes.data || [];

  return (
    <RoleGate allowedRoles={['super_admin']}>
      <SponsorClient 
        sponsors={sponsorsData || []} 
        seats={seats} 
      />
    </RoleGate>
  );
}
