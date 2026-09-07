'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { requireSuperOrSystemAdmin } from '@/lib/auth/guards';
import { logAudit } from '@/lib/audit';
import { revalidatePath } from 'next/cache';

/**
 * Super Admin Prize Snapshot (§19.8).
 * Takes an immutable named and timestamped snapshot of the live leaderboard.
 */
export async function takePrizeSnapshot(name: string) {
  try {
    const user = await requireSuperOrSystemAdmin();
    const adminClient = createAdminClient();

    if (!name || !name.trim()) {
      return { success: false, error: 'Snapshot name is required (e.g., "Grand Finale Freeze").' };
    }

    // 1. Fetch live members & groups
    const [{ data: members }, { data: groups }, { data: passes }, { data: sponsors }] = await Promise.all([
      adminClient.from('members').select('id, full_name, group_id, is_group_admin, is_active').eq('is_active', true),
      adminClient.from('groups').select('id, name'),
      adminClient.from('passes').select('seller_member_id, status, source, payments(amount, status)').neq('status', 'cancelled'),
      adminClient.from('sponsors').select('brought_by_member_id, amount, status'),
    ]);

    const groupMap = new Map((groups || []).map((g) => [g.id, g.name]));

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

    // 2. Aggregate per member (exclude participating clubs per R7)
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

    // Build Individual Leaderboard
    const individual = (members || []).map((m) => {
      const stats = memberStats.get(m.id) || { ticketsCount: 0, ticketsAmount: 0, sponsorsAmount: 0 };
      const totalRaised = stats.ticketsAmount + stats.sponsorsAmount;
      return {
        member_id: m.id,
        member_name: m.full_name,
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

    // Build Group Leaderboard
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

    const groupList = (groups || []).map((g) => {
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

    groupList.sort((a, b) => b.total_raised - a.total_raised || b.tickets_count - a.tickets_count);
    groupList.forEach((item, index) => (item.rank = index + 1));

    const snapshotPayload = {
      taken_at: new Date().toISOString(),
      individual,
      groups: groupList,
    };

    // Save snapshot
    const { data: snapshot, error: insertError } = await adminClient
      .from('leaderboard_snapshots')
      .insert({
        name: name.trim(),
        snapshot_data: snapshotPayload,
        taken_by_user_id: user.id,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    await logAudit(user.id, 'PRIZE_SNAPSHOT', 'leaderboard_snapshots', snapshot.id, {
      name: snapshot.name,
      top_member: individual[0]?.member_name,
      top_group: groupList[0]?.group_name,
    });

    revalidatePath('/leaderboard');
    return { success: true, snapshot };
  } catch (err: any) {
    console.error('Error taking prize snapshot:', err);
    return { success: false, error: err.message || 'Failed to capture snapshot.' };
  }
}
