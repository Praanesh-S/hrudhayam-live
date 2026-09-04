export const dynamic = 'force-dynamic';
import { createClient } from '@/lib/supabase/server';
import { RoleGate } from '@/components/layout/RoleGate';
import { CheckinClient } from './checkin-client';

export const metadata = {
  title: 'Gate Check-in | Hrudhayam LIVE',
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
    <RoleGate allowedRoles={['super_admin', 'sub_admin', 'system_admin']}>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Gate Scanner & Check-in</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Scan donor WhatsApp QR codes or enter pass codes for gate admission.
          </p>
        </div>
        
        <CheckinClient 
          isSuperAdmin={profile?.role === 'super_admin'} 
          isSystemAdmin={profile?.role === 'system_admin'}
          hasDoorDuty={!!profile?.door_duty} 
        />
      </div>
    </RoleGate>
  );
}
