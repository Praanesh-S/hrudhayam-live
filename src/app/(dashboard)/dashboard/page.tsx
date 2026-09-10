export const dynamic = 'force-dynamic';

import { getSessionUser } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchEventSummaryMetrics } from '@/lib/band-utils';
import { fetchAllSeats } from '@/lib/seat-utils';
import { fetchTeamMetrics } from '@/lib/team-metrics';
import { HallLayoutMap } from '@/components/hall/HallLayoutMap';
import { TeamCollectionsChart } from '@/components/dashboard/TeamCollectionsChart';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { 
  Layers, 
  PlusCircle, 
  Heart,
  Trophy,
  Download
} from 'lucide-react';

export const metadata = {
  title: 'Fill & Goal Dashboard | Hrudhayam LIVE',
};

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');

  const adminClient = createAdminClient();

  // Fetch metrics, all seats for blueprint layout, and team comparison metrics in parallel
  const [metrics, allSeats, teamMetrics] = await Promise.all([
    fetchEventSummaryMetrics(adminClient),
    fetchAllSeats(adminClient),
    fetchTeamMetrics(adminClient),
  ]);

  const occupancyPercent = metrics.totalCapacity > 0
    ? Math.round((metrics.totalSold / metrics.totalCapacity) * 100)
    : 0;

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      {/* 1. Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#131F2E] p-6 rounded-3xl border border-slate-800 shadow-xl text-white">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold tracking-wider uppercase mb-1">
            <Heart className="w-3.5 h-3.5 fill-amber-400" />
            <span>Rotary Club of Aarch City Madras</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Hrudhayam LIVE 2026
          </h1>
          <p className="text-xs text-slate-400">
            Charity Musical Concert • Friday, 9 October 2026 • The Music Academy, Chennai
          </p>
        </div>

        {/* Quick Action Navigation */}
        <div className="flex items-center gap-2 flex-wrap">
          <Link href="/sell">
            <Button className="bg-[#E8913A] hover:bg-[#D97706] text-slate-950 font-black text-xs rounded-xl h-10 px-4 gap-1.5 shadow-md">
              <PlusCircle className="w-4 h-4" />
              <span>Sell a Pass</span>
            </Button>
          </Link>

          <Link href="/leaderboard">
            <Button variant="outline" className="bg-[#1A2839] hover:bg-[#253950] border-slate-700 text-white font-bold text-xs rounded-xl h-10 px-3.5 gap-1.5">
              <Trophy className="w-4 h-4 text-amber-400" />
              <span>Leaderboard</span>
            </Button>
          </Link>

          <a href="/api/export" download>
            <Button variant="outline" className="bg-[#1A2839] hover:bg-[#253950] border-slate-700 text-white font-bold text-xs rounded-xl h-10 px-3.5 gap-1.5">
              <Download className="w-4 h-4 text-emerald-400" />
              <span>Export</span>
            </Button>
          </a>
        </div>
      </div>


      {/* 3. Top High-Level Campaign KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#131F2E] border border-slate-800 p-5 rounded-2xl">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Passes Sold</span>
          <div className="text-3xl font-black text-white font-mono mt-1">
            {metrics.totalSold} <span className="text-base text-slate-500 font-normal">/ {metrics.totalCapacity}</span>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
            <div className="bg-[#E8913A] h-full" style={{ width: `${occupancyPercent}%` }} />
          </div>
          <span className="text-[11px] text-slate-400 mt-1.5 block">{occupancyPercent}% Concert Fill</span>
        </div>

        <div className="bg-[#131F2E] border border-slate-800 p-5 rounded-2xl">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Available Remaining</span>
          <div className="text-3xl font-black text-emerald-400 font-mono mt-1">
            {metrics.totalRemaining}
          </div>
          <span className="text-[11px] text-slate-400 mt-3 block">Across 4 Price Bands</span>
        </div>

        <div className="bg-[#131F2E] border border-slate-800 p-5 rounded-2xl">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Collected Funds</span>
          <div className="text-3xl font-black text-emerald-400 font-mono mt-1 truncate">
            ₹{metrics.totalCollected.toLocaleString('en-IN')}
          </div>
          <span className="text-[11px] text-slate-400 mt-3 block">Passes + Sponsors Received</span>
        </div>

        <div className="bg-[#131F2E] border border-slate-800 p-5 rounded-2xl">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Pending Commitments</span>
          <div className="text-3xl font-black text-[#E8913A] font-mono mt-1 truncate">
            ₹{metrics.totalPending.toLocaleString('en-IN')}
          </div>
          <span className="text-[11px] text-slate-400 mt-3 block">Follow-up pledges</span>
        </div>
      </div>

      {/* 4. Live Band-by-Band Inventory Fill Cards */}
      <div className="space-y-4">
        <h3 className="text-xl font-bold text-white flex items-center gap-2">
          <Layers className="w-5 h-5 text-[#E8913A]" /> Seating Band Capacities & Remaining
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {metrics.bands.map((band) => {
            const sold = band.sold_count ?? 0;
            const cap = band.total_allocated ?? 0;
            const rem = band.remaining_count ?? 0;
            const pct = cap > 0 ? Math.round((sold / cap) * 100) : 0;
            const isSoldOut = rem <= 0;

            return (
              <div
                key={band.id}
                className="bg-[#131F2E] border border-slate-800 p-5 rounded-2xl flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start">
                    <span className="font-bold text-base text-white">{band.label}</span>
                    <span className="font-black text-lg text-[#E8913A] font-mono">
                      ₹{band.price.toLocaleString('en-IN')}
                    </span>
                  </div>

                  <div className="mt-4 space-y-1">
                    <div className="flex justify-between text-xs text-slate-400 font-medium">
                      <span>Sold: {sold} / {cap}</span>
                      <span className={isSoldOut ? 'text-red-400 font-bold' : 'text-emerald-400 font-bold'}>
                        {isSoldOut ? 'Sold Out' : `${rem} left`}
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div className="bg-[#E8913A] h-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </div>

                <div className="pt-4 mt-3 border-t border-slate-800/80 flex justify-between text-xs text-slate-400">
                  <span>Holds: {band.active_holds_count || 0}</span>
                  <span className="font-mono text-white">₹{((band.collected_amount || 0)).toLocaleString('en-IN')}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. Live Read-Only Hall Blueprint Layout */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-[#E8913A]" /> Live Hall Seating Blueprint
          </h3>
          <span className="text-xs text-slate-400 font-mono">
            Real-time venue occupancy status
          </span>
        </div>
        <HallLayoutMap seats={allSeats} readOnly={true} />
      </div>

      {/* 6. Team-wise Collections & Seats Sold Comparison */}
      <TeamCollectionsChart teams={teamMetrics} />
    </div>
  );
}
