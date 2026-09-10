import { SupabaseClient } from '@supabase/supabase-js';

export interface TeamMetric {
  groupId: number;
  groupName: string;
  coordinatorName: string;
  teamLabel: string; // "Team [X] · [Coordinator Name]"
  receivedAmount: number;
  pendingAmount: number;
  totalAmount: number;
  seatsSold: number;
}

/**
 * Fetch and calculate team-wise collections (received & pending) and seats sold.
 * Strictly respects:
 * 1. Historical pass prices (sums individual stored pass/payment prices).
 * 2. Excludes participating Rotary Club sales (source === 'participating_club').
 * 3. Attributes sales to the member's current team (current-team rule).
 * 4. Derives coordinator name dynamically from active group admin member.
 */
export async function fetchTeamMetrics(supabase: SupabaseClient): Promise<TeamMetric[]> {
  const [
    { data: groupsData, error: groupsErr },
    { data: membersData, error: membersErr },
    { data: passesData, error: passesErr },
  ] = await Promise.all([
    supabase.from('groups').select('id, name').order('id', { ascending: true }),
    supabase
      .from('members')
      .select('id, full_name, group_id, is_group_admin, is_active')
      .eq('is_active', true),
    supabase
      .from('passes')
      .select(`
        id,
        seller_member_id,
        price,
        status,
        source,
        payments (
          amount,
          status
        )
      `)
      .neq('status', 'cancelled'),
  ]);

  if (groupsErr) console.error('Error fetching groups for team metrics:', groupsErr);
  if (membersErr) console.error('Error fetching members for team metrics:', membersErr);
  if (passesErr) console.error('Error fetching passes for team metrics:', passesErr);

  const groups = groupsData || [];
  const members = membersData || [];
  const passes = passesData || [];

  // Map member ID to member object (current team assignment)
  const memberMap = new Map<number, (typeof members)[0]>();
  // Map group ID to coordinator full name
  const coordinatorMap = new Map<number, string>();

  for (const m of members) {
    memberMap.set(m.id, m);
    if (m.is_group_admin && m.group_id) {
      coordinatorMap.set(m.group_id, m.full_name);
    }
  }

  // Initialize metrics map for every group
  const teamMetricsMap = new Map<
    number,
    {
      receivedAmount: number;
      pendingAmount: number;
      seatsSold: number;
    }
  >();

  for (const g of groups) {
    teamMetricsMap.set(g.id, {
      receivedAmount: 0,
      pendingAmount: 0,
      seatsSold: 0,
    });
  }

  // Aggregate passes
  for (const p of passes) {
    // Exclude ring-fenced Rotary Club passes and unassigned passes
    if (p.source === 'participating_club' || !p.seller_member_id) continue;

    const seller = memberMap.get(p.seller_member_id);
    if (!seller || !seller.group_id) continue;

    const team = teamMetricsMap.get(seller.group_id);
    if (!team) continue;

    team.seatsSold += 1;

    const paymentsList = (p as any).payments;
    if (Array.isArray(paymentsList) && paymentsList.length > 0) {
      for (const pay of paymentsList) {
        if (pay.status === 'received') {
          team.receivedAmount += pay.amount || 0;
        } else if (pay.status === 'pending') {
          team.pendingAmount += pay.amount || 0;
        }
      }
    } else {
      // Fallback to immutable stored pass price
      team.receivedAmount += p.price || 0;
    }
  }

  // Build sorted result
  return groups.map((g) => {
    const metrics = teamMetricsMap.get(g.id) || {
      receivedAmount: 0,
      pendingAmount: 0,
      seatsSold: 0,
    };

    const coordName = coordinatorMap.get(g.id) || 'Coordinator';
    const cleanCoordName = coordName.replace(/^Rtn\.\s*/i, 'Rtn. ');

    return {
      groupId: g.id,
      groupName: g.name,
      coordinatorName: cleanCoordName,
      teamLabel: `Team ${g.id} · ${cleanCoordName}`,
      receivedAmount: metrics.receivedAmount,
      pendingAmount: metrics.pendingAmount,
      totalAmount: metrics.receivedAmount + metrics.pendingAmount,
      seatsSold: metrics.seatsSold,
    };
  });
}
