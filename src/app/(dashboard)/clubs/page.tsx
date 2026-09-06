export const dynamic = 'force-dynamic';

import { getSessionUser } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchBandsWithMetrics } from '@/lib/band-utils';
import { ClubsClient } from './clubs-client';

export const metadata = {
  title: 'Participating Clubs | Hrudhayam LIVE',
};

export default async function ParticipatingClubsPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');

  const adminClient = createAdminClient();

  // 1. Fetch bands for pass picker
  const bands = await fetchBandsWithMetrics(adminClient);

  // 2. Fetch all participating clubs with passes and payments
  const { data: clubsData } = await adminClient
    .from('participating_clubs')
    .select(`
      *,
      brought_by_member:members(id, full_name),
      passes(id, pass_code, band_id, status),
      payments(id, mode, amount, reference_no, status)
    `)
    .order('created_at', { ascending: false });

  // 3. Fetch active members for "invited by" dropdown
  const { data: members } = await adminClient
    .from('members')
    .select('id, full_name, group_id')
    .eq('is_active', true)
    .order('full_name');

  const clubs = clubsData || [];

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto pb-16">
      <div>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
          Participating Rotary Clubs
        </h1>
        <p className="text-slate-400 text-sm sm:text-base mt-1">
          Partner clubs contributing ₹25,000 and receiving ₹15,000 of donor passes. Ring-fenced from competition tally (Rule R7).
        </p>
      </div>

      <ClubsClient
        clubs={clubs}
        bands={bands}
        members={members || []}
        currentUser={user}
      />
    </div>
  );
}
