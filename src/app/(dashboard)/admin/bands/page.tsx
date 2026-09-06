export const dynamic = 'force-dynamic';

import { getSessionUser } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchBandsWithMetrics } from '@/lib/band-utils';
import { BandsClient } from './bands-client';

export const metadata = {
  title: 'Bands & Protected Seats | Admin Console',
};

export default async function AdminBandsPage() {
  const user = await getSessionUser();
  if (!user || (user.role !== 'super_admin' && user.role !== 'system_admin')) {
    redirect('/dashboard');
  }

  const adminClient = createAdminClient();

  const [bands, protectedRes] = await Promise.all([
    fetchBandsWithMetrics(adminClient),
    adminClient.from('protected_blocks').select('*').order('created_at'),
  ]);

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto pb-16">
      <div>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
          Bands & Protected Seats
        </h1>
        <p className="text-slate-400 text-sm sm:text-base mt-1">
          Configure sellable band allocations and manage earmarked VIP / Police / Sponsor blocks (§10).
        </p>
      </div>

      <BandsClient
        bands={bands}
        protectedBlocks={protectedRes.data || []}
        currentUser={user}
      />
    </div>
  );
}
