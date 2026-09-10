'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatINR } from '@/lib/constants';
import { Band, Group, Member, Sponsor, ParticipatingClub } from '@/lib/types';
import { AuthUser } from '@/lib/auth/session';
import { 
  BarChart3, 
  FileSpreadsheet, 
  Users, 
  Layers, 
  Building2, 
  Download, 
  CheckCircle2,
  Clock,
  Heart,
  ShieldCheck,
  Award
} from 'lucide-react';
import { toast } from 'sonner';

interface ReportsClientProps {
  bands: Band[];
  passes: any[];
  groups: Group[];
  members: Member[];
  sponsors: Sponsor[];
  clubs: ParticipatingClub[];
  currentUser: AuthUser;
}

export function ReportsClient({
  bands,
  passes,
  groups,
  members,
  sponsors,
  clubs,
  currentUser,
}: ReportsClientProps) {
  const [activeTab, setActiveTab] = useState('bands');
  const [isExporting, setIsExporting] = useState(false);

  // Exclude cancelled passes for reconciliation
  const activePasses = useMemo(() => passes.filter(p => p.status !== 'cancelled'), [passes]);

  // Overall Financial Aggregates
  const metrics = useMemo(() => {
    // 1. Passes revenue
    const passesSold = activePasses.length;
    const passesCollected = activePasses
      .filter(p => (p.payment?.status || 'received') === 'received')
      .reduce((sum, p) => sum + (p.payment?.amount || p.band?.price || p.band?.standard_price || 0), 0);
    const passesPending = activePasses
      .filter(p => p.payment?.status === 'pending')
      .reduce((sum, p) => sum + (p.payment?.amount || p.band?.price || p.band?.standard_price || 0), 0);
    const passesTotal = passesCollected + passesPending;

    // 2. Sponsors revenue
    const sponsorsReceived = sponsors
      .filter(s => s.status === 'received')
      .reduce((sum, s) => sum + (s.amount || 0), 0);
    const sponsorsCommitted = sponsors
      .filter(s => s.status === 'committed')
      .reduce((sum, s) => sum + (s.amount || 0), 0);
    const sponsorsTotal = sponsorsReceived + sponsorsCommitted;

    // 3. Participating Clubs (Ring-fenced per R7)
    // ₹25,000 entry fee = ₹15,000 passes value + ₹10,000 net contribution
    const clubsCount = clubs.length;
    const clubsNetContribution = clubs.reduce((sum, c) => sum + (c.net_contribution || 10000), 0);
    const clubsTotalEntryFees = clubs.reduce((sum, c) => sum + (c.entry_fee || 25000), 0);

    // 4. Grand Total
    const grandTotalRaised = passesTotal + sponsorsTotal + clubsTotalEntryFees;
    const grandTotalCollected = passesCollected + sponsorsReceived + clubsTotalEntryFees;
    const grandTotalPending = passesPending + sponsorsCommitted;

    // 5. AED Stations goal formula: ₹1,50,000 per station
    const aedStationsFunded = Math.floor(grandTotalRaised / 150000);

    // 6. Gate check-in count
    const gateCheckedIn = activePasses.filter(p => p.status === 'used').length;

    return {
      passesSold,
      passesCollected,
      passesPending,
      passesTotal,
      sponsorsReceived,
      sponsorsCommitted,
      sponsorsTotal,
      clubsCount,
      clubsNetContribution,
      clubsTotalEntryFees,
      grandTotalRaised,
      grandTotalCollected,
      grandTotalPending,
      aedStationsFunded,
      gateCheckedIn,
    };
  }, [activePasses, sponsors, clubs]);

  // Team performance breakdown
  const teamBreakdown = useMemo(() => {
    return groups.map((g) => {
      const teamPasses = activePasses.filter(p => p.seller?.group_id === g.id);
      const passesAmount = teamPasses.reduce(
        (sum, p) => sum + (p.payment?.amount || p.band?.price || p.band?.standard_price || 0), 
        0
      );

      const teamMembersList = members.filter(m => m.group_id === g.id);
      const memberIds = new Set(teamMembersList.map(m => m.id));

      const teamSponsors = sponsors.filter(s => s.brought_by_member_id && memberIds.has(s.brought_by_member_id));
      const sponsorsAmount = teamSponsors.reduce((sum, s) => sum + (s.amount || 0), 0);

      const totalRaised = passesAmount + sponsorsAmount;

      return {
        groupId: g.id,
        groupName: g.name,
        memberCount: teamMembersList.length,
        passesCount: teamPasses.length,
        passesAmount,
        sponsorsCount: teamSponsors.length,
        sponsorsAmount,
        totalRaised,
      };
    }).sort((a, b) => b.totalRaised - a.totalRaised);
  }, [groups, activePasses, members, sponsors]);

  // Handle Export Excel
  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      const res = await fetch('/api/export');
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Hrudhayam-LIVE-Reconciliation-${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('Master reconciliation workbook downloaded');
    } catch (err: any) {
      toast.error('Error generating spreadsheet export');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header with Export Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#0B1724] p-5 rounded-2xl border border-[#1D3249] shadow-xl">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold mb-1">
            <Heart className="w-3 h-3 fill-amber-400" />
            <span>Public-Access AED Project</span>
          </div>
          <h2 className="text-xl font-black text-white">Event Audit & Reconciliation</h2>
          <p className="text-xs text-slate-400">
            Real-time verified revenue across passes, sponsorships, and clubs.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Export to Excel */}
          <Button
            onClick={handleExportExcel}
            disabled={isExporting}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5 h-10 shadow-lg shadow-emerald-950/40"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>{isExporting ? 'Generating Excel...' : 'Master Excel Export'}</span>
          </Button>
        </div>
      </div>

      {/* 2. Top Level KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Funds Raised */}
        <Card className="bg-[#0B1724] border-[#1D3249]">
          <CardContent className="p-5">
            <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
              <span>Total Funds Raised</span>
              <Award className="w-4 h-4 text-amber-400" />
            </div>
            <p className="text-3xl font-black text-white mt-2">
              {formatINR(metrics.grandTotalRaised)}
            </p>
            <div className="flex items-center justify-between text-[11px] mt-2 pt-2 border-t border-[#1D3249]">
              <span className="text-emerald-400 font-bold">
                ✓ {formatINR(metrics.grandTotalCollected)} collected
              </span>
              {metrics.grandTotalPending > 0 && (
                <span className="text-yellow-400 font-medium">
                  {formatINR(metrics.grandTotalPending)} pending
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* AED Stations Goal */}
        <Card className="bg-gradient-to-br from-[#0B1724] to-[#122A3F] border-[#1E3A52]">
          <CardContent className="p-5">
            <div className="flex items-center justify-between text-xs text-amber-300 font-medium">
              <span>AED Stations Funded</span>
              <Heart className="w-4 h-4 fill-rose-500 text-rose-500" />
            </div>
            <p className="text-3xl font-black text-amber-400 mt-2">
              {metrics.aedStationsFunded} <span className="text-base font-normal text-slate-300">Stations</span>
            </p>
            <p className="text-[11px] text-slate-400 mt-2 pt-2 border-t border-[#1E3A52]">
              Goal: ₹1,50,000 per fully equipped public AED post
            </p>
          </CardContent>
        </Card>

        {/* Passes Sold */}
        <Card className="bg-[#0B1724] border-[#1D3249]">
          <CardContent className="p-5">
            <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
              <span>Passes Issued</span>
              <Layers className="w-4 h-4 text-blue-400" />
            </div>
            <p className="text-3xl font-black text-white mt-2">
              {metrics.passesSold} <span className="text-base font-normal text-slate-400">Passes</span>
            </p>
            <p className="text-[11px] text-slate-400 mt-2 pt-2 border-t border-[#1D3249]">
              Value: {formatINR(metrics.passesTotal)}
            </p>
          </CardContent>
        </Card>

        {/* Gate Attendance */}
        <Card className="bg-[#0B1724] border-[#1D3249]">
          <CardContent className="p-5">
            <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
              <span>Gate Checked-In</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-3xl font-black text-emerald-400 mt-2">
              {metrics.gateCheckedIn} <span className="text-base font-normal text-slate-400">Guests</span>
            </p>
            <p className="text-[11px] text-slate-400 mt-2 pt-2 border-t border-[#1D3249]">
              {metrics.passesSold > 0 ? `${Math.round((metrics.gateCheckedIn / metrics.passesSold) * 100)}% turn-out rate` : '0% turn-out'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 3. Detailed Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-[#0B1724] border border-[#1D3249] p-1.5 rounded-2xl flex-wrap h-auto min-h-12 w-full sm:w-auto gap-1.5">
          <TabsTrigger 
            value="bands" 
            className="text-xs sm:text-sm data-active:bg-amber-500 data-active:text-slate-950 data-[state=active]:bg-amber-500 data-[state=active]:text-slate-950 font-bold gap-2 px-4 py-2 rounded-xl"
          >
            <Layers className="w-4 h-4" />
            Bands Breakdown
          </TabsTrigger>
          <TabsTrigger 
            value="teams" 
            className="text-xs sm:text-sm data-active:bg-amber-500 data-active:text-slate-950 data-[state=active]:bg-amber-500 data-[state=active]:text-slate-950 font-bold gap-2 px-4 py-2 rounded-xl"
          >
            <Users className="w-4 h-4" />
            Teams (8 Groups)
          </TabsTrigger>
          <TabsTrigger 
            value="sponsors" 
            className="text-xs sm:text-sm data-active:bg-amber-500 data-active:text-slate-950 data-[state=active]:bg-amber-500 data-[state=active]:text-slate-950 font-bold gap-2 px-4 py-2 rounded-xl"
          >
            <Building2 className="w-4 h-4" />
            Sponsors ({sponsors.length})
          </TabsTrigger>
          <TabsTrigger 
            value="clubs" 
            className="text-xs sm:text-sm data-active:bg-amber-500 data-active:text-slate-950 data-[state=active]:bg-amber-500 data-[state=active]:text-slate-950 font-bold gap-2 px-4 py-2 rounded-xl"
          >
            <ShieldCheck className="w-4 h-4" />
            Participating Clubs ({clubs.length})
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: Bands Breakdown */}
        <TabsContent value="bands" className="space-y-4">
          <div className="bg-[#0B1724] rounded-2xl border border-[#1D3249] overflow-hidden shadow-xl">
            <div className="p-4 border-b border-[#1D3249]">
              <h3 className="text-sm font-bold text-white">Seating Bands Allocation & Derived Availability</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Remaining seats are derived live as (Total Allocated - Sold - Active Holds).
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#07111C] text-slate-400 border-b border-[#1D3249]">
                    <th className="p-3 pl-4">Band</th>
                    <th className="p-3">Price</th>
                    <th className="p-3 text-right">Allocated</th>
                    <th className="p-3 text-right">Sold</th>
                    <th className="p-3 text-right">Active Holds</th>
                    <th className="p-3 text-right">Remaining</th>
                    <th className="p-3 text-right">Collected (₹)</th>
                    <th className="p-3 text-right">Pending (₹)</th>
                    <th className="p-3 pr-4 text-right font-bold">Total Value (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1D3249]/60 text-slate-200">
                  {bands.map((b) => {
                    const price = b.price || 0;
                    const allocated = b.total_allocated || 0;
                    const sold = b.sold_count || 0;
                    const holds = b.active_holds_count || 0;
                    const remaining = b.remaining_count !== undefined ? b.remaining_count : Math.max(0, allocated - sold - holds);
                    const collected = b.collected_amount || (sold * price);
                    const pending = b.pending_amount || 0;
                    const totalVal = collected + pending;

                    return (
                      <tr key={b.id} className="hover:bg-[#0E2032] transition-colors">
                        <td className="p-3 pl-4 font-bold text-white">
                          {b.label}
                        </td>
                        <td className="p-3 font-mono text-amber-400 font-bold">
                          ₹{price.toLocaleString('en-IN')}
                        </td>
                        <td className="p-3 text-right font-mono font-medium">
                          {allocated}
                        </td>
                        <td className="p-3 text-right font-mono text-emerald-400 font-bold">
                          {sold}
                        </td>
                        <td className="p-3 text-right font-mono text-yellow-400">
                          {holds}
                        </td>
                        <td className="p-3 text-right font-mono text-white font-bold">
                          {remaining}
                        </td>
                        <td className="p-3 text-right font-mono text-emerald-400">
                          {formatINR(collected)}
                        </td>
                        <td className="p-3 text-right font-mono text-yellow-400">
                          {formatINR(pending)}
                        </td>
                        <td className="p-3 pr-4 text-right font-mono font-bold text-white">
                          {formatINR(totalVal)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* TAB 2: Teams Breakdown */}
        <TabsContent value="teams" className="space-y-4">
          <div className="bg-[#0B1724] rounded-2xl border border-[#1D3249] overflow-hidden shadow-xl">
            <div className="p-4 border-b border-[#1D3249]">
              <h3 className="text-sm font-bold text-white">Team Performance Summary (8 Teams)</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Aggregated sales and sponsorships attributed to members of each team.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#07111C] text-slate-400 border-b border-[#1D3249]">
                    <th className="p-3 pl-4">Team</th>
                    <th className="p-3 text-right">Members</th>
                    <th className="p-3 text-right">Passes Sold</th>
                    <th className="p-3 text-right">Passes Value (₹)</th>
                    <th className="p-3 text-right">Sponsors (₹)</th>
                    <th className="p-3 pr-4 text-right font-bold">Total Raised (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1D3249]/60 text-slate-200">
                  {teamBreakdown.map((t, idx) => (
                    <tr key={t.groupId} className="hover:bg-[#0E2032] transition-colors">
                      <td className="p-3 pl-4">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-[10px]">
                            {idx + 1}
                          </span>
                          <div>
                            <p className="font-bold text-white">Team {t.groupId}: {t.groupName}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 text-right font-mono text-slate-300">
                        {t.memberCount}
                      </td>
                      <td className="p-3 text-right font-mono text-emerald-400 font-bold">
                        {t.passesCount}
                      </td>
                      <td className="p-3 text-right font-mono text-white">
                        {formatINR(t.passesAmount)}
                      </td>
                      <td className="p-3 text-right font-mono text-amber-400">
                        {formatINR(t.sponsorsAmount)}
                      </td>
                      <td className="p-3 pr-4 text-right font-mono font-black text-amber-400 text-sm">
                        {formatINR(t.totalRaised)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* TAB 3: Sponsors */}
        <TabsContent value="sponsors" className="space-y-4">
          <div className="bg-[#0B1724] rounded-2xl border border-[#1D3249] overflow-hidden shadow-xl">
            <div className="p-4 border-b border-[#1D3249] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">Corporate Sponsorships</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Total committed sponsorships: {formatINR(metrics.sponsorsTotal)}
                </p>
              </div>
              <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/30 text-xs">
                {sponsors.length} Sponsors
              </Badge>
            </div>
            {sponsors.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs">
                No corporate sponsors registered yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#07111C] text-slate-400 border-b border-[#1D3249]">
                      <th className="p-3 pl-4">Sponsor Name</th>
                      <th className="p-3">Tier</th>
                      <th className="p-3 text-right">Amount (₹)</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 pr-4">Brought By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1D3249]/60 text-slate-200">
                    {sponsors.map((s) => (
                      <tr key={s.id} className="hover:bg-[#0E2032] transition-colors">
                        <td className="p-3 pl-4 font-bold text-white">
                          {s.sponsor_name}
                        </td>
                        <td className="p-3">
                          <Badge className="bg-[#07111C] border-[#1D3249] text-slate-300 capitalize text-[10px]">
                            {s.tier?.replace(/_/g, ' ')}
                          </Badge>
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-amber-400 text-sm">
                          {formatINR(s.amount)}
                        </td>
                        <td className="p-3">
                          <Badge className={`text-[10px] font-bold ${
                            s.status === 'received'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
                          }`}>
                            {s.status === 'received' ? '✓ Received' : 'Committed'}
                          </Badge>
                        </td>
                        <td className="p-3 pr-4 text-slate-300">
                          {s.brought_by_member?.full_name || 'Direct / General'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>

        {/* TAB 4: Participating Clubs */}
        <TabsContent value="clubs" className="space-y-4">
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-xs text-amber-200 leading-relaxed">
            <div className="flex items-center gap-2 font-bold text-amber-400 text-sm mb-1">
              <ShieldCheck className="w-4 h-4" />
              <span>Rule R7: Ring-Fenced Participating Clubs</span>
            </div>
            Each participating club pays a ₹25,000 entry fee and receives ₹15,000 worth of passes, yielding a ₹10,000 net contribution to the AED cause. As per business rule R7, this revenue is ring-fenced and excluded from individual sales leaderboard competition.
          </div>

          <div className="bg-[#0B1724] rounded-2xl border border-[#1D3249] overflow-hidden shadow-xl">
            <div className="p-4 border-b border-[#1D3249] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">Participating Clubs Register</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Total Entry Fees: {formatINR(metrics.clubsTotalEntryFees)} • Net Contribution: {formatINR(metrics.clubsNetContribution)}
                </p>
              </div>
              <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/30 text-xs">
                {clubs.length} Clubs
              </Badge>
            </div>
            {clubs.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs">
                No participating clubs registered yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#07111C] text-slate-400 border-b border-[#1D3249]">
                      <th className="p-3 pl-4">Club Name</th>
                      <th className="p-3">Contact</th>
                      <th className="p-3 text-right">Entry Fee</th>
                      <th className="p-3 text-right">Passes Value</th>
                      <th className="p-3 text-right">Net Contribution</th>
                      <th className="p-3 pr-4">Brought By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1D3249]/60 text-slate-200">
                    {clubs.map((c) => (
                      <tr key={c.id} className="hover:bg-[#0E2032] transition-colors">
                        <td className="p-3 pl-4 font-bold text-white">
                          {c.club_name}
                        </td>
                        <td className="p-3 text-slate-300">
                          <div>
                            <p className="font-medium text-white">{c.contact_name}</p>
                            <p className="text-[11px] text-slate-400">{c.contact_phone}</p>
                          </div>
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-white">
                          {formatINR(c.entry_fee || 25000)}
                        </td>
                        <td className="p-3 text-right font-mono text-blue-400">
                          {formatINR(c.passes_value || 15000)}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-emerald-400">
                          {formatINR(c.net_contribution || 10000)}
                        </td>
                        <td className="p-3 pr-4 text-slate-300">
                          {c.brought_by_member?.full_name || 'General / Club'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
