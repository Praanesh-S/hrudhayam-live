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

  const isSuperAdmin = profile?.role === 'super_admin';

  let teamMembers = null;
  if (isSuperAdmin) {
    const { data } = await adminClient
      .from('profiles')
      .select('id, full_name, email')
      .eq('is_active', true)
      .order('full_name');
    teamMembers = data;
  }

  // Fetch all assigned guests for checklist selection & WhatsApp broadcast
  let query = adminClient
    .from('seats')
    .select('id, section, row_label, seat_no, tier, owner_id, guest_name, guest_email, guest_phone, pass_code, payment_status, ticket_sent')
    .not('guest_name', 'is', null);

  if (!isSuperAdmin) {
    query = query.eq('owner_id', user.id);
  }

  const { data: seats } = await query
    .order('section')
    .order('row_label')
    .order('seat_no');

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
        initialGuests={seats || []}
      />
    </div>
  );
}
