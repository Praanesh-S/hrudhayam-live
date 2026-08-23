export const dynamic = 'force-dynamic';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { RoleGate } from '@/components/layout/RoleGate';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download, FileSpreadsheet, TrendingUp, Users, CheckCircle2, Clock, IndianRupee } from 'lucide-react';
import { formatINR } from '@/lib/constants';

export const metadata = {
  title: 'Financial Reports | Hrudhayam LIVE',
};

export default async function ReportsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const adminClient = createAdminClient();

  const { data: profile } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  const isSuperAdmin = profile?.role === 'super_admin';

  let query = adminClient.from('seats').select('*, profiles(full_name)');
  if (!isSuperAdmin) {
    query = query.eq('owner_id', user.id);
  }

  const { data: seatsData } = await query;
  const seats = seatsData || [];

  // Compute stats safely with case-insensitive payment_status
  const totalSeats = seats.length;
  const filledSeats = seats.filter(s => s.guest_name && s.guest_name.trim() !== '').length;
  const paidSeats = seats.filter(s => (s.payment_status || '').toLowerCase() === 'received').length;
  
  const totalValue = seats.reduce((sum, s) => sum + (s.tier || 0), 0);
  const receivedValue = seats
    .filter(s => (s.payment_status || '').toLowerCase() === 'received')
    .reduce((sum, s) => sum + (s.tier || 0), 0);
  const pendingValue = seats
    .filter(s => s.guest_name && (s.payment_status || '').toLowerCase() === 'pending')
    .reduce((sum, s) => sum + (s.tier || 0), 0);

  // Group by Tier
  const tier5000 = seats.filter(s => s.tier === 5000);
  const tier3000 = seats.filter(s => s.tier === 3000);
  const tier1500 = seats.filter(s => s.tier === 1500);

  const getTierStats = (tierSeats: typeof seats, price: number) => {
    const total = tierSeats.length;
    const filled = tierSeats.filter(s => s.guest_name).length;
    const paid = tierSeats.filter(s => (s.payment_status || '').toLowerCase() === 'received').length;
    const value = total * price;
    const collected = paid * price;
    return { total, filled, paid, value, collected };
  };

  const stats5000 = getTierStats(tier5000, 5000);
  const stats3000 = getTierStats(tier3000, 3000);
  const stats1500 = getTierStats(tier1500, 1500);

  return (
    <RoleGate allowedRoles={['super_admin', 'sub_admin']}>
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        
        {/* Header with Export Action */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#131F2E] p-5 rounded-2xl border border-[#223345] shadow-xs">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              Event Financial & Pass Reconciliation
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Real-time audit of donor passes, tier distributions, and revenue collection.
            </p>
          </div>
          
          <a href="/api/export" target="_blank" download>
            <Button className="bg-[#E8913A] hover:bg-[#D97706] text-slate-950 font-bold text-xs gap-1.5 shadow-md shadow-amber-950/20">
              <FileSpreadsheet className="h-4 w-4" />
              <span>Download Multi-Sheet Excel (.xlsx)</span>
            </Button>
          </a>
        </div>

        {/* 4 KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-[#131F2E] border-[#223345] shadow-xs rounded-2xl">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Passes</span>
                <div className="p-2 rounded-xl bg-[#1A2839] text-slate-300">
                  <Users className="h-4 w-4" />
                </div>
              </div>
              <div className="text-2xl font-extrabold text-white mt-2">{totalSeats}</div>
              <p className="text-xs text-slate-400 mt-1">
                {filledSeats} filled ({totalSeats > 0 ? Math.round((filledSeats/totalSeats)*100) : 0}%)
              </p>
            </CardContent>
          </Card>

          <Card className="bg-[#131F2E] border-[#223345] shadow-xs rounded-2xl">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Potential Value</span>
                <div className="p-2 rounded-xl bg-amber-950/40 text-[#E8913A] border border-amber-900/40">
                  <IndianRupee className="h-4 w-4" />
                </div>
              </div>
              <div className="text-2xl font-extrabold text-white mt-2">{formatINR(totalValue)}</div>
              <p className="text-xs text-slate-400 mt-1">Across all priced seats</p>
            </CardContent>
          </Card>

          <Card className="bg-[#131F2E] border-[#223345] shadow-xs rounded-2xl">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Received Value</span>
                <div className="p-2 rounded-xl bg-emerald-950/40 text-emerald-400 border border-emerald-900/40">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
              </div>
              <div className="text-2xl font-extrabold text-emerald-400 mt-2">{formatINR(receivedValue)}</div>
              <p className="text-xs text-slate-400 mt-1">{paidSeats} confirmed donations</p>
            </CardContent>
          </Card>

          <Card className="bg-[#131F2E] border-[#223345] shadow-xs rounded-2xl">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Pending Collection</span>
                <div className="p-2 rounded-xl bg-amber-950/40 text-amber-400 border border-amber-900/40">
                  <Clock className="h-4 w-4" />
                </div>
              </div>
              <div className="text-2xl font-extrabold text-amber-400 mt-2">{formatINR(pendingValue)}</div>
              <p className="text-xs text-slate-400 mt-1">From filled unpaid passes</p>
            </CardContent>
          </Card>
        </div>

        {/* Breakdown by Tier Table */}
        <Card className="bg-[#131F2E] border-[#223345] shadow-xs rounded-2xl overflow-hidden">
          <CardHeader className="bg-[#0E1724] pb-3 border-b border-[#223345]">
            <CardTitle className="text-base font-bold text-white">
              Breakdown by Pricing Tier
            </CardTitle>
            <CardDescription className="text-xs text-slate-400">
              Seat occupancy, potential yield, and collection rates per tier.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-[#0E1724] border-b border-[#223345]">
                <TableRow className="text-slate-400 text-xs">
                  <TableHead className="text-slate-300">Pricing Tier</TableHead>
                  <TableHead className="text-slate-300">Total Seats</TableHead>
                  <TableHead className="text-slate-300">Filled Passes</TableHead>
                  <TableHead className="text-slate-300">Paid Passes</TableHead>
                  <TableHead className="text-slate-300">Potential Value</TableHead>
                  <TableHead className="text-right pr-6 text-slate-300">Collected</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow className="border-b border-[#1E2D3D] hover:bg-[#1A2839]/60">
                  <TableCell className="font-semibold">
                    <Badge className="bg-[#B8860B]/30 text-[#FACC15] border border-[#B8860B]/60 font-bold">
                      ₹5,000 Tier (Platinum)
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-300">{stats5000.total}</TableCell>
                  <TableCell className="font-mono text-xs text-slate-300">{stats5000.filled}</TableCell>
                  <TableCell className="font-mono text-xs text-emerald-400 font-bold">{stats5000.paid}</TableCell>
                  <TableCell className="font-mono text-xs font-bold text-white">{formatINR(stats5000.value)}</TableCell>
                  <TableCell className="font-mono text-xs font-bold text-emerald-400 text-right pr-6">
                    {formatINR(stats5000.collected)}
                  </TableCell>
                </TableRow>

                <TableRow className="border-b border-[#1E2D3D] hover:bg-[#1A2839]/60">
                  <TableCell className="font-semibold">
                    <Badge className="bg-[#0D9488]/30 text-[#2DD4BF] border border-[#0D9488]/60 font-bold">
                      ₹3,000 Tier (Gold)
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-300">{stats3000.total}</TableCell>
                  <TableCell className="font-mono text-xs text-slate-300">{stats3000.filled}</TableCell>
                  <TableCell className="font-mono text-xs text-emerald-400 font-bold">{stats3000.paid}</TableCell>
                  <TableCell className="font-mono text-xs font-bold text-white">{formatINR(stats3000.value)}</TableCell>
                  <TableCell className="font-mono text-xs font-bold text-emerald-400 text-right pr-6">
                    {formatINR(stats3000.collected)}
                  </TableCell>
                </TableRow>

                <TableRow className="border-b border-[#1E2D3D] hover:bg-[#1A2839]/60">
                  <TableCell className="font-semibold">
                    <Badge className="bg-slate-800 text-slate-300 border border-slate-600 font-bold">
                      ₹1,500 Tier (Silver)
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-300">{stats1500.total}</TableCell>
                  <TableCell className="font-mono text-xs text-slate-300">{stats1500.filled}</TableCell>
                  <TableCell className="font-mono text-xs text-emerald-400 font-bold">{stats1500.paid}</TableCell>
                  <TableCell className="font-mono text-xs font-bold text-white">{formatINR(stats1500.value)}</TableCell>
                  <TableCell className="font-mono text-xs font-bold text-emerald-400 text-right pr-6">
                    {formatINR(stats1500.collected)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

      </div>
    </RoleGate>
  );
}
