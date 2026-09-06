export const dynamic = 'force-dynamic';
import { requireUser } from '@/lib/auth/guards';
import { createAdminClient } from '@/lib/supabase/admin';
import { EmailClient } from './email-client';

export const metadata = {
  title: 'Broadcast & Communication | Hrudhayam LIVE',
};

export default async function EmailPage() {
  const user = await requireUser();
  const adminClient = createAdminClient();

  const isSuperAdmin = user.role === 'super_admin' || user.role === 'system_admin';

  let teamMembers = null;
  if (isSuperAdmin) {
    const { data } = await adminClient
      .from('members')
      .select('id, full_name, phone_raw')
      .eq('is_active', true)
      .order('full_name');
    teamMembers = data?.map(m => ({ id: String(m.id), full_name: m.full_name, email: m.phone_raw })) || [];
  }

  // Fetch all active donor passes for broadcast
  let query = adminClient
    .from('passes')
    .select('*, band:bands(label, price, name, standard_price), payment:payments(*)')
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false });

  if (!isSuperAdmin && user.memberId) {
    query = query.eq('seller_member_id', user.memberId);
  }

  const { data: passes } = await query;

  const guests = (passes || []).map((p: any) => ({
    id: p.id,
    section: p.band?.label || p.band?.name || 'General',
    row_label: p.band?.label || p.band?.name || '',
    seat_no: 1,
    tier: p.band?.price || p.band?.standard_price || 5000,
    owner_id: p.seller_member_id ? String(p.seller_member_id) : p.issued_by_user_id,
    guest_name: p.donor_name,
    guest_phone: p.donor_phone,
    guest_email: p.donor_email,
    pass_code: p.pass_code,
    qr_token: p.qr_token || p.pass_code,
    payment_status: p.payment?.status || 'received',
    ticket_sent: true,
    ticket_sent_at: p.created_at,
  }));

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-16">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Broadcast & Communication Hub</h1>
        <p className="text-xs text-slate-400 mt-1">
          Send announcements or 1-Click WhatsApp messages with digital pass links to donors.
        </p>
      </div>
      
      <EmailClient 
        isSuperAdmin={isSuperAdmin} 
        teamMembers={teamMembers || []} 
        userId={user.id}
        initialGuests={guests}
      />
    </div>
  );
}
