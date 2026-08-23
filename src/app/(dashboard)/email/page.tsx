export const dynamic = 'force-dynamic';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { EmailClient } from './email-client';
import { fetchAllSeats } from '@/lib/seat-utils';

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
  const allSeats = await fetchAllSeats(adminClient, {
    ownerId: isSuperAdmin ? undefined : user.id,
  });

  const seats = allSeats.filter((s: any) => s.guest_name && s.guest_name.trim() !== '');

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
