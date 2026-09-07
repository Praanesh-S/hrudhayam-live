export const dynamic = 'force-dynamic';

import { getSessionUser } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchBandsWithMetrics } from '@/lib/band-utils';
import { fetchAllSeats } from '@/lib/seat-utils';
import { BandsClient } from './bands-client';

export const metadata = {
  title: 'Bands & Seating Blueprint | Admin Console',
};

export default async function AdminBandsPage() {
  const user = await getSessionUser();
  if (!user || (user.role !== 'super_admin' && user.role !== 'system_admin')) {
    redirect('/dashboard');
  }

  const adminClient = createAdminClient();

  const [bands, protectedRes, seats, rowsRes] = await Promise.all([
    fetchBandsWithMetrics(adminClient),
    adminClient.from('protected_blocks').select('*').order('created_at'),
    fetchAllSeats(adminClient),
    adminClient.from('rows').select('*').order('section').order('display_order'),
  ]);

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto pb-16">
      <BandsClient
        bands={bands}
        protectedBlocks={protectedRes.data || []}
        seats={seats || []}
        rows={rowsRes.data || []}
        currentUser={user}
      />
    </div>
  );
}
