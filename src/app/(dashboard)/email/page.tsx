export const dynamic = 'force-dynamic';
import { createClient } from '@/lib/supabase/server';
import { RoleGate } from '@/components/layout/RoleGate';
import { EmailClient } from './email-client';

export const metadata = {
  title: 'Mass Email | Hrudhayam',
};

export default async function EmailPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const isSuperAdmin = profile?.role === 'super_admin';

  let teamMembers = null;
  if (isSuperAdmin) {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('is_active', true)
      .order('full_name');
    teamMembers = data;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Mass Email</h1>
        <p className="text-muted-foreground">
          Send announcements or tickets to guests.
        </p>
      </div>
      
      <EmailClient 
        isSuperAdmin={isSuperAdmin} 
        teamMembers={teamMembers || []} 
        userId={user.id}
      />
    </div>
  );
}
