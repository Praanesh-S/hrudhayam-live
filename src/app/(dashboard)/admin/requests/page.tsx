export const dynamic = 'force-dynamic';
import { createClient } from '@/lib/supabase/server';
import { RoleGate } from '@/components/layout/RoleGate';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export const metadata = {
  title: 'Access Requests | Hrudhayam',
};

export default async function RequestsPage() {
  const supabase = await createClient();
  
  const { data: requests } = await supabase
    .from('access_requests')
    .select('*')
    .order('created_at', { ascending: false });

  return (
    <RoleGate allowedRoles={['super_admin']}>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Access Requests</h1>
          <p className="text-muted-foreground">Manage pending row allocation requests.</p>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User ID</TableHead>
                <TableHead>Requested Rows</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests?.map((req) => (
                <TableRow key={req.id}>
                  <TableCell className="font-medium">{req.user_id}</TableCell>
                  <TableCell>{req.requested_rows?.join(', ')}</TableCell>
                  <TableCell>{req.status}</TableCell>
                  <TableCell>{new Date(req.created_at).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
              {!requests?.length && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-4">No pending requests</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </RoleGate>
  );
}
