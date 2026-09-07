export const dynamic = 'force-dynamic';

import { getSessionUser } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { LeaderboardClient } from './leaderboard-client';

export const metadata = {
  title: 'Competition Leaderboard | Hrudhayam LIVE',
};

export default async function LeaderboardPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');

  const adminClient = createAdminClient();

  // 1. Fetch members & groups
  const [{ data: members }, { data: groups }, { data: passes }, { data: sponsors }, { data: snapshots }] = await Promise.all([
    adminClient.from('members').select('id, full_name, group_id, is_group_admin, is_active').eq('is_active', true),
    adminClient.from('groups').select('id, name').order('id'),
    adminClient.from('passes').select('seller_member_id, status, source, payments(amount, status)').neq('status', 'cancelled'),
    adminClient.from('sponsors').select('brought_by_member_id, amount, status'),
    adminClient.from('leaderboard_snapshots').select('*').order('taken_at', { ascending: false }),
  ]);

  const groupMap = new Map((groups || []).map((g) => [g.id, g.name]));

  // 2. Aggregate per member (Rule R7: participating clubs excluded)
  const memberStats = new Map<number, { ticketsCount: number; ticketsAmount: number; sponsorsAmount: number }>();
  (members || []).forEach((m) => {
    memberStats.set(m.id, { ticketsCount: 0, ticketsAmount: 0, sponsorsAmount: 0 });
  });

  for (const p of passes || []) {
    if (p.source === 'participating_club' || !p.seller_member_id) continue;
    const current = memberStats.get(p.seller_member_id) || { ticketsCount: 0, ticketsAmount: 0, sponsorsAmount: 0 };
    current.ticketsCount += 1;
    const pays = (p as any).payments;
    if (Array.isArray(pays)) {
      for (const pay of pays) {
        if (pay.status === 'received') current.ticketsAmount += pay.amount || 0;
      }
    }
    memberStats.set(p.seller_member_id, current);
  }

  for (const s of sponsors || []) {
    if (!s.brought_by_member_id || s.status !== 'received') continue;
    const current = memberStats.get(s.brought_by_member_id) || { ticketsCount: 0, ticketsAmount: 0, sponsorsAmount: 0 };
    current.sponsorsAmount += s.amount || 0;
    memberStats.set(s.brought_by_member_id, current);
  }

  // Find captain for each group
  const captainMap = new Map<number, string>();
  (members || []).forEach((m) => {
    if (m.is_group_admin) {
      captainMap.set(m.group_id, m.full_name);
    }
  });

  const getTeamDisplayName = (groupId: number, fallbackName?: string) => {
    const captain = captainMap.get(groupId);
    if (captain) {
      return `Team ${groupId} — ${captain}`;
    }
    return fallbackName || `Team ${groupId}`;
  };

  // Individual standings
  const individual = (members || []).map((m) => {
    const stats = memberStats.get(m.id) || { ticketsCount: 0, ticketsAmount: 0, sponsorsAmount: 0 };
    const totalRaised = stats.ticketsAmount + stats.sponsorsAmount;
    return {
      member_id: m.id,
      member_name: m.full_name,
      is_group_admin: m.is_group_admin,
      group_id: m.group_id,
      group_name: getTeamDisplayName(m.group_id, groupMap.get(m.group_id)),
      tickets_count: stats.ticketsCount,
      tickets_amount: stats.ticketsAmount,
      sponsors_amount: stats.sponsorsAmount,
      total_raised: totalRaised,
      rank: 0,
    };
  });

  individual.sort((a, b) => b.total_raised - a.total_raised || b.tickets_count - a.tickets_count);
  individual.forEach((item, index) => (item.rank = index + 1));

  // Group standings
  const groupStats = new Map<number, { ticketsCount: number; ticketsAmount: number; sponsorsAmount: number }>();
  (groups || []).forEach((g) => {
    groupStats.set(g.id, { ticketsCount: 0, ticketsAmount: 0, sponsorsAmount: 0 });
  });

  for (const ind of individual) {
    const cur = groupStats.get(ind.group_id) || { ticketsCount: 0, ticketsAmount: 0, sponsorsAmount: 0 };
    cur.ticketsCount += ind.tickets_count;
    cur.ticketsAmount += ind.tickets_amount;
    cur.sponsorsAmount += ind.sponsors_amount;
    groupStats.set(ind.group_id, cur);
  }

  const groupStandings = (groups || []).map((g) => {
    const stats = groupStats.get(g.id) || { ticketsCount: 0, ticketsAmount: 0, sponsorsAmount: 0 };
    const totalRaised = stats.ticketsAmount + stats.sponsorsAmount;
    return {
      group_id: g.id,
      group_name: getTeamDisplayName(g.id, g.name),
      captain_name: captainMap.get(g.id) || null,
      tickets_count: stats.ticketsCount,
      tickets_amount: stats.ticketsAmount,
      sponsors_amount: stats.sponsorsAmount,
      total_raised: totalRaised,
      rank: 0,
    };
  });

  groupStandings.sort((a, b) => b.total_raised - a.total_raised || b.tickets_count - a.tickets_count);
  groupStandings.forEach((item, index) => (item.rank = index + 1));

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto pb-16">
      <div>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
          Competition Leaderboard
        </h1>
        <p className="text-slate-400 text-sm sm:text-base mt-1">
          Live fundraising competition standings across all 8 teams and 88 members.
        </p>
      </div>

      <LeaderboardClient
        individual={individual}
        groups={groupStandings}
        snapshots={snapshots || []}
        currentUser={user}
      />
    </div>
  );
}
