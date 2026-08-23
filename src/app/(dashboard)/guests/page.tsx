export const dynamic = 'force-dynamic';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { GuestsClient } from './guests-client';

export default async function GuestsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const adminClient = createAdminClient();

  // Get user profile
  const { data: profile } = await adminClient
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single();

  const role = profile?.role || 'member';

  if (role !== 'super_admin' && role !== 'sub_admin') {
    redirect('/dashboard');
  }

  // Fetch all team profiles for owner display
  const { data: allProfiles } = await adminClient
    .from('profiles')
    .select('id, full_name, email, role');

  const ownerMap: Record<string, string> = {};
  if (allProfiles) {
    for (const p of allProfiles) {
      ownerMap[p.id] = p.full_name || p.email;
    }
  }

  // Fetch seats based on role
  let query = adminClient.from('seats').select('*');

  if (role === 'sub_admin') {
    query = query.eq('owner_id', user.id);
  }

  const { data: seats, error } = await query
    .order('section', { ascending: true })
    .order('row_label', { ascending: true })
    .order('seat_no', { ascending: true });

  if (error) {
    console.error('Error fetching seats:', error);
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6 max-w-7xl mx-auto pb-16">
      <GuestsClient 
        initialSeats={seats || []} 
        userRole={role} 
        userId={user.id} 
        ownerMap={ownerMap}
        subAdmins={allProfiles?.filter(p => p.role === 'sub_admin') || []}
      />
    </div>
  );
}
