export const dynamic = 'force-dynamic';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchEventSummaryMetrics } from '@/lib/band-utils';
import { formatINR, BANDS_CONFIG } from '@/lib/constants';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { 
  Ticket, 
  Users, 
  Layers, 
  DollarSign, 
  ScanLine, 
  PlusCircle, 
  Settings2, 
  FileSpreadsheet, 
  CheckCircle2, 
  Clock, 
  ArrowUpRight, 
  Share2, 
  ShieldCheck, 
  Sparkles,
  Heart
} from 'lucide-react';

export const metadata = {
  title: 'Dashboard | Hrudhayam LIVE',
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const adminClient = createAdminClient();

  const { data: profile } = await adminClient
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!profile || !profile.is_active) {
    redirect('/onboard');
  }

  // Fetch summary metrics & latest sales in parallel
  const [metrics, recentSalesRes, poolsRes] = await Promise.all([
    fetchEventSummaryMetrics(adminClient),
    adminClient
      .from('sales')
      .select('*, band:bands(name, standard_price), seller:profiles!sales_sold_by_fkey(full_name)')
      .eq('cancelled', false)
      .order('created_at', { ascending: false })
      .limit(6),
    adminClient
      .from('reserved_pools')
      .select('*, entries:reserved_entries(id)')
      .order('display_order', { ascending: true }),
  ]);

  const recentSales = recentSalesRes.data || [];
  const pools = poolsRes.data || [];
  const isSuperOrSystemAdmin = profile.role === 'super_admin' || profile.role === 'system_admin';

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      {/* 1. Header & Live Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#0F2236] p-6 rounded-3xl border border-[#243D56] shadow-xl text-white">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold tracking-wider uppercase mb-1">
            <Heart className="w-3.5 h-3.5 fill-amber-400" />
            <span>Rotary Club of Aarch City Madras</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Hrudhayam LIVE 2026
          </h1>
          <p className="text-xs text-slate-400">
            Charity Musical Concert in Aid of Public-Access AEDs • Band-Based Allocation
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {profile.role !== 'system_admin' && (
            <Link href="/sell">
              <Button className="bg-gradient-to-r from-[#E8913A] to-[#D97706] hover:from-[#D97706] hover:to-[#B45309] text-slate-950 font-black text-xs rounded-xl h-10 px-4 gap-1.5 shadow-md">
                <PlusCircle className="w-4 h-4" />
                <span>Sell a Pass</span>
              </Button>
            </Link>
          )}

          <Link href="/checkin">
            <Button variant="outline" className="bg-[#162C42] hover:bg-[#1E3B5A] text-sky-400 border-sky-800/60 font-bold text-xs rounded-xl h-10 px-4 gap-1.5">
              <ScanLine className="w-4 h-4" />
              <span>Door Scanner</span>
            </Button>
          </Link>

          {isSuperOrSystemAdmin && (
            <Link href="/setup">
              <Button variant="outline" className="bg-[#162C42] hover:bg-[#1E3B5A] text-slate-200 border-[#2A4866] font-semibold text-xs rounded-xl h-10 px-4 gap-1.5">
                <Settings2 className="w-4 h-4 text-slate-400" />
                <span>Set Up Bands</span>
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* 2. Top Fundraising & Capacity Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-[#131F2E] p-4 rounded-2xl border border-[#223345] shadow-md">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Band Capacity</span>
          <span className="text-2xl font-extrabold text-white mt-1 block font-mono">{metrics.totalCapacity.toLocaleString()}</span>
          <span className="text-[10px] text-slate-500 block mt-0.5">Commercial seats</span>
        </div>

        <div className="bg-[#131F2E] p-4 rounded-2xl border border-[#223345] shadow-md">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Seats Sold</span>
          <span className="text-2xl font-extrabold text-[#E8913A] mt-1 block font-mono">{metrics.totalSold.toLocaleString()}</span>
          <span className="text-[10px] text-slate-500 block mt-0.5">
            {metrics.totalCapacity > 0 ? `${Math.round((metrics.totalSold / metrics.totalCapacity) * 100)}% filled` : '0%'}
          </span>
        </div>

        <div className="bg-[#131F2E] p-4 rounded-2xl border border-[#223345] shadow-md">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Remaining Available</span>
          <span className="text-2xl font-extrabold text-sky-400 mt-1 block font-mono">{metrics.totalRemaining.toLocaleString()}</span>
          <span className="text-[10px] text-slate-500 block mt-0.5">Open for sale</span>
        </div>

        <div className="bg-[#131F2E] p-4 rounded-2xl border border-[#223345] shadow-md">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Collected Revenue</span>
          <span className="text-2xl font-extrabold text-emerald-400 mt-1 block font-mono">{formatINR(metrics.totalCollected)}</span>
          <span className="text-[10px] text-emerald-500/80 block mt-0.5">Confirmed funds</span>
        </div>

        <div className="bg-[#131F2E] p-4 rounded-2xl border border-[#223345] shadow-md">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Pending Collections</span>
          <span className="text-2xl font-extrabold text-amber-400 mt-1 block font-mono">{formatINR(metrics.totalPending)}</span>
          <span className="text-[10px] text-amber-500/80 block mt-0.5">Awaiting payment</span>
        </div>

        <div className="bg-[#131F2E] p-4 rounded-2xl border border-[#223345] shadow-md">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Gate Admissions</span>
          <span className="text-2xl font-extrabold text-purple-400 mt-1 block font-mono">{metrics.totalCheckedIn.toLocaleString()}</span>
          <span className="text-[10px] text-purple-400/80 block mt-0.5">
            {metrics.totalSold > 0 ? `${Math.round((metrics.totalCheckedIn / metrics.totalSold) * 100)}% scanned` : '0% scanned'}
          </span>
        </div>
      </div>

      {/* 3. 4 PRICE BANDS LIVE CARDS */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-[#E8913A]" />
            <span>4 Price Bands Status</span>
          </h2>
          <span className="text-xs text-slate-400">Live inventory tracking</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {metrics.bands.map((band) => {
            const sold = band.sold_count || 0;
            const cap = band.total_capacity || 0;
            const rem = band.remaining_count || 0;
            const occupancy = cap > 0 ? Math.min(100, Math.round((sold / cap) * 100)) : 0;
            const config = BANDS_CONFIG.find(c => c.id === band.id);

            return (
              <Card key={band.id} className="bg-[#131F2E] border-[#223345] rounded-2xl shadow-xl overflow-hidden flex flex-col justify-between">
                <CardHeader className="bg-[#0E1724] pb-3 border-b border-[#223345]">
                  <div className="flex items-center justify-between">
                    <Badge className={`${config?.bgColor || 'bg-amber-500/10'} ${config?.textColor || 'text-amber-400'} border ${config?.borderColor || 'border-amber-500/30'} text-xs font-bold font-mono`}>
                      {band.name}
                    </Badge>
                    <span className="text-sm font-black font-mono text-white">
                      {formatINR(band.standard_price)}
                    </span>
                  </div>
                </CardHeader>

                <CardContent className="p-5 space-y-4 flex-1 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="p-2 bg-[#0F1A26] rounded-xl border border-[#24364A]">
                        <span className="text-[9px] uppercase font-bold text-slate-400 block">Capacity</span>
                        <span className="text-sm font-extrabold text-white font-mono">{cap}</span>
                      </div>
                      <div className="p-2 bg-[#0F1A26] rounded-xl border border-[#24364A]">
                        <span className="text-[9px] uppercase font-bold text-slate-400 block">Sold</span>
                        <span className="text-sm font-extrabold text-[#E8913A] font-mono">{sold}</span>
                      </div>
                      <div className="p-2 bg-[#0F1A26] rounded-xl border border-[#24364A]">
                        <span className="text-[9px] uppercase font-bold text-slate-400 block">Remaining</span>
                        <span className={`text-sm font-extrabold font-mono ${rem > 0 ? 'text-sky-400' : 'text-red-400'}`}>{rem}</span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-slate-400">Sold Out</span>
                        <span className="font-bold text-white">{occupancy}%</span>
                      </div>
                      <div className="w-full bg-[#1A2839] rounded-full h-2 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{ 
                            width: `${occupancy}%`,
                            backgroundColor: config?.color || '#F59E0B'
                          }}
                        />
                      </div>
                    </div>

                    {/* Financial summary */}
                    <div className="pt-2 border-t border-[#223345] text-[11px] space-y-1 text-slate-400">
                      <div className="flex justify-between">
                        <span>Collected:</span>
                        <strong className="text-emerald-400">{formatINR(band.collected_amount || 0)}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Pending:</span>
                        <strong className="text-amber-400">{formatINR(band.pending_amount || 0)}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2">
                    {profile.role !== 'system_admin' && (
                      <Link href={`/sell?band=${band.id}`}>
                        <Button 
                          size="sm" 
                          disabled={rem <= 0}
                          className="w-full bg-[#1A2839] hover:bg-[#24364A] text-slate-200 text-xs font-semibold rounded-xl border border-[#2A3F55] h-8"
                        >
                          {rem > 0 ? `Sell in ${band.name.split(' ')[0]}` : 'Sold Out'}
                        </Button>
                      </Link>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* 4. LOWER SECTION: RESERVED QUOTAS & RECENT SALES FEED */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Reserved Pools Card */}
        <Card className="bg-[#131F2E] border-[#223345] rounded-2xl shadow-xl overflow-hidden lg:col-span-1">
          <CardHeader className="bg-[#0E1724] pb-3 border-b border-[#223345]">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-purple-400" />
                <span>Reserved Quotas</span>
              </CardTitle>
              <Badge variant="outline" className="text-[10px] text-purple-300 border-purple-800">
                {metrics.totalReservedSeats} Seats Set Aside
              </Badge>
            </div>
            <CardDescription className="text-xs text-slate-400">
              Complimentary dignitary and event pools.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-4 space-y-3">
            {pools.map((pool) => {
              const namedCount = pool.entries?.length || 0;
              return (
                <div key={pool.id} className="p-3 bg-[#0E1724] rounded-xl border border-[#24364A] flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-white block">{pool.name}</span>
                    <span className="text-[10px] text-slate-400">{namedCount} of {pool.total_count} Named</span>
                  </div>
                  <Badge className="bg-purple-950 text-purple-300 border border-purple-800 font-mono font-bold">
                    {pool.total_count} seats
                  </Badge>
                </div>
              );
            })}

            {isSuperOrSystemAdmin && (
              <Link href="/setup">
                <Button variant="outline" size="sm" className="w-full bg-[#1A2839] hover:bg-[#24364A] text-slate-300 text-xs border-[#2A3F55] h-8 mt-2">
                  Manage Quotas & Fill Names
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>

        {/* Recent Sales Activity Feed */}
        <Card className="bg-[#131F2E] border-[#223345] rounded-2xl shadow-xl overflow-hidden lg:col-span-2">
          <CardHeader className="bg-[#0E1724] pb-3 border-b border-[#223345]">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                <Ticket className="w-4 h-4 text-emerald-400" />
                <span>Recent Team Sales Feed</span>
              </CardTitle>
              <Link href="/guests" className="text-xs text-amber-400 hover:underline flex items-center gap-1">
                <span>View All ({metrics.totalSold})</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <CardDescription className="text-xs text-slate-400">
              Live updates across all team member sales.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-4">
            {recentSales.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                No passes recorded yet. Click &quot;Sell a Pass&quot; to begin.
              </div>
            ) : (
              <div className="space-y-2">
                {recentSales.map((sale) => {
                  const bandConfig = BANDS_CONFIG.find(c => c.id === sale.band_id);
                  return (
                    <div 
                      key={sale.id} 
                      className="p-3 bg-[#0E1724] rounded-xl border border-[#24364A] flex items-center justify-between text-xs hover:bg-[#122232] transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs font-bold text-amber-400">
                          {sale.pass_code}
                        </span>
                        <div>
                          <span className="font-bold text-white block">{sale.donor_name}</span>
                          <span className="text-[10px] text-slate-400">
                            Sold by {sale.seller?.full_name || 'Team'} • {sale.donor_phone}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge className={`${bandConfig?.bgColor || 'bg-amber-500/10'} ${bandConfig?.textColor || 'text-amber-400'} border ${bandConfig?.borderColor || 'border-amber-500/30'} text-[10px] font-bold`}>
                          {sale.band?.name || 'Band'}
                        </Badge>
                        <Badge className={`text-[10px] ${sale.payment_status === 'paid' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-amber-950 text-amber-300 border border-amber-800'}`}>
                          {sale.payment_status === 'paid' ? 'Paid' : 'Pending'}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
