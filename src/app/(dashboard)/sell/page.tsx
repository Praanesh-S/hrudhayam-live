export const dynamic = 'force-dynamic';

import { getSessionUser } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchBandsWithMetrics } from '@/lib/band-utils';
import { fetchAllSeats } from '@/lib/seat-utils';
import { SellClient } from './sell-client';

export const metadata = {
  title: 'Sell a Pass | Hrudhayam LIVE',
};

export interface PendingSaleItem {
  id: string; // group key (undo_token or first payment id)
  donor_name: string;
  donor_phone: string;
  band_label: string;
  band_price: number;
  quantity: number;
  serials: string[];
  seller_name: string;
  seller_group_id: number | null;
  seller_group_name: string | null;
  total_amount: number;
  payment_ids: string[];
  reference_no: string;
  mode: string;
  created_at: string;
  pass_ids: string[];
}

export default async function SellPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect('/login');
  }

  const adminClient = createAdminClient();

  // 1. Fetch eligible sellers
  // Rule R2: Group Admin and Tech Coordinator see ONLY members of their own group + themselves.
  // Super Admin and System Admin see all members.
  let membersQuery = adminClient
    .from('members')
    .select(`
      id,
      full_name,
      phone_raw,
      phone_e164,
      phone_status,
      group_id,
      is_group_admin,
      is_tech_coord,
      is_active,
      groups (
        id,
        name
      )
    `)
    .eq('is_active', true)
    .order('full_name');

  const isFullAdmin = user.role === 'super_admin' || user.role === 'system_admin';

  if (!isFullAdmin && user.groupId) {
    membersQuery = membersQuery.eq('group_id', user.groupId);
  } else {
    membersQuery = membersQuery.order('group_id');
  }

  // 2. Fetch in parallel: bands, sellers, active holds, venue seats, and pending payments
  const [bands, membersRes, activeHoldsRes, seats, pendingPaymentsRes] = await Promise.all([
    fetchBandsWithMetrics(adminClient),
    membersQuery,
    adminClient
      .from('soft_holds')
      .select('*, bands(label)')
      .eq('status', 'active')
      .gt('expires_at', new Date().toISOString())
      .order('expires_at', { ascending: true }),
    fetchAllSeats(adminClient),
    adminClient
      .from('payments')
      .select(`
        id,
        mode,
        amount,
        reference_no,
        status,
        created_at,
        pass:passes!inner (
          id,
          pass_code,
          physical_serial,
          serial_no,
          donor_name,
          donor_phone,
          undo_token,
          band_id,
          status,
          bands (
            id,
            label,
            price
          ),
          seller:members (
            id,
            full_name,
            group_id,
            groups (
              id,
              name
            )
          )
        )
      `)
      .eq('status', 'pending')
      .neq('pass.status', 'cancelled')
      .order('created_at', { ascending: false }),
  ]);

  const eligibleSellers = membersRes.data || [];
  const activeHolds = activeHoldsRes.data || [];
  const rawPayments = pendingPaymentsRes.data || [];

  // Filter pending payments by group for non-super admins
  const filteredPayments = rawPayments.filter((p: any) => {
    if (isFullAdmin) return true;
    if (!user.groupId) return true;
    const seller = p.pass?.seller;
    return seller?.group_id === user.groupId;
  });

  // Group pending payments by sale batch (undo_token or donor_phone + created_at)
  const pendingSalesMap = new Map<string, PendingSaleItem>();

  for (const p of filteredPayments) {
    const pass = p.pass as any;
    const key = pass.undo_token || `${pass.donor_phone}_${pass.band_id}_${p.created_at.substring(0, 16)}`;
    const serial = pass.physical_serial || pass.serial_no || pass.pass_code;

    if (!pendingSalesMap.has(key)) {
      pendingSalesMap.set(key, {
        id: key,
        donor_name: pass.donor_name || 'Donor',
        donor_phone: pass.donor_phone || '',
        band_label: pass.bands?.label || 'Band',
        band_price: pass.bands?.price || 0,
        quantity: 1,
        serials: serial ? [serial] : [],
        seller_name: pass.seller?.full_name || 'Seller',
        seller_group_id: pass.seller?.group_id || null,
        seller_group_name: pass.seller?.groups?.name || (pass.seller?.group_id ? `Team ${pass.seller?.group_id}` : null),
        total_amount: p.amount || 0,
        payment_ids: [p.id],
        reference_no: p.reference_no || '',
        mode: p.mode || 'upi',
        created_at: p.created_at,
        pass_ids: [pass.id],
      });
    } else {
      const existing = pendingSalesMap.get(key)!;
      existing.quantity += 1;
      if (serial && !existing.serials.includes(serial)) {
        existing.serials.push(serial);
      }
      existing.total_amount += (p.amount || 0);
      existing.payment_ids.push(p.id);
      existing.pass_ids.push(pass.id);
    }
  }

  const pendingSales = Array.from(pendingSalesMap.values());

  return (
    <div className="max-w-4xl mx-auto pb-16">
      <SellClient
        bands={bands}
        sellers={eligibleSellers}
        seats={seats || []}
        currentUser={user}
        initialHolds={activeHolds || []}
        pendingSales={pendingSales}
      />
    </div>
  );
}
