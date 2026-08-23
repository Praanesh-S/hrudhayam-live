export const dynamic = 'force-dynamic';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { RoleGate } from '@/components/layout/RoleGate';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { UsersForm } from './users-form';
import { Shield, UserPlus, Users } from 'lucide-react';

export const metadata = {
  title: 'User Management | Hrudhayam LIVE',
};

export default async function UsersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const adminClient = createAdminClient();

  const { data: profiles } = await adminClient
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });

  return (
    <RoleGate allowedRoles={['super_admin']}>
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#131F2E] p-5 rounded-2xl border border-[#223345] shadow-xs">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              User Management & Access Control
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Manage permissions, roles, and door verification duties for staff.
            </p>
          </div>
        </div>

        <div className="bg-[#131F2E] rounded-2xl border border-[#223345] shadow-xs overflow-hidden">
          <Table>
            <TableHeader className="bg-[#0E1724] border-b border-[#223345]">
              <TableRow className="text-slate-400 text-xs">
                <TableHead className="text-slate-300">Name</TableHead>
                <TableHead className="text-slate-300">Email</TableHead>
                <TableHead className="text-slate-300">Role</TableHead>
                <TableHead className="text-slate-300">Account Status</TableHead>
                <TableHead className="text-slate-300">Door Duty Access</TableHead>
                <TableHead className="text-right pr-6 text-slate-300">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profiles?.map((p) => (
                <TableRow key={p.id} className="border-b border-[#1E2D3D] hover:bg-[#1A2839]/60">
                  <TableCell className="font-semibold text-xs text-white">{p.full_name}</TableCell>
                  <TableCell className="text-xs text-slate-400">{p.email}</TableCell>
                  <TableCell>
                    <Badge variant={p.role === 'super_admin' ? 'default' : 'secondary'} className={p.role === 'super_admin' ? 'bg-[#E8913A] text-slate-950 font-bold text-[10px]' : 'bg-[#1A2839] text-slate-300 text-[10px]'}>
                      {p.role === 'super_admin' ? 'Super Admin' : 'Sub-Admin'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={p.is_active ? 'bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px]' : 'bg-red-950 text-red-300 border border-red-800 text-[10px]'}>
                      {p.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {p.door_duty ? (
                      <Badge variant="outline" className="border-sky-700 bg-sky-950/40 text-sky-300 text-[10px]">
                        Door Duty
                      </Badge>
                    ) : (
                      <span className="text-xs text-slate-500">Standard</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right pr-6">
                    <UsersForm profile={p} currentUserId={user.id} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </RoleGate>
  );
}
