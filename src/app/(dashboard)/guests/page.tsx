export const dynamic = 'force-dynamic';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { GuestsClient } from './guests-client';

export default async function GuestsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Get user role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const role = profile?.role || 'member';

  if (role !== 'super_admin' && role !== 'sub_admin') {
    redirect('/dashboard');
  }

  // Fetch seats based on role
  let query = supabase.from('seats').select('*');

  if (role === 'sub_admin') {
    query = query.eq('owner_id', user.id);
  }

  const { data: seats, error } = await query.order('id', { ascending: true });

  if (error) {
    console.error('Error fetching seats:', error);
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Guests & Passes</h2>
      </div>
      <GuestsClient initialSeats={seats || []} userRole={role} userId={user.id} />
    </div>
  );
}
