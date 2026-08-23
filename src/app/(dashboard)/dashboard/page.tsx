export const dynamic = 'force-dynamic';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import SeatMap from '@/components/dashboard/SeatMap';
import { 
  Users, 
  Ticket, 
  CheckCircle2, 
  IndianRupee, 
  Calendar, 
  MapPin, 
  ScanLine, 
  FileSpreadsheet, 
  UserPlus, 
  Sliders,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Tag
} from 'lucide-react';
import { formatINR } from '@/lib/constants';
import { fetchAllSeats } from '@/lib/seat-utils';

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
    .maybeSingle();

  if (!profile || !profile.is_active) {
    redirect('/onboard');
  }

  const isSuperAdmin = profile.role === 'super_admin';
  const seats = await fetchAllSeats(adminClient, {
    ownerId: isSuperAdmin ? undefined : user.id,
  });

  // Calculate live statistics
  const totalCapacity = 1448;
  const totalSeatsInScope = isSuperAdmin ? totalCapacity : seats.length;
  const confirmedSeats = seats.filter(s => s.guest_name && s.guest_name.trim() !== '').length;
  const paidSeats = seats.filter(s => (s.payment_status || '').toLowerCase() === 'received').length;
  const checkedInSeats = seats.filter(s => s.checked_in).length;
  
  const potentialRevenue = seats.reduce((acc, s) => acc + (s.tier || 0), 0);
  const collectedRevenue = seats
    .filter(s => (s.payment_status || '').toLowerCase() === 'received')
    .reduce((acc, s) => acc + (s.tier || 0), 0);

  const occupancyPercent = totalSeatsInScope > 0 
    ? Math.round((confirmedSeats / totalSeatsInScope) * 100) 
    : 0;

  const paymentCollectionPercent = potentialRevenue > 0
    ? Math.round((collectedRevenue / potentialRevenue) * 100)
    : 0;

  // Countdown to event date (9 Oct 2026)
  const eventDate = new Date('2026-10-09T18:00:00');
  const now = new Date();
  const diffDays = Math.max(0, Math.ceil((eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      
      {/* 1. Hero Event Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#0B131E] via-[#111C2A] to-[#182738] p-6 sm:p-8 text-white shadow-2xl border border-[#223345]">
        <div className="absolute right-0 top-0 -mt-12 -mr-12 w-96 h-96 rounded-full bg-radial from-amber-500/10 to-transparent pointer-events-none"></div>

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className="bg-[#E8913A] text-slate-950 px-3 py-1 font-bold text-xs border-0">
                Rotary Fundraiser
              </Badge>
              <Badge variant="outline" className="text-amber-300 border-amber-500/30 bg-amber-950/30 text-xs font-semibold">
                Public-Access AEDs Initiative
              </Badge>
            </div>

            <div>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                Hrudhayam LIVE 2026
              </h2>
              <div className="flex items-center gap-4 text-xs sm:text-sm text-slate-300 mt-2 flex-wrap">
                <span className="flex items-center gap-1.5 font-medium text-slate-300">
                  <Calendar className="w-4 h-4 text-[#E8913A]" />
                  Friday, 9 October 2026
                </span>
                <span className="flex items-center gap-1.5 font-medium text-slate-300">
                  <MapPin className="w-4 h-4 text-[#E8913A]" />
                  The Music Academy, Alwarpet, Chennai
                </span>
              </div>
            </div>
          </div>

          {/* Countdown Pill */}
          <div className="flex items-center gap-4 bg-[#0E1724]/90 p-4 rounded-2xl border border-[#24364A] shrink-0">
            <div className="text-right">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Countdown
              </span>
              <span className="text-2xl sm:text-3xl font-extrabold text-[#E8913A] leading-tight block">
                {diffDays}
              </span>
              <span className="text-[10px] text-slate-400 block">Days to Concert</span>
            </div>
            <div className="h-10 w-px bg-[#24364A]"></div>
            <div className="space-y-1 text-left">
              <span className="text-[11px] text-slate-300 block font-medium">Capacity</span>
              <span className="text-sm font-bold text-white block">1,448 Passes</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Key Performance Indicators (KPIs) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Seats */}
        <Card className="bg-[#131F2E] border-[#223345] shadow-xs rounded-2xl">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                {isSuperAdmin ? 'Total Capacity' : 'My Allotted Seats'}
              </span>
              <div className="p-2 rounded-xl bg-[#1A2839] text-slate-300">
                <Users className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-extrabold text-white">
                {totalSeatsInScope.toLocaleString()}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {isSuperAdmin ? 'Ground: 698 • Balcony: 750' : 'Across assigned rows'}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Confirmed Passes */}
        <Card className="bg-[#131F2E] border-[#223345] shadow-xs rounded-2xl">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Confirmed Guests
              </span>
              <div className="p-2 rounded-xl bg-amber-950/40 text-[#E8913A] border border-amber-900/40">
                <Ticket className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-extrabold text-white">
                {confirmedSeats} <span className="text-xs font-medium text-slate-500">/ {totalSeatsInScope}</span>
              </div>
              <div className="w-full bg-[#1A2839] rounded-full h-1.5 mt-2">
                <div 
                  className="bg-[#E8913A] h-1.5 rounded-full transition-all duration-500" 
                  style={{ width: `${Math.min(100, occupancyPercent)}%` }}
                ></div>
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5 font-medium">
                {occupancyPercent}% occupied
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Revenue Collected */}
        <Card className="bg-[#131F2E] border-[#223345] shadow-xs rounded-2xl">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Payments Collected
              </span>
              <div className="p-2 rounded-xl bg-emerald-950/40 text-emerald-400 border border-emerald-900/40">
                <IndianRupee className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-extrabold text-emerald-400">
                {formatINR(collectedRevenue)}
              </div>
              <div className="w-full bg-[#1A2839] rounded-full h-1.5 mt-2">
                <div 
                  className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500" 
                  style={{ width: `${Math.min(100, paymentCollectionPercent)}%` }}
                ></div>
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5 font-medium">
                {paidSeats} paid ({formatINR(potentialRevenue - collectedRevenue)} pending)
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Checked In */}
        <Card className="bg-[#131F2E] border-[#223345] shadow-xs rounded-2xl">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Check-in Scans
              </span>
              <div className="p-2 rounded-xl bg-sky-950/40 text-sky-400 border border-sky-900/40">
                <ScanLine className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-extrabold text-white">
                {checkedInSeats} <span className="text-xs font-medium text-slate-500">/ {confirmedSeats}</span>
              </div>
              <p className="text-xs text-slate-400 mt-2">
                {confirmedSeats > 0 ? `${Math.round((checkedInSeats / confirmedSeats) * 100)}% verified at gate` : 'Ready for door duty'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 3. Quick Action Shortcuts */}
      <div className="flex items-center gap-3 overflow-x-auto pb-1">
        {isSuperAdmin && (
          <Link href="/setup">
            <Button variant="default" size="sm" className="bg-[#E8913A] hover:bg-[#D97706] text-slate-950 font-bold rounded-xl text-xs gap-1.5 shadow-md shadow-amber-950/20">
              <Sliders className="w-3.5 h-3.5" />
              Assign Price Tiers & Categories
            </Button>
          </Link>
        )}

        <Link href="/guests">
          <Button variant="outline" size="sm" className="bg-[#131F2E] hover:bg-[#1A2839] text-slate-200 border-[#223345] rounded-xl text-xs gap-1.5 font-medium shadow-xs">
            <UserPlus className="w-3.5 h-3.5 text-amber-400" />
            Manage Guests & Passes
          </Button>
        </Link>

        {isSuperAdmin && (
          <Link href="/allocate">
            <Button variant="outline" size="sm" className="bg-[#131F2E] hover:bg-[#1A2839] text-slate-200 border-[#223345] rounded-xl text-xs gap-1.5 font-medium shadow-xs">
              <Users className="w-3.5 h-3.5 text-sky-400" />
              Allocate Rows to Team
            </Button>
          </Link>
        )}

        <Link href="/checkin">
          <Button variant="outline" size="sm" className="bg-[#131F2E] hover:bg-[#1A2839] text-slate-200 border-[#223345] rounded-xl text-xs gap-1.5 font-medium shadow-xs">
            <ScanLine className="w-3.5 h-3.5 text-emerald-400" />
            Open Door Scanner
          </Button>
        </Link>

        <Link href="/reports">
          <Button variant="outline" size="sm" className="bg-[#131F2E] hover:bg-[#1A2839] text-slate-200 border-[#223345] rounded-xl text-xs gap-1.5 font-medium shadow-xs">
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            Export Excel Report
          </Button>
        </Link>
      </div>

      {/* 4. Main Interactive Architectural Blueprint Seat Map */}
      <SeatMap seats={seats} />
      
    </div>
  );
}
