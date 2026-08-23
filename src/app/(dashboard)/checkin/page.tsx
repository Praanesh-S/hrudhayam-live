export const dynamic = 'force-dynamic';
import { createClient } from '@/lib/supabase/server';
import { RoleGate } from '@/components/layout/RoleGate';
import { CheckinClient } from './checkin-client';

export const metadata = {
  title: 'Check-in | Hrudhayam',
};

export default async function CheckinPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, door_duty')
    .eq('id', user.id)
    .single();

  return (
    <RoleGate allowedRoles={['super_admin', 'sub_admin']}>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Scanner & Check-in</h1>
          <p className="text-muted-foreground">
            Scan guest QR codes or manually enter pass codes to check them in.
          </p>
        </div>
        
        <CheckinClient 
          isSuperAdmin={profile?.role === 'super_admin'} 
          hasDoorDuty={!!profile?.door_duty} 
        />
      </div>
    </RoleGate>
  );
}
