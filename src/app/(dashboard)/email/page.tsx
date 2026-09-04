export const dynamic = 'force-dynamic';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { EmailClient } from './email-client';

export const metadata = {
  title: 'Broadcast & Communication | Hrudhayam LIVE',
};

export default async function EmailPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const adminClient = createAdminClient();

  const { data: profile } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const isSuperAdmin = profile?.role === 'super_admin' || profile?.role === 'system_admin';

  let teamMembers = null;
  if (isSuperAdmin) {
    const { data } = await adminClient
      .from('profiles')
      .select('id, full_name, email')
      .eq('is_active', true)
      .order('full_name');
    teamMembers = data;
  }

  // Fetch all active donor sales for broadcast
  let query = adminClient
    .from('sales')
    .select('*, band:bands(name, standard_price)')
    .eq('cancelled', false)
    .order('created_at', { ascending: false });

  if (!isSuperAdmin) {
    query = query.eq('sold_by', user.id);
  }

  const { data: sales } = await query;

  const guests = (sales || []).map((s: any) => ({
    id: s.id,
    section: s.band?.name || 'General',
    row_label: s.band?.name || '',
    seat_no: 1,
    tier: s.standard_price || 5000,
    owner_id: s.sold_by,
    guest_name: s.donor_name,
    guest_phone: s.donor_phone,
    guest_email: s.donor_email,
    pass_code: s.pass_code,
    qr_token: s.qr_token,
    payment_status: s.payment_status,
    ticket_sent: !!s.issued_at,
    ticket_sent_at: s.issued_at,
  }));

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-16">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Broadcast & Communication Hub</h1>
        <p className="text-xs text-slate-400 mt-1">
          Send mass announcements via Email or 1-Click WhatsApp messages with digital pass links.
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
