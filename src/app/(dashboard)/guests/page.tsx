export const dynamic = 'force-dynamic';

import { requireUser } from '@/lib/auth/guards';
import { createAdminClient } from '@/lib/supabase/admin';
import { GuestsClient } from './guests-client';
import { fetchAllPaginated } from '@/lib/db-utils';

export const metadata = {
  title: 'Passes Directory | Hrudhayam LIVE',
};

export default async function GuestsPage() {
  const user = await requireUser();
  const adminClient = createAdminClient();

  const [passes, bandsRes, groupsRes] = await Promise.all([
    fetchAllPaginated((from, to) =>
      adminClient
        .from('passes')
        .select(`
          *,
          band:bands(*),
          seller:members(id, full_name, group_id, group:groups(name)),
          payment:payments(*)
        `, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to)
    ),
    adminClient
      .from('bands')
      .select('*')
      .order('sort_order'),
    adminClient
      .from('groups')
      .select('*')
      .order('id'),
  ]);

  const bands = bandsRes.data || [];
  const groups = groupsRes.data || [];

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-16">
      <div>
        <h1 className="text-3xl font-black tracking-tight text-white">
          Passes & Donors Directory
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Complete transparent directory of all issued passes, payment status, WhatsApp delivery, and gate status.
        </p>
      </div>

      <GuestsClient 
        initialPasses={passes} 
        bands={bands}
        groups={groups}
        currentUser={user}
      />
    </div>
  );
}
