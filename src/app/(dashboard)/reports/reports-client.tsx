'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatINR, BANDS_CONFIG } from '@/lib/constants';
import { Band, Profile, Sponsor, ReservedPool, ReservedEntry, Sale } from '@/lib/types';
import { 
  BarChart3, 
  FileSpreadsheet, 
  Users, 
  Layers, 
  Building2, 
  ShieldCheck, 
  Download, 
  Share2, 
  Printer, 
  CheckCircle2,
  Clock,
  Sparkles
} from 'lucide-react';
import { toast } from 'sonner';

interface ReportsClientProps {
  bands: Band[];
  sales: Sale[];
  teamMembers: Profile[];
  sponsors: Sponsor[];
  pools: (ReservedPool & { entries: ReservedEntry[] })[];
  userRole: string;
}

export function ReportsClient({ bands, sales, teamMembers, sponsors, pools, userRole }: ReportsClientProps) {
  const [activeTab, setActiveTab] = useState('bands');
  const [isExporting, setIsExporting] = useState(false);

  // 1. Calculate overall event totals
  const totalCapacity = bands.reduce((acc, b) => acc + (b.total_capacity || 0), 0);
  const totalSold = sales.filter(s => !s.cancelled).length;
  const totalRemaining = Math.max(0, totalCapacity - totalSold);
  const totalCollected = sales.filter(s => !s.cancelled && s.payment_status === 'paid').reduce((acc, s) => acc + (s.collected_amount || s.standard_price), 0);
  const totalPending = sales.filter(s => !s.cancelled && s.payment_status === 'pending').reduce((acc, s) => acc + (s.standard_price - (s.discount_amount || 0)), 0);
  const totalDiscount = sales.filter(s => !s.cancelled).reduce((acc, s) => acc + (s.discount_amount || 0), 0);
  const totalPotential = totalCollected + totalPending;

  // 2. Aggregate By Team Member
  const teamMemberStats = teamMembers.map((member) => {
    const memberSales = sales.filter(s => !s.cancelled && s.sold_by === member.id);
    const seatsSold = memberSales.length;
    const standardValue = memberSales.reduce((acc, s) => acc + s.standard_price, 0);
    const collected = memberSales.filter(s => s.payment_status === 'paid').reduce((acc, s) => acc + (s.collected_amount || s.standard_price), 0);
    const pending = memberSales.filter(s => s.payment_status === 'pending').reduce((acc, s) => acc + (s.standard_price - (s.discount_amount || 0)), 0);
    const discounts = memberSales.reduce((acc, s) => acc + (s.discount_amount || 0), 0);
    const whatsapp = memberSales.filter(s => s.issuance_type === 'whatsapp').length;
    const printed = memberSales.filter(s => s.issuance_type === 'printed').length;
    const unissued = memberSales.filter(s => s.issuance_type == null).length;

    return {
      userId: member.id,
      name: member.full_name || 'Team Member',
      email: member.email,
      role: member.role,
      seatsSold,
      standardValue,
      collected,
      pending,
      discounts,
      whatsapp,
      printed,
      unissued,
    };
  }).filter(m => m.seatsSold > 0 || m.role === 'sub_admin' || m.role === 'super_admin');

  // 3. Aggregate By Sponsor
  const sponsorStats = sponsors.map((sp) => {
    const taggedSales = sales.filter(s => !s.cancelled && s.sponsor_id === sp.id);
    const taggedCount = taggedSales.length;
    const checkedInCount = taggedSales.filter(s => s.checked_in).length;

    return {
      id: sp.id,
      name: sp.name,
      tier: sp.sponsor_tier,
      quota: sp.complimentary_pass_count,
      tagged: taggedCount,
      checkedIn: checkedInCount,
    };
  });

  // Export to Excel handler
  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      const res = await fetch('/api/export');
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Hrudhayam-Live-Reconciliation-${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('Reconciliation spreadsheet exported successfully');
    } catch (err: any) {
      toast.error('Error generating spreadsheet export');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* 1. Header & Export Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#0F2236] p-5 rounded-2xl border border-[#243D56] shadow-xl text-white">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-[#E8913A]" />
            <span>Fundraising & Pass Reconciliation Reports</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Transparent breakdown across bands, team member sales, sponsors, and reserved quotas.
          </p>
        </div>

        <Button
          onClick={handleExportExcel}
          disabled={isExporting}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl h-10 px-4 gap-2 shadow-lg shadow-emerald-950/40 cursor-pointer"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>{isExporting ? 'Generating Excel...' : 'Export 5-Sheet Excel'}</span>
        </Button>
      </div>

      {/* 2. Key Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-[#131F2E] p-4 rounded-2xl border border-[#223345] shadow-md">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Band Capacity</span>
          <span className="text-xl font-extrabold text-white mt-1 block font-mono">{totalCapacity.toLocaleString()}</span>
        </div>

        <div className="bg-[#131F2E] p-4 rounded-2xl border border-[#223345] shadow-md">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Seats Sold</span>
          <span className="text-xl font-extrabold text-[#E8913A] mt-1 block font-mono">{totalSold.toLocaleString()}</span>
        </div>

        <div className="bg-[#131F2E] p-4 rounded-2xl border border-[#223345] shadow-md">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Remaining Available</span>
          <span className="text-xl font-extrabold text-sky-400 mt-1 block font-mono">{totalRemaining.toLocaleString()}</span>
        </div>

        <div className="bg-[#131F2E] p-4 rounded-2xl border border-[#223345] shadow-md">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Collected Funds</span>
          <span className="text-xl font-extrabold text-emerald-400 mt-1 block font-mono">{formatINR(totalCollected)}</span>
        </div>

        <div className="bg-[#131F2E] p-4 rounded-2xl border border-[#223345] shadow-md">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Pending Payment</span>
          <span className="text-xl font-extrabold text-amber-400 mt-1 block font-mono">{formatINR(totalPending)}</span>
        </div>

        <div className="bg-[#131F2E] p-4 rounded-2xl border border-[#223345] shadow-md">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Concessions Given</span>
          <span className="text-xl font-extrabold text-purple-400 mt-1 block font-mono">{formatINR(totalDiscount)}</span>
        </div>
      </div>

      {/* 3. TABS: BANDS, TEAM MEMBERS, SPONSORS, RESERVED */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-[#131F2E] border border-[#223345] p-1 rounded-xl">
          <TabsTrigger value="bands" className="text-xs font-bold gap-1.5 data-[state=active]:bg-[#1A2839] data-[state=active]:text-amber-400">
            <Layers className="w-3.5 h-3.5" />
            <span>By Price Band</span>
          </TabsTrigger>
          <TabsTrigger value="team" className="text-xs font-bold gap-1.5 data-[state=active]:bg-[#1A2839] data-[state=active]:text-amber-400">
            <Users className="w-3.5 h-3.5" />
            <span>By Team Member</span>
          </TabsTrigger>
          <TabsTrigger value="sponsors" className="text-xs font-bold gap-1.5 data-[state=active]:bg-[#1A2839] data-[state=active]:text-amber-400">
            <Building2 className="w-3.5 h-3.5" />
            <span>By Sponsor</span>
          </TabsTrigger>
          <TabsTrigger value="reserved" className="text-xs font-bold gap-1.5 data-[state=active]:bg-[#1A2839] data-[state=active]:text-amber-400">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Reserved Quotas</span>
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: BY BAND */}
        <TabsContent value="bands">
          <Card className="bg-[#131F2E] border-[#223345] rounded-2xl shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#0E1724] border-b border-[#223345] text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="p-3.5">Price Band</th>
                    <th className="p-3.5">Standard Rate</th>
                    <th className="p-3.5">Total Capacity</th>
                    <th className="p-3.5">Sold</th>
                    <th className="p-3.5">Remaining</th>
                    <th className="p-3.5">Collected</th>
                    <th className="p-3.5">Pending</th>
                    <th className="p-3.5">Discounts</th>
                    <th className="p-3.5 text-right">Occupancy</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E2D3D] text-slate-300">
                  {bands.map((band) => {
                    const sold = band.sold_count || 0;
                    const cap = band.total_capacity || 0;
                    const rem = band.remaining_count || 0;
                    const occ = cap > 0 ? Math.round((sold / cap) * 100) : 0;
                    const config = BANDS_CONFIG.find(c => c.id === band.id);

                    return (
                      <tr key={band.id} className="hover:bg-[#16273A] transition-colors">
                        <td className="p-3.5">
                          <Badge className={`${config?.bgColor || 'bg-amber-500/10'} ${config?.textColor || 'text-amber-400'} border ${config?.borderColor || 'border-amber-500/30'} text-xs font-bold font-mono`}>
                            {band.name}
                          </Badge>
                        </td>
                        <td className="p-3.5 font-mono font-bold text-white">
                          {formatINR(band.standard_price)}
                        </td>
                        <td className="p-3.5 font-mono text-white">{cap}</td>
                        <td className="p-3.5 font-mono font-bold text-[#E8913A]">{sold}</td>
                        <td className="p-3.5 font-mono font-bold text-sky-400">{rem}</td>
                        <td className="p-3.5 font-mono font-bold text-emerald-400">{formatINR(band.collected_amount || 0)}</td>
                        <td className="p-3.5 font-mono font-bold text-amber-400">{formatINR(band.pending_amount || 0)}</td>
                        <td className="p-3.5 font-mono text-purple-400">{formatINR(band.discount_amount || 0)}</td>
                        <td className="p-3.5 text-right font-mono font-bold text-white">{occ}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* TAB 2: BY TEAM MEMBER */}
        <TabsContent value="team">
          <Card className="bg-[#131F2E] border-[#223345] rounded-2xl shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#0E1724] border-b border-[#223345] text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="p-3.5">Team Member</th>
                    <th className="p-3.5">Role</th>
                    <th className="p-3.5">Seats Sold</th>
                    <th className="p-3.5">Standard Value</th>
                    <th className="p-3.5">Collected</th>
                    <th className="p-3.5">Pending</th>
                    <th className="p-3.5">Discounts</th>
                    <th className="p-3.5">WhatsApp Passes</th>
                    <th className="p-3.5 text-right">Printed Tickets</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E2D3D] text-slate-300">
                  {teamMemberStats.map((member) => (
                    <tr key={member.userId} className="hover:bg-[#16273A] transition-colors">
                      <td className="p-3.5 font-bold text-white">
                        {member.name}
                        <span className="block text-[10px] text-slate-500 font-normal">{member.email}</span>
                      </td>
                      <td className="p-3.5 capitalize text-slate-400">
                        {member.role === 'system_admin' ? 'System Admin' : member.role === 'super_admin' ? 'Super Admin' : 'Sub-Admin'}
                      </td>
                      <td className="p-3.5 font-mono font-black text-[#E8913A] text-sm">
                        {member.seatsSold}
                      </td>
                      <td className="p-3.5 font-mono text-white">
                        {formatINR(member.standardValue)}
                      </td>
                      <td className="p-3.5 font-mono font-bold text-emerald-400">
                        {formatINR(member.collected)}
                      </td>
                      <td className="p-3.5 font-mono font-bold text-amber-400">
                        {formatINR(member.pending)}
                      </td>
                      <td className="p-3.5 font-mono text-purple-400">
                        {formatINR(member.discounts)}
                      </td>
                      <td className="p-3.5">
                        <Badge className="bg-emerald-950 text-emerald-300 border-emerald-800 text-[10px] gap-1 font-mono">
                          <Share2 className="w-3 h-3" />
                          {member.whatsapp}
                        </Badge>
                      </td>
                      <td className="p-3.5 text-right">
                        <Badge className="bg-sky-950 text-sky-300 border-sky-800 text-[10px] gap-1 font-mono">
                          <Printer className="w-3 h-3" />
                          {member.printed}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* TAB 3: BY SPONSOR */}
        <TabsContent value="sponsors">
          <Card className="bg-[#131F2E] border-[#223345] rounded-2xl shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#0E1724] border-b border-[#223345] text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="p-3.5">Sponsor Name</th>
                    <th className="p-3.5">Tier</th>
                    <th className="p-3.5">Complimentary Quota</th>
                    <th className="p-3.5">Passes Tagged</th>
                    <th className="p-3.5 text-right">Gate Checked In</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E2D3D] text-slate-300">
                  {sponsorStats.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-500">
                        No corporate sponsors registered yet.
                      </td>
                    </tr>
                  ) : (
                    sponsorStats.map((sp) => (
                      <tr key={sp.id} className="hover:bg-[#16273A] transition-colors">
                        <td className="p-3.5 font-bold text-white">{sp.name}</td>
                        <td className="p-3.5 capitalize text-slate-400">{sp.tier.replace('_', ' ')}</td>
                        <td className="p-3.5 font-mono text-white">{sp.quota}</td>
                        <td className="p-3.5 font-mono font-bold text-amber-400">{sp.tagged}</td>
                        <td className="p-3.5 text-right font-mono font-bold text-emerald-400">{sp.checkedIn}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* TAB 4: RESERVED POOLS */}
        <TabsContent value="reserved">
          <Card className="bg-[#131F2E] border-[#223345] rounded-2xl shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#0E1724] border-b border-[#223345] text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="p-3.5">Pool Category</th>
                    <th className="p-3.5">Pool Name</th>
                    <th className="p-3.5">Quota Count</th>
                    <th className="p-3.5 text-right">Named Guests Recorded</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E2D3D] text-slate-300">
                  {pools.map((pool) => (
                    <tr key={pool.id} className="hover:bg-[#16273A] transition-colors">
                      <td className="p-3.5">
                        <Badge className="bg-purple-950 text-purple-300 border-purple-800 text-xs font-bold">
                          {pool.category}
                        </Badge>
                      </td>
                      <td className="p-3.5 font-bold text-white">{pool.name}</td>
                      <td className="p-3.5 font-mono font-bold text-white">{pool.total_count}</td>
                      <td className="p-3.5 text-right font-mono text-purple-300">
                        {pool.entries?.length || 0} / {pool.total_count}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
