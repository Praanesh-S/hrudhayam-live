export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { AuditLogsClient } from './audit-logs-client';
import { AuditLog } from '@/lib/types';

export const metadata = {
  title: 'Audit Logs | Hrudhayam LIVE',
};

export default async function AuditLogsPage() {
  const user = await getSessionUser();

  if (!user || (user.role !== 'super_admin' && user.role !== 'system_admin')) {
    redirect('/dashboard');
  }

  const adminClient = createAdminClient();

  // Query audit_log with actor details
  const { data: logsData } = await adminClient
    .from('audit_log')
    .select(`
      id,
      actor_user_id,
      action,
      entity,
      entity_id,
      before_json,
      after_json,
      at,
      actor:users(
        login_id,
        role,
        members(full_name)
      )
    `)
    .order('at', { ascending: false })
    .limit(500);

  const formattedLogs: AuditLog[] = (logsData || []).map((l: any) => ({
    id: l.id,
    actor_user_id: l.actor_user_id,
    action: l.action,
    entity: l.entity,
    entity_id: l.entity_id,
    before_json: l.before_json,
    after_json: l.after_json,
    at: l.at,
    actor_name: l.actor?.members?.full_name || l.actor?.login_id || 'System',
    actor_login_id: l.actor?.login_id,
  }));

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      <div>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white mb-1">
          System Audit Trail (§15)
        </h1>
        <p className="text-slate-400 text-sm">
          Immutable event log recording all pass sales, group moves, band capacity adjustments, cancellations, and gate admissions.
        </p>
      </div>

      <AuditLogsClient logs={formattedLogs} />
    </div>
  );
}
