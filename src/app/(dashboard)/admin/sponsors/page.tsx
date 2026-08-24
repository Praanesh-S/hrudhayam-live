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

  // Fetch all sponsors
  const { data: sponsorsData } = await adminClient
    .from('sponsors')
    .select('*')
    .order('created_at', { ascending: false });

  // Fetch all seats to check sponsor tagging
  const seats = await fetchAllSeats(adminClient);

  return (
    <RoleGate allowedRoles={['super_admin']}>
      <SponsorClient 
        sponsors={sponsorsData || []} 
        seats={seats} 
      />
    </RoleGate>
  );
}
