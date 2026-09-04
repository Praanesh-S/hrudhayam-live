export const dynamic = 'force-dynamic';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { RoleGate } from '@/components/layout/RoleGate';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

export const metadata = {
  title: 'Access Requests | Hrudhayam LIVE',
};

export default async function RequestsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const adminClient = createAdminClient();
  
  const { data: requests } = await adminClient
    .from('access_requests')
    .select('*, profile:profiles(full_name, email, phone)')
    .order('created_at', { ascending: false });

  return (
    <RoleGate allowedRoles={['super_admin', 'system_admin']}>
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Team Access & Role Requests
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Review onboarding requests and assign permissions to team members.
          </p>
        </div>

        <Card className="bg-[#131F2E] border-[#223345] rounded-2xl shadow-xl overflow-hidden">
          <Table>
            <TableHeader className="bg-[#0E1724] border-b border-[#223345]">
              <TableRow className="text-slate-400 text-xs">
                <TableHead className="text-slate-300">Member</TableHead>
                <TableHead className="text-slate-300">Requested Role</TableHead>
                <TableHead className="text-slate-300">Status</TableHead>
                <TableHead className="text-slate-300">Submitted Date</TableHead>
                <TableHead className="text-slate-300">Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-[#1E2D3D] text-slate-300 text-xs">
              {requests?.map((req) => (
                <TableRow key={req.id} className="hover:bg-[#16273A] transition-colors">
                  <TableCell className="font-bold text-white">
                    {req.profile?.full_name || 'New Member'}
                    <span className="block text-[10px] text-slate-500 font-normal">{req.profile?.email}</span>
                  </TableCell>
                  <TableCell className="capitalize text-slate-300">
                    {req.requested_role?.replace('_', ' ') || 'Sub-Admin'}
                  </TableCell>
                  <TableCell>
                    <Badge className={
                      req.status === 'approved' 
                        ? 'bg-emerald-950 text-emerald-300 border-emerald-800' 
                        : req.status === 'rejected' 
                          ? 'bg-red-950 text-red-300 border-red-800' 
                          : 'bg-amber-950 text-amber-300 border-amber-800'
                    }>
                      {req.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-slate-400 font-mono text-[11px]">
                    {new Date(req.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-slate-400">
                    {req.notes || '-'}
                  </TableCell>
                </TableRow>
              ))}
              {!requests?.length && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                    No access requests submitted.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </RoleGate>
  );
}
