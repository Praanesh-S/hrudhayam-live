export const dynamic = 'force-dynamic';

import { getSessionUser } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { MembersAdminClient } from './members-client';

export const metadata = {
  title: 'Groups & Members | Admin Console',
};

export default async function AdminMembersPage() {
  const user = await getSessionUser();
  if (!user || (user.role !== 'super_admin' && user.role !== 'system_admin')) {
    redirect('/dashboard');
  }

  const adminClient = createAdminClient();

  // Fetch groups, members, and user accounts
  const [{ data: groups }, { data: members }, { data: usersList }, { data: passes }] = await Promise.all([
    adminClient.from('groups').select('*').order('id'),
    adminClient.from('members').select('*, groups(id, name)').order('group_id').order('full_name'),
    adminClient.from('users').select('id, login_id, role, is_active, member_id'),
    adminClient.from('passes').select('seller_member_id, payments(amount, status)').neq('status', 'cancelled'),
  ]);

  // Aggregate member sales count & amount for move calculation
  const memberSalesMap = new Map<number, { count: number; amount: number }>();
  for (const p of passes || []) {
    if (!p.seller_member_id) continue;
    const cur = memberSalesMap.get(p.seller_member_id) || { count: 0, amount: 0 };
    cur.count += 1;
    const pays = (p as any).payments;
    if (Array.isArray(pays)) {
      for (const pay of pays) {
        if (pay.status === 'received') cur.amount += pay.amount || 0;
      }
    }
    memberSalesMap.set(p.seller_member_id, cur);
  }

  const enrichedMembers = (members || []).map((m) => {
    const stats = memberSalesMap.get(m.id) || { count: 0, amount: 0 };
    return {
      ...m,
      sales_count: stats.count,
      sales_amount: stats.amount,
    };
  });

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto pb-16">
      <div>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
          Groups, Members & Accounts
        </h1>
        <p className="text-slate-400 text-sm sm:text-base mt-1">
          Manage the 8 teams, edit member mobile numbers, move members between groups, and delegate administrative roles (§10).
        </p>
      </div>

      <MembersAdminClient
        groups={groups || []}
        members={enrichedMembers}
        usersList={usersList || []}
        currentUser={user}
      />
    </div>
  );
}
