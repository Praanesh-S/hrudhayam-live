export const dynamic = 'force-dynamic';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { RoleGate } from '@/components/layout/RoleGate';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Clock } from 'lucide-react';
import { format } from 'date-fns';

export default async function AuditLogsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

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
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Audit Logs</h1>
          <p className="text-slate-400">View recent system activity and changes.</p>
        </div>

        <Card className="bg-[#131F2E] border-[#1E3A4C]">
          <CardHeader className="border-b border-[#1E3A4C]">
            <CardTitle className="text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-500" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-[#1A2839]">
                  <TableRow className="border-[#1E3A4C]">
                    <TableHead className="text-slate-300">Timestamp</TableHead>
                    <TableHead className="text-slate-300">User</TableHead>
                    <TableHead className="text-slate-300">Action</TableHead>
                    <TableHead className="text-slate-300">Target Type</TableHead>
                    <TableHead className="text-slate-300">Target ID</TableHead>
                    <TableHead className="text-slate-300">Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!logs || logs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                        No audit logs found. (Ensure the audit_logs table is created in Supabase)
                      </TableCell>
                    </TableRow>
                  ) : (
                    logs.map((log: any) => (
                      <TableRow key={log.id} className="border-[#1E3A4C] hover:bg-[#1A2839]/50">
                        <TableCell className="text-slate-400 text-xs whitespace-nowrap">
                          {format(new Date(log.created_at), 'dd MMM yy HH:mm:ss')}
                        </TableCell>
                        <TableCell className="text-slate-300 font-medium">
                          {log.profiles?.full_name || 'System'}
                          <span className="block text-[10px] text-slate-500">{log.profiles?.email}</span>
                        </TableCell>
                        <TableCell className="text-amber-400 text-sm font-mono">
                          {log.action}
                        </TableCell>
                        <TableCell className="text-slate-300 text-sm">
                          {log.entity_type}
                        </TableCell>
                        <TableCell className="text-slate-300 font-mono text-xs max-w-[120px] truncate" title={log.entity_id}>
                          {log.entity_id}
                        </TableCell>
                        <TableCell className="text-slate-400 font-mono text-[10px] max-w-xs truncate" title={JSON.stringify(log.details)}>
                          {JSON.stringify(log.details)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </RoleGate>
  );
}
