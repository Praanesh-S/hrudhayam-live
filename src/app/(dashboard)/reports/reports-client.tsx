'use client';

import { useState } from 'react';
import { 
  FileSpreadsheet, 
  Users, 
  CheckCircle2, 
  Clock, 
  IndianRupee, 
  Building2, 
  Layers, 
  ShieldAlert, 
  Tag, 
  Award,
  Filter
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatINR, OBLIGATION_LABELS } from '@/lib/constants';
import { SPONSOR_TIERS, formatSponsorTier, type SponsorTierValue } from '@/lib/sponsor-constants';
import type { Seat, Profile, Sponsor, TeamMemberStats } from '@/lib/types';

interface ReportsClientProps {
  seats: Seat[];
  teamMembers: Profile[];
  sponsors: Sponsor[];
  isSuperAdmin: boolean;
}

export function ReportsClient({ seats, teamMembers, sponsors, isSuperAdmin }: ReportsClientProps) {
  const [memberSearch, setMemberSearch] = useState('');

  // 1. Overall Calculations
  const totalSeats = seats.length;
  const filledSeats = seats.filter(s => s.guest_name && s.guest_name.trim() !== '').length;
  const paidSeats = seats.filter(s => (s.payment_status || '').toLowerCase() === 'received').length;
  const ticketsSent = seats.filter(s => s.ticket_sent).length;
  const checkedInCount = seats.filter(s => s.checked_in).length;

  const totalValue = seats.reduce((sum, s) => sum + (s.tier || 0), 0);
  const receivedValue = seats
    .filter(s => (s.payment_status || '').toLowerCase() === 'received')
    .reduce((sum, s) => sum + (s.tier || 0), 0);
  const pendingValue = seats
    .filter(s => s.guest_name && (s.payment_status || '').toLowerCase() === 'pending')
    .reduce((sum, s) => sum + (s.tier || 0), 0);

  // 2. By Tier Calculations
  const getTierStats = (tierValue: number) => {
    const tierSeats = seats.filter(s => s.tier === tierValue);
    const count = tierSeats.length;
    const filled = tierSeats.filter(s => s.guest_name).length;
    const paid = tierSeats.filter(s => (s.payment_status || '').toLowerCase() === 'received').length;
    const val = count * tierValue;
    const rec = paid * tierValue;
    const pen = (filled - paid) * tierValue;
    return { count, filled, paid, value: val, received: rec, pending: pen };
  };

  const stats5000 = getTierStats(5000);
  const stats3000 = getTierStats(3000);
  const stats1500 = getTierStats(1500);

  // 3. By Obligation Calculations
  const obligationTypes = ['chief', 'police', 'corp', 'other'] as const;
  const obligationStats = obligationTypes.map(ob => {
    const obSeats = seats.filter(s => s.obligation === ob);
    const count = obSeats.length;
    const filled = obSeats.filter(s => s.guest_name).length;
    const checkedIn = obSeats.filter(s => s.checked_in).length;
    const rows = [...new Set(obSeats.map(s => s.row_label))].join(', ');
    return {
      type: ob,
      label: OBLIGATION_LABELS[ob] || ob,
      count,
      filled,
      checkedIn,
      rows: rows || '—',
    };
  });

  // 4. By Team Member Breakdown
  const teamMemberBreakdown = teamMembers.map(member => {
    const memberSeats = seats.filter(s => s.owner_id === member.id);
    const rows = [...new Set(memberSeats.map(s => `${s.section === 'Ground Floor' ? 'GF' : 'BAL'}-${s.row_label}`))].join(', ');
    const count = memberSeats.length;
    const filled = memberSeats.filter(s => s.guest_name).length;
    const paid = memberSeats.filter(s => (s.payment_status || '').toLowerCase() === 'received').length;
    const sent = memberSeats.filter(s => s.ticket_sent).length;
    const checkedIn = memberSeats.filter(s => s.checked_in).length;
    const val = memberSeats.reduce((sum, s) => sum + (s.tier || 0), 0);
    const rec = memberSeats
      .filter(s => (s.payment_status || '').toLowerCase() === 'received')
      .reduce((sum, s) => sum + (s.tier || 0), 0);
    const pen = memberSeats
      .filter(s => s.guest_name && (s.payment_status || '').toLowerCase() === 'pending')
      .reduce((sum, s) => sum + (s.tier || 0), 0);

    return {
      id: member.id,
      name: member.full_name,
      email: member.email,
      role: member.role,
      rows: rows || 'Unassigned',
      seatsHeld: count,
      seatsFilled: filled,
      seatsPaid: paid,
      ticketsSent: sent,
      checkedIn,
      value: val,
      received: rec,
      pending: pen,
    };
  }).filter(m => m.seatsHeld > 0 || isSuperAdmin);

  const filteredTeamMembers = teamMemberBreakdown.filter(m => 
    m.name.toLowerCase().includes(memberSearch.toLowerCase()) ||
    m.email.toLowerCase().includes(memberSearch.toLowerCase()) ||
    m.rows.toLowerCase().includes(memberSearch.toLowerCase())
  );

  // 5. By Sponsor Breakdown
  const sponsorBreakdown = sponsors.map(sponsor => {
    const taggedSeats = seats.filter(s => s.sponsor_id === sponsor.id);
    const checkedIn = taggedSeats.filter(s => s.checked_in).length;
    const tierConfig = SPONSOR_TIERS.find(t => t.value === sponsor.sponsor_tier);
    return {
      id: sponsor.id,
      name: sponsor.name,
      tier: sponsor.sponsor_tier,
      tierLabel: tierConfig?.label || sponsor.sponsor_tier,
      tierAmount: tierConfig?.amount || 0,
      complimentaryCount: sponsor.complimentary_pass_count,
      taggedCount: taggedSeats.length,
      checkedInCount: checkedIn,
      contact: sponsor.contact_name ? `${sponsor.contact_name} (${sponsor.contact_phone || sponsor.contact_email || ''})` : '—',
    };
  });

  // 6. By Section Breakdown (Ground vs Balcony)
  const gfSeats = seats.filter(s => s.section === 'Ground Floor');
  const balSeats = seats.filter(s => s.section === 'Balcony');

  const getSectionStats = (sectionSeats: Seat[]) => {
    const total = sectionSeats.length;
    const filled = sectionSeats.filter(s => s.guest_name).length;
    const paid = sectionSeats.filter(s => (s.payment_status || '').toLowerCase() === 'received').length;
    const checkedIn = sectionSeats.filter(s => s.checked_in).length;
    const val = sectionSeats.reduce((sum, s) => sum + (s.tier || 0), 0);
    const rec = sectionSeats
      .filter(s => (s.payment_status || '').toLowerCase() === 'received')
      .reduce((sum, s) => sum + (s.tier || 0), 0);
    return { total, filled, paid, checkedIn, val, rec };
  };

  const gfStats = getSectionStats(gfSeats);
  const balStats = getSectionStats(balSeats);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* 1. Header Banner & Excel Export */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#131F2E] p-5 rounded-2xl border border-[#223345] shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Award className="w-5 h-5 text-[#E8913A]" />
            Event Financial & Operations Reconciliation
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time multi-dimensional reports: team member sales, tier yields, sponsors, and obligations.
          </p>
        </div>
        
        <a href="/api/export" target="_blank" download>
          <Button className="bg-[#E8913A] hover:bg-[#D97706] text-slate-950 font-bold text-xs gap-1.5 shadow-md shadow-amber-950/20">
            <FileSpreadsheet className="h-4 w-4" />
            <span>Download Multi-Sheet Excel (.xlsx)</span>
          </Button>
        </a>
      </div>

      {/* 2. Top Summary KPI Cards */}
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
              {filledSeats} filled ({totalSeats > 0 ? Math.round((filledSeats / totalSeats) * 100) : 0}%) • {ticketsSent} sent
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

      {/* 3. Deep Multi-Tab Breakdown Section */}
      <Tabs defaultValue="by-team" className="space-y-4">
        <TabsList className="bg-[#131F2E] border border-[#223345] p-1 rounded-xl flex-wrap">
          <TabsTrigger value="by-team" className="text-xs font-semibold text-slate-300 data-[state=active]:bg-[#1A2839] data-[state=active]:text-white">
            By Team Member ({teamMemberBreakdown.length})
          </TabsTrigger>
          <TabsTrigger value="by-tier" className="text-xs font-semibold text-slate-300 data-[state=active]:bg-[#1A2839] data-[state=active]:text-white">
            By Pricing Tier
          </TabsTrigger>
          <TabsTrigger value="by-sponsor" className="text-xs font-semibold text-slate-300 data-[state=active]:bg-[#1A2839] data-[state=active]:text-white">
            By Sponsor ({sponsors.length})
          </TabsTrigger>
          <TabsTrigger value="by-obligation" className="text-xs font-semibold text-slate-300 data-[state=active]:bg-[#1A2839] data-[state=active]:text-white">
            By Obligation
          </TabsTrigger>
          <TabsTrigger value="by-section" className="text-xs font-semibold text-slate-300 data-[state=active]:bg-[#1A2839] data-[state=active]:text-white">
            By Section / Floor
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: By Team Member (Who is in charge of what) */}
        <TabsContent value="by-team" className="space-y-4">
          <Card className="bg-[#131F2E] border-[#223345] rounded-2xl shadow-xs overflow-hidden">
            <CardHeader className="bg-[#0E1724] pb-3 border-b border-[#223345] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base font-bold text-white">
                  Team Member Sales & Row In-Charge Breakdown
                </CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Tracks which team member holds which rows, passes filled, and money collected vs pending.
                </CardDescription>
              </div>

              <div className="w-full sm:w-64">
                <Input
                  placeholder="Filter team member or row..."
                  value={memberSearch}
                  onChange={e => setMemberSearch(e.target.value)}
                  className="bg-[#1A2839] border-[#2A3F55] text-white text-xs h-8"
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-[#0E1724]">
                  <TableRow className="border-[#223345] text-xs">
                    <TableHead className="text-slate-300 font-semibold">Team Member</TableHead>
                    <TableHead className="text-slate-300 font-semibold">Rows In Charge</TableHead>
                    <TableHead className="text-slate-300 font-semibold text-center">Seats Held</TableHead>
                    <TableHead className="text-slate-300 font-semibold text-center">Filled</TableHead>
                    <TableHead className="text-slate-300 font-semibold text-center">Paid</TableHead>
                    <TableHead className="text-slate-300 font-semibold text-center">Tickets Sent</TableHead>
                    <TableHead className="text-slate-300 font-semibold">Potential Value</TableHead>
                    <TableHead className="text-slate-300 font-semibold text-emerald-400">Collected</TableHead>
                    <TableHead className="text-right pr-6 text-slate-300 text-amber-400">Pending</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTeamMembers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-slate-400">
                        No team member allocations matching filter.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredTeamMembers.map(m => (
                      <TableRow key={m.id} className="border-[#1E2D3D] hover:bg-[#1A2839]/60 text-xs">
                        <TableCell className="font-bold text-white">
                          <div>{m.name}</div>
                          <span className="text-[10px] text-slate-400 block">{m.email}</span>
                        </TableCell>
                        <TableCell className="font-mono text-amber-300 font-semibold max-w-[200px] truncate" title={m.rows}>
                          {m.rows}
                        </TableCell>
                        <TableCell className="text-center font-mono font-bold text-white">{m.seatsHeld}</TableCell>
                        <TableCell className="text-center font-mono text-slate-200">{m.seatsFilled}</TableCell>
                        <TableCell className="text-center font-mono text-emerald-400 font-bold">{m.seatsPaid}</TableCell>
                        <TableCell className="text-center font-mono text-slate-300">{m.ticketsSent}</TableCell>
                        <TableCell className="font-mono font-bold text-white">{formatINR(m.value)}</TableCell>
                        <TableCell className="font-mono font-bold text-emerald-400">{formatINR(m.received)}</TableCell>
                        <TableCell className="font-mono font-bold text-amber-400 text-right pr-6">{formatINR(m.pending)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: By Pricing Tier */}
        <TabsContent value="by-tier" className="space-y-4">
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
                    <TableHead className="text-slate-300 text-center">Total Seats</TableHead>
                    <TableHead className="text-slate-300 text-center">Filled Passes</TableHead>
                    <TableHead className="text-slate-300 text-center">Paid Passes</TableHead>
                    <TableHead className="text-slate-300">Potential Value</TableHead>
                    <TableHead className="text-slate-300 text-emerald-400">Collected</TableHead>
                    <TableHead className="text-right pr-6 text-slate-300 text-amber-400">Pending</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow className="border-b border-[#1E2D3D] hover:bg-[#1A2839]/60">
                    <TableCell className="font-semibold">
                      <Badge className="bg-[#B8860B]/30 text-[#FACC15] border border-[#B8860B]/60 font-bold">
                        ₹5,000 Tier (Platinum)
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-slate-300 text-center">{stats5000.count}</TableCell>
                    <TableCell className="font-mono text-xs text-slate-300 text-center">{stats5000.filled}</TableCell>
                    <TableCell className="font-mono text-xs text-emerald-400 font-bold text-center">{stats5000.paid}</TableCell>
                    <TableCell className="font-mono text-xs font-bold text-white">{formatINR(stats5000.value)}</TableCell>
                    <TableCell className="font-mono text-xs font-bold text-emerald-400">{formatINR(stats5000.received)}</TableCell>
                    <TableCell className="font-mono text-xs font-bold text-amber-400 text-right pr-6">{formatINR(stats5000.pending)}</TableCell>
                  </TableRow>

                  <TableRow className="border-b border-[#1E2D3D] hover:bg-[#1A2839]/60">
                    <TableCell className="font-semibold">
                      <Badge className="bg-[#0D9488]/30 text-[#2DD4BF] border border-[#0D9488]/60 font-bold">
                        ₹3,000 Tier (Gold)
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-slate-300 text-center">{stats3000.count}</TableCell>
                    <TableCell className="font-mono text-xs text-slate-300 text-center">{stats3000.filled}</TableCell>
                    <TableCell className="font-mono text-xs text-emerald-400 font-bold text-center">{stats3000.paid}</TableCell>
                    <TableCell className="font-mono text-xs font-bold text-white">{formatINR(stats3000.value)}</TableCell>
                    <TableCell className="font-mono text-xs font-bold text-emerald-400">{formatINR(stats3000.received)}</TableCell>
                    <TableCell className="font-mono text-xs font-bold text-amber-400 text-right pr-6">{formatINR(stats3000.pending)}</TableCell>
                  </TableRow>

                  <TableRow className="border-b border-[#1E2D3D] hover:bg-[#1A2839]/60">
                    <TableCell className="font-semibold">
                      <Badge className="bg-slate-800 text-slate-300 border border-slate-600 font-bold">
                        ₹1,500 Tier (Silver)
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-slate-300 text-center">{stats1500.count}</TableCell>
                    <TableCell className="font-mono text-xs text-slate-300 text-center">{stats1500.filled}</TableCell>
                    <TableCell className="font-mono text-xs text-emerald-400 font-bold text-center">{stats1500.paid}</TableCell>
                    <TableCell className="font-mono text-xs font-bold text-white">{formatINR(stats1500.value)}</TableCell>
                    <TableCell className="font-mono text-xs font-bold text-emerald-400">{formatINR(stats1500.received)}</TableCell>
                    <TableCell className="font-mono text-xs font-bold text-amber-400 text-right pr-6">{formatINR(stats1500.pending)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: By Sponsor */}
        <TabsContent value="by-sponsor" className="space-y-4">
          <Card className="bg-[#131F2E] border-[#223345] shadow-xs rounded-2xl overflow-hidden">
            <CardHeader className="bg-[#0E1724] pb-3 border-b border-[#223345]">
              <CardTitle className="text-base font-bold text-white">
                Sponsor Complimentary Allocation Summary
              </CardTitle>
              <CardDescription className="text-xs text-slate-400">
                Tracks corporate sponsorships, complimentary seat allocations, and check-in status.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-[#0E1724]">
                  <TableRow className="border-[#223345] text-xs">
                    <TableHead className="text-slate-300 font-semibold">Sponsor Name</TableHead>
                    <TableHead className="text-slate-300 font-semibold">Sponsorship Tier</TableHead>
                    <TableHead className="text-slate-300 font-semibold text-center">Entitlement</TableHead>
                    <TableHead className="text-slate-300 font-semibold text-center">Seats Tagged</TableHead>
                    <TableHead className="text-slate-300 font-semibold text-center">Checked In</TableHead>
                    <TableHead className="text-right pr-6 text-slate-300">Contact</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sponsorBreakdown.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-slate-400">
                        No corporate sponsors registered yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    sponsorBreakdown.map(s => (
                      <TableRow key={s.id} className="border-[#1E2D3D] hover:bg-[#1A2839]/60 text-xs">
                        <TableCell className="font-bold text-white">{s.name}</TableCell>
                        <TableCell>
                          <Badge className="bg-[#1A2839] text-amber-300 border-[#2A3F55]">
                            {s.tierLabel} • {formatINR(s.tierAmount)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center font-mono font-bold text-white">{s.complimentaryCount}</TableCell>
                        <TableCell className="text-center">
                          <span className={`px-2 py-0.5 rounded-md font-mono font-bold ${
                            s.taggedCount >= s.complimentaryCount ? 'bg-emerald-950 text-emerald-300' : 'bg-slate-800 text-slate-300'
                          }`}>
                            {s.taggedCount} / {s.complimentaryCount}
                          </span>
                        </TableCell>
                        <TableCell className="text-center font-mono text-sky-400 font-bold">{s.checkedInCount}</TableCell>
                        <TableCell className="text-right pr-6 text-slate-400">{s.contact}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 4: By Obligation */}
        <TabsContent value="by-obligation" className="space-y-4">
          <Card className="bg-[#131F2E] border-[#223345] shadow-xs rounded-2xl overflow-hidden">
            <CardHeader className="bg-[#0E1724] pb-3 border-b border-[#223345]">
              <CardTitle className="text-base font-bold text-white">
                Obligation & Official Seat Allocation
              </CardTitle>
              <CardDescription className="text-xs text-slate-400">
                Breakdown of complimentary seating reserved for Chief Guests, Police, and Government Officials.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-[#0E1724]">
                  <TableRow className="border-[#223345] text-xs">
                    <TableHead className="text-slate-300 font-semibold">Obligation Category</TableHead>
                    <TableHead className="text-slate-300 font-semibold text-center">Total Seats</TableHead>
                    <TableHead className="text-slate-300 font-semibold text-center">Guests Assigned</TableHead>
                    <TableHead className="text-slate-300 font-semibold text-center">Checked In</TableHead>
                    <TableHead className="text-right pr-6 text-slate-300">Assigned Rows</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {obligationStats.map(ob => (
                    <TableRow key={ob.type} className="border-[#1E2D3D] hover:bg-[#1A2839]/60 text-xs">
                      <TableCell className="font-bold text-purple-300">{ob.label}</TableCell>
                      <TableCell className="text-center font-mono font-bold text-white">{ob.count}</TableCell>
                      <TableCell className="text-center font-mono text-slate-200">{ob.filled}</TableCell>
                      <TableCell className="text-center font-mono text-sky-400 font-bold">{ob.checkedIn}</TableCell>
                      <TableCell className="text-right pr-6 font-mono text-slate-400">{ob.rows}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 5: By Section */}
        <TabsContent value="by-section" className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card className="bg-[#131F2E] border-[#223345] rounded-2xl p-5 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-[#223345]">
                <h3 className="font-bold text-white text-base">Ground Floor (648 Seats)</h3>
                <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40">Rows A–N</Badge>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-4 text-xs">
                <div>
                  <span className="text-slate-400 block">Filled Passes:</span>
                  <span className="text-lg font-bold text-white font-mono">{gfStats.filled} / {gfStats.total}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Paid Donations:</span>
                  <span className="text-lg font-bold text-emerald-400 font-mono">{gfStats.paid}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Potential Revenue:</span>
                  <span className="text-sm font-bold text-white font-mono">{formatINR(gfStats.val)}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Collected Revenue:</span>
                  <span className="text-sm font-bold text-emerald-400 font-mono">{formatINR(gfStats.rec)}</span>
                </div>
              </div>
            </Card>

            <Card className="bg-[#131F2E] border-[#223345] rounded-2xl p-5 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-[#223345]">
                <h3 className="font-bold text-white text-base">Balcony (750 Seats)</h3>
                <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40">Rows A–N</Badge>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-4 text-xs">
                <div>
                  <span className="text-slate-400 block">Filled Passes:</span>
                  <span className="text-lg font-bold text-white font-mono">{balStats.filled} / {balStats.total}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Paid Donations:</span>
                  <span className="text-lg font-bold text-emerald-400 font-mono">{balStats.paid}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Potential Revenue:</span>
                  <span className="text-sm font-bold text-white font-mono">{formatINR(balStats.val)}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Collected Revenue:</span>
                  <span className="text-sm font-bold text-emerald-400 font-mono">{formatINR(balStats.rec)}</span>
                </div>
              </div>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
