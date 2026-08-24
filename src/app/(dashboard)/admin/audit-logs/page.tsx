export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { RoleGate } from '@/components/layout/RoleGate';
import { AuditLogsClient } from './audit-logs-client';

export const metadata = {
  title: 'Audit Logs | Hrudhayam LIVE',
};

export default async function AuditLogsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const adminClient = createAdminClient();

  const { data: logs } = await adminClient
    .from('audit_logs')
    .select(`
      *,
      profiles:user_id ( full_name, email, role )
    `)
    .order('created_at', { ascending: false })
    .limit(500);

  return (
    <RoleGate allowedRoles={['super_admin']}>
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-1">Audit Logs</h1>
          <p className="text-slate-400 text-xs">Immutable system audit trail and operational log.</p>
        </div>

        <AuditLogsClient logs={(logs as any) || []} />
      </div>
    </RoleGate>
  );
}
