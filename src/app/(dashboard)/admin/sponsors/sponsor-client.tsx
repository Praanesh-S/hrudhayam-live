'use client';

import { useState } from 'react';
import Link from 'next/link';
import { 
  Building2, 
  Plus, 
  Trash2, 
  Edit3, 
  Printer, 
  CheckCircle2,
  Clock,
  Phone,
  Mail,
  Search,
  Users,
  Ticket,
  MapPin,
  X
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { toast } from 'sonner';
import { SPONSOR_TIERS, SPONSOR_TIER_MAP, type SponsorTierValue } from '@/lib/sponsor-constants';
import { formatINR } from '@/lib/constants';
import type { Sponsor, SponsorTier, SponsorStatus, PaymentMode, SeatData, SeatSection } from '@/lib/types';
import { AuthUser } from '@/lib/auth/session';
import { 
  createSponsor, 
  updateSponsor, 
  deleteSponsor,
  allocateSponsorSeats,
  deallocateSponsorSeat
} from './actions';

interface SponsorClientProps {
  sponsors: any[];
  members: any[];
  seats?: SeatData[];
  currentUser: AuthUser;
}

export function SponsorClient({ sponsors: initialSponsors, members, seats: initialSeats = [], currentUser }: SponsorClientProps) {
  const [sponsors, setSponsors] = useState(initialSponsors);
  const [seatsList, setSeatsList] = useState<SeatData[]>(initialSeats);
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Seat Allocation Modal state
  const [allocatingSponsor, setAllocatingSponsor] = useState<any | null>(null);
  const [allocatingSection, setAllocatingSection] = useState<SeatSection>('Ground Floor');
  const [allocatingRow, setAllocatingRow] = useState<string>('A');
  const [selectedSeatIdsForSponsor, setSelectedSeatIdsForSponsor] = useState<Set<string>>(new Set());
  const [isAllocatingAction, setIsAllocatingAction] = useState<boolean>(false);
  
  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSponsor, setEditingSponsor] = useState<any | null>(null);
  const [name, setName] = useState('');
  const [tier, setTier] = useState<SponsorTierValue>('gold_sponsor');
  const [amount, setAmount] = useState<string>('100000');
  const [status, setStatus] = useState<SponsorStatus>('committed');
  const [broughtByMemberId, setBroughtByMemberId] = useState<string>('none');
  const [passCount, setPassCount] = useState('2');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('bank_transfer');
  const [referenceNo, setReferenceNo] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Open Create Dialog
  const openCreateDialog = () => {
    setEditingSponsor(null);
    setName('');
    setTier('gold_sponsor');
    setAmount('100000');
    setStatus('committed');
    setBroughtByMemberId('none');
    setPassCount('2');
    setContactName('');
    setContactPhone('');
    setContactEmail('');
    setPaymentMode('bank_transfer');
    setReferenceNo('');
    setNotes('');
    setDialogOpen(true);
  };

  // Open Edit Dialog
  const openEditDialog = (sponsor: any) => {
    setEditingSponsor(sponsor);
    setName(sponsor.sponsor_name);
    setTier(sponsor.tier as SponsorTierValue);
    setAmount(String(sponsor.amount || 0));
    setStatus(sponsor.status as SponsorStatus);
    setBroughtByMemberId(sponsor.brought_by_member_id ? String(sponsor.brought_by_member_id) : 'none');
    setPassCount(String(sponsor.complimentary_pass_count || 0));
    setContactName(sponsor.contact_name || '');
    setContactPhone(sponsor.contact_phone || '');
    setContactEmail(sponsor.contact_email || '');
    setPaymentMode(sponsor.payment?.mode || 'bank_transfer');
    setReferenceNo(sponsor.payment?.reference_no || '');
    setNotes(sponsor.notes || '');
    setDialogOpen(true);
  };

  // Handle Tier Change
  const handleTierChange = (val: SponsorTierValue) => {
    setTier(val);
    const tierConfig = SPONSOR_TIER_MAP[val];
    if (tierConfig && tierConfig.amount > 0) {
      setAmount(String(tierConfig.amount));
    }
  };

  // Save Sponsor
  const handleSaveSponsor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Sponsor name is required');
      return;
    }

    const numAmount = parseInt(amount, 10);
    if (isNaN(numAmount) || numAmount < 0) {
      toast.error('Valid sponsor amount is required');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: any = {
        sponsor_name: name.trim(),
        tier,
        amount: numAmount,
        status,
        brought_by_member_id: broughtByMemberId === 'none' ? null : parseInt(broughtByMemberId, 10),
        complimentary_pass_count: parseInt(passCount, 10) || 0,
        contact_name: contactName.trim() || null,
        contact_phone: contactPhone.trim() || null,
        contact_email: contactEmail.trim() || null,
        payment_mode: paymentMode,
        payment_reference_no: referenceNo.trim() || undefined,
        notes: notes.trim() || null,
      };

      if (editingSponsor) {
        const res = await updateSponsor(editingSponsor.id, payload);
        if (res.error) throw new Error(res.error);
        toast.success(`Sponsor "${name}" updated successfully`);
      } else {
        const res = await createSponsor(payload);
        if (res.error) throw new Error(res.error);
        toast.success(`Sponsor "${name}" registered successfully`);
      }

      setDialogOpen(false);
      window.location.reload();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save sponsor');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Sponsor
  const handleDeleteSponsor = async (sponsor: any) => {
    if (!confirm(`Are you sure you want to delete sponsor "${sponsor.sponsor_name}"?`)) {
      return;
    }

    try {
      const res = await deleteSponsor(sponsor.id);
      if (res.error) throw new Error(res.error);
      toast.success(`Sponsor "${sponsor.sponsor_name}" deleted`);
      setSponsors(s => s.filter(x => x.id !== sponsor.id));
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete sponsor');
    }
  };

  // Allocate seats to sponsor
  const handleAllocateSeats = async () => {
    if (!allocatingSponsor || selectedSeatIdsForSponsor.size === 0) return;
    setIsAllocatingAction(true);
    try {
      const res = await allocateSponsorSeats(
        allocatingSponsor.id,
        Array.from(selectedSeatIdsForSponsor)
      );
      if (res.error) throw new Error(res.error);
      toast.success(`${selectedSeatIdsForSponsor.size} seat(s) allocated as complimentary passes!`);
      // Update local seats
      setSeatsList(prev =>
        prev.map(s =>
          selectedSeatIdsForSponsor.has(s.id)
            ? {
                ...s,
                sponsor_id: allocatingSponsor.id,
                guest_name: `${allocatingSponsor.sponsor_name || 'Sponsor'} Complimentary`,
                payment_status: 'received',
              }
            : s
        )
      );
      setSelectedSeatIdsForSponsor(new Set());
    } catch (err: any) {
      toast.error(err.message || 'Failed to allocate seats');
    } finally {
      setIsAllocatingAction(false);
    }
  };

  // Release a seat from sponsor
  const handleReleaseSeat = async (seatId: string) => {
    setIsAllocatingAction(true);
    try {
      const res = await deallocateSponsorSeat(seatId);
      if (res.error) throw new Error(res.error);
      toast.success(`Seat ${seatId} released back to available!`);
      setSeatsList(prev =>
        prev.map(s =>
          s.id === seatId
            ? {
                ...s,
                sponsor_id: null,
                guest_name: null,
                guest_phone: null,
                guest_email: null,
                pass_code: null,
                payment_status: 'pending',
              }
            : s
        )
      );
    } catch (err: any) {
      toast.error(err.message || 'Failed to release seat');
    } finally {
      setIsAllocatingAction(false);
    }
  };

  // Filter sponsors
  const filteredSponsors = sponsors.filter(s => {
    const q = search.toLowerCase();
    const matchesSearch = 
      (s.sponsor_name || '').toLowerCase().includes(q) ||
      (s.contact_name && s.contact_name.toLowerCase().includes(q)) ||
      (s.brought_by_member?.full_name && s.brought_by_member.full_name.toLowerCase().includes(q));
    const matchesTier = tierFilter === 'all' || s.tier === tierFilter;
    const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
    return matchesSearch && matchesTier && matchesStatus;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* 1. Header & Register Button */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#0B1724] p-5 rounded-2xl border border-[#1D3249] shadow-xl">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Building2 className="w-5 h-5 text-amber-400" />
            <span>Corporate Sponsors & Benefactors</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Manage sponsorship commitments, structured payment collections, and member attributions.
          </p>
        </div>

        <Button
          onClick={openCreateDialog}
          className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl shadow-lg gap-1.5 h-10"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Sponsor</span>
        </Button>
      </div>

      {/* 2. Filters */}
      <Card className="bg-[#0B1724] border-[#1D3249]">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
              <Input
                placeholder="Search sponsor, contact, member..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-[#07111C] border-[#1D3249] text-white text-xs h-10"
              />
            </div>

            <Select value={tierFilter} onValueChange={(v) => v && setTierFilter(v)}>
              <SelectTrigger className="bg-[#07111C] border-[#1D3249] text-white text-xs h-10">
                <SelectValue placeholder="All Tiers" />
              </SelectTrigger>
              <SelectContent className="bg-[#0B1724] border-[#1D3249] text-white">
                <SelectItem value="all">All Sponsorship Tiers</SelectItem>
                {SPONSOR_TIERS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label} (₹{t.amount.toLocaleString('en-IN')})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={(v) => v && setStatusFilter(v)}>
              <SelectTrigger className="bg-[#07111C] border-[#1D3249] text-white text-xs h-10">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent className="bg-[#0B1724] border-[#1D3249] text-white">
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="received">Payment Received</SelectItem>
                <SelectItem value="committed">Committed (Pending)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* 3. Sponsors Table */}
      <div className="bg-[#0B1724] rounded-2xl border border-[#1D3249] overflow-hidden shadow-xl">
        <div className="p-4 border-b border-[#1D3249] flex items-center justify-between">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <span>Sponsors Directory</span>
            <Badge variant="outline" className="bg-[#07111C] text-amber-400 border-amber-500/30 text-xs">
              {filteredSponsors.length} recorded
            </Badge>
          </h2>
        </div>

        {filteredSponsors.length === 0 ? (
          <div className="py-16 text-center text-slate-500 text-sm">
            No sponsors found matching your criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#07111C] text-slate-400 border-b border-[#1D3249] font-medium">
                  <th className="p-3 pl-4">Sponsor / Organization</th>
                  <th className="p-3">Tier</th>
                  <th className="p-3 text-right">Amount (₹)</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Brought By Member</th>
                  <th className="p-3">Contact Details</th>
                  <th className="p-3 pr-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1D3249]/60 text-slate-200">
                {filteredSponsors.map((s) => {
                  const isReceived = s.status === 'received';
                  const assignedSeats = seatsList.filter((st) => st.sponsor_id === s.id);
                  const compCount = s.complimentary_pass_count || 0;

                  return (
                    <tr key={s.id} className="hover:bg-[#0E2032] transition-colors">
                      <td className="p-3 pl-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-white text-sm">{s.sponsor_name}</span>
                          {compCount > 0 ? (
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[11px] text-cyan-400 font-bold flex items-center gap-1">
                                <Ticket className="w-3 h-3" />
                                {assignedSeats.length} / {compCount} Comp Seats Allocated
                              </span>
                              {assignedSeats.length === compCount ? (
                                <span className="text-[9px] px-1.5 py-0.2 bg-emerald-950 text-emerald-300 border border-emerald-800 rounded-full font-bold">
                                  ✓ Complete
                                </span>
                              ) : (
                                <span className="text-[9px] px-1.5 py-0.2 bg-amber-950 text-amber-300 border border-amber-800 rounded-full font-mono">
                                  {compCount - assignedSeats.length} unassigned
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-500 italic mt-0.5">0 Comp Passes</span>
                          )}
                          {s.notes && (
                            <span className="text-[10px] text-slate-400 italic mt-0.5">{s.notes}</span>
                          )}
                        </div>
                      </td>

                      <td className="p-3">
                        <Badge className="bg-[#07111C] border-[#2A4668] text-slate-200 capitalize text-[10px]">
                          {s.tier?.replace(/_/g, ' ')}
                        </Badge>
                      </td>

                      <td className="p-3 text-right font-mono font-black text-amber-400 text-sm">
                        {formatINR(s.amount)}
                      </td>

                      <td className="p-3">
                        <Badge className={`text-[10px] font-bold ${
                          isReceived
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
                        }`}>
                          {isReceived ? '✓ Received' : 'Committed'}
                        </Badge>
                      </td>

                      <td className="p-3">
                        {s.brought_by_member ? (
                          <div className="flex flex-col">
                            <span className="font-medium text-white">{s.brought_by_member.full_name}</span>
                            <span className="text-[10px] text-slate-400">
                              {s.brought_by_member.group?.name ? `Team ${s.brought_by_member.group_id}: ${s.brought_by_member.group.name}` : ''}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-500 italic text-[11px]">Direct / General</span>
                        )}
                      </td>

                      <td className="p-3 text-slate-300">
                        {s.contact_name ? (
                          <div className="flex flex-col">
                            <span className="font-medium">{s.contact_name}</span>
                            {s.contact_phone && (
                              <span className="text-[10px] text-slate-400 flex items-center gap-1">
                                <Phone className="w-2.5 h-2.5" />
                                {s.contact_phone}
                              </span>
                            )}
                            {s.contact_email && (
                              <span className="text-[10px] text-slate-400 flex items-center gap-1">
                                <Mail className="w-2.5 h-2.5" />
                                {s.contact_email}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-500 text-[10px]">—</span>
                        )}
                      </td>

                      <td className="p-3 pr-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1">
                          {compCount > 0 && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setAllocatingSponsor(s);
                                setSelectedSeatIdsForSponsor(new Set());
                                setAllocatingSection('Ground Floor');
                                setAllocatingRow('A');
                              }}
                              className="h-8 px-2.5 bg-cyan-950/50 border-cyan-800 hover:bg-cyan-900/70 text-cyan-300 text-xs font-bold flex items-center gap-1 shadow-xs"
                              title="Allocate complimentary seats on blueprint map"
                            >
                              <Ticket className="w-3.5 h-3.5 text-cyan-400" />
                              <span>Allocate ({assignedSeats.length}/{compCount})</span>
                            </Button>
                          )}

                          <Link
                            href={`/admin/sponsors/${s.id}/print`}
                            target="_blank"
                            className="h-8 w-8 rounded-md border border-[#1D3249] bg-[#07111C] hover:bg-[#15283C] text-slate-300 flex items-center justify-center transition-colors"
                            title="Print Voucher"
                          >
                            <Printer className="w-3.5 h-3.5 text-amber-400" />
                          </Link>

                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openEditDialog(s)}
                            className="h-8 w-8 p-0 text-slate-400 hover:text-white"
                            title="Edit Sponsor"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </Button>

                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteSponsor(s)}
                            className="h-8 w-8 p-0 text-red-400 hover:text-red-300 hover:bg-red-950/30"
                            title="Delete Sponsor"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Sponsor Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-[#0B1724] border-[#1D3249] text-white sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">
              {editingSponsor ? 'Edit Sponsor Details' : 'Register Corporate Sponsor'}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Provide corporate details, tier, pledged amount, and attributing member.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveSponsor} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-300">Sponsor / Organization Name *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Apex Health Systems Pvt Ltd"
                className="bg-[#07111C] border-[#1D3249] text-white text-sm"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">Sponsorship Tier *</Label>
                <Select value={tier} onValueChange={(v) => v && handleTierChange(v as SponsorTierValue)}>
                  <SelectTrigger className="bg-[#07111C] border-[#1D3249] text-white text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0B1724] border-[#1D3249] text-white">
                    {SPONSOR_TIERS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">Amount (₹) *</Label>
                <Input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="bg-[#07111C] border-[#1D3249] text-white text-sm font-mono"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">Payment Status *</Label>
                <Select value={status} onValueChange={(v) => v && setStatus(v as SponsorStatus)}>
                  <SelectTrigger className="bg-[#07111C] border-[#1D3249] text-white text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0B1724] border-[#1D3249] text-white">
                    <SelectItem value="committed">Committed (Pending)</SelectItem>
                    <SelectItem value="received">Payment Received</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">Complimentary Passes</Label>
                <Input
                  type="number"
                  value={passCount}
                  onChange={(e) => setPassCount(e.target.value)}
                  className="bg-[#07111C] border-[#1D3249] text-white text-sm font-mono"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-300">Brought By Member (Attribution)</Label>
              <Select value={broughtByMemberId} onValueChange={(v) => v && setBroughtByMemberId(v)}>
                <SelectTrigger className="bg-[#07111C] border-[#1D3249] text-white text-xs">
                  <SelectValue placeholder="Select Member" />
                </SelectTrigger>
                <SelectContent className="bg-[#0B1724] border-[#1D3249] text-white max-h-56">
                  <SelectItem value="none">None / Direct General</SelectItem>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={String(m.id)}>
                      {m.full_name} (Team {m.group_id}: {m.group?.name || ''})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* If status is received, show payment fields */}
            {status === 'received' && (
              <div className="p-3 bg-emerald-950/20 border border-emerald-500/30 rounded-xl space-y-3">
                <p className="text-xs text-emerald-400 font-bold">Structured Payment Receipt Details</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[11px] text-slate-300">Payment Mode</Label>
                    <Select value={paymentMode} onValueChange={(v) => v && setPaymentMode(v as PaymentMode)}>
                      <SelectTrigger className="bg-[#07111C] border-[#1D3249] text-white text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#0B1724] border-[#1D3249] text-white">
                        <SelectItem value="bank_transfer">Bank Transfer (NEFT/RTGS)</SelectItem>
                        <SelectItem value="cheque">Cheque</SelectItem>
                        <SelectItem value="upi">UPI</SelectItem>
                        <SelectItem value="cash">Cash</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] text-slate-300">Transaction Reference / UTR</Label>
                    <Input
                      value={referenceNo}
                      onChange={(e) => setReferenceNo(e.target.value)}
                      placeholder="e.g. UTR12345678"
                      className="bg-[#07111C] border-[#1D3249] text-white text-xs font-mono"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label className="text-[11px] text-slate-300">Contact Person</Label>
                <Input
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="Contact Name"
                  className="bg-[#07111C] border-[#1D3249] text-white text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] text-slate-300">Contact Phone</Label>
                <Input
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="Mobile"
                  className="bg-[#07111C] border-[#1D3249] text-white text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] text-slate-300">Contact Email</Label>
                <Input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="email@domain.com"
                  className="bg-[#07111C] border-[#1D3249] text-white text-xs"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-slate-300">Notes / Entitlements</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. VIP seating in front row, logo on banner"
                className="bg-[#07111C] border-[#1D3249] text-white text-xs"
              />
            </div>

            <DialogFooter className="pt-2 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                className="bg-transparent border-[#1D3249] text-slate-300"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold"
              >
                {isSubmitting ? 'Saving...' : editingSponsor ? 'Update Sponsor' : 'Register Sponsor'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Complimentary Seat Allocator Dialog */}
      {allocatingSponsor && (
        <Dialog open={Boolean(allocatingSponsor)} onOpenChange={(open) => !open && setAllocatingSponsor(null)}>
          <DialogContent className="bg-[#0B1724] border-[#1D3249] text-white sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold flex items-center gap-2 text-cyan-300">
                <Building2 className="w-5 h-5 text-cyan-400" />
                <span>Complimentary Seat Allocator</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                Allocate designated venue seats for <strong className="text-white">{allocatingSponsor.sponsor_name}</strong>. Allocated seats will appear in distinct Vibrant Cyan on the blueprint map and will be marked as issued complimentary passes.
              </DialogDescription>
            </DialogHeader>

            {(() => {
              const currentSponsorSeats = seatsList.filter((st) => st.sponsor_id === allocatingSponsor.id);
              const maxAllowed = allocatingSponsor.complimentary_pass_count || 0;
              const remainingSlots = maxAllowed - currentSponsorSeats.length;

              const availableSeatsInRow = seatsList.filter(
                (st) =>
                  st.section === allocatingSection &&
                  st.row_label === allocatingRow &&
                  st.row_label !== 'SPL VIP' &&
                  !st.is_blocked &&
                  !st.sponsor_id &&
                  !st.guest_name &&
                  !st.pass_code
              );

              return (
                <div className="space-y-5 py-2">
                  {/* Quota Summary Box */}
                  <div className="p-3.5 bg-[#07111C] rounded-xl border border-[#1D3249] flex items-center justify-between">
                    <div>
                      <span className="text-xs text-slate-400 block">Sponsor Pass Quota</span>
                      <span className="text-sm font-bold text-white">
                        {currentSponsorSeats.length} of {maxAllowed} Allocated
                      </span>
                    </div>
                    <Badge className={remainingSlots > 0 ? 'bg-cyan-950 text-cyan-300 border-cyan-800' : 'bg-emerald-950 text-emerald-300 border-emerald-800'}>
                      {remainingSlots > 0 ? `${remainingSlots} Slots Remaining` : 'Quota Fulfilled'}
                    </Badge>
                  </div>

                  {/* Section 1: Currently Allocated Seats */}
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-slate-300">Currently Allocated Seats (Cyan on Map):</Label>
                    {currentSponsorSeats.length === 0 ? (
                      <p className="text-xs text-slate-500 italic p-3 bg-[#07111C] rounded-lg border border-slate-800">
                        No complimentary seats allocated yet. Use the picker below to allocate seats.
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-2 p-3 bg-[#07111C] rounded-lg border border-slate-800">
                        {currentSponsorSeats.map((st) => (
                          <div
                            key={st.id}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-950 border border-cyan-700 text-cyan-200 text-xs font-mono font-bold"
                          >
                            <span>{st.id} ({st.section} • Row {st.row_label})</span>
                            <button
                              type="button"
                              onClick={() => handleReleaseSeat(st.id)}
                              disabled={isAllocatingAction}
                              className="hover:text-rose-400 text-slate-400 transition-colors p-0.5 rounded cursor-pointer"
                              title="Release seat back to available inventory"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Section 2: Allocate New Seats */}
                  {remainingSlots > 0 ? (
                    <div className="space-y-3 pt-2 border-t border-[#1D3249]">
                      <div className="flex justify-between items-center">
                        <Label className="text-xs font-bold text-slate-300">
                          Select Seats to Allocate ({selectedSeatIdsForSponsor.size} / {remainingSlots} selected):
                        </Label>
                      </div>

                      {/* Section & Row Pickers */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <span className="text-[11px] text-slate-400">Venue Section</span>
                          <select
                            value={allocatingSection}
                            onChange={(e) => {
                              setAllocatingSection(e.target.value as SeatSection);
                              setSelectedSeatIdsForSponsor(new Set());
                            }}
                            className="w-full h-9 bg-[#07111C] border border-[#1D3249] text-white text-xs rounded-lg px-2"
                          >
                            <option value="Ground Floor">Ground Floor</option>
                            <option value="Balcony">Balcony</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <span className="text-[11px] text-slate-400">Row</span>
                          <select
                            value={allocatingRow}
                            onChange={(e) => {
                              setAllocatingRow(e.target.value);
                              setSelectedSeatIdsForSponsor(new Set());
                            }}
                            className="w-full h-9 bg-[#07111C] border border-[#1D3249] text-white text-xs rounded-lg px-2 font-mono"
                          >
                            {['A','B','C','D','E','F','G','H','I','J','K','L','M','N'].map((r) => (
                              <option key={r} value={r}>Row {r}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Available Seats in Row Chips */}
                      <div className="space-y-1.5">
                        <div className="text-[11px] text-slate-400 flex items-center justify-between">
                          <span>Available Seats in {allocatingSection} Row {allocatingRow}:</span>
                          <span className="font-mono">{availableSeatsInRow.length} available</span>
                        </div>

                        {availableSeatsInRow.length === 0 ? (
                          <div className="p-4 text-center text-xs text-slate-500 bg-[#07111C] rounded-lg border border-slate-800">
                            No available seats in {allocatingSection} Row {allocatingRow}. (All seats in this row are already sold, blocked, or allocated).
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-1.5 p-3 bg-[#07111C] rounded-lg border border-slate-800 max-h-48 overflow-y-auto">
                            {availableSeatsInRow.map((st) => {
                              const isSelected = selectedSeatIdsForSponsor.has(st.id);
                              return (
                                <button
                                  key={st.id}
                                  type="button"
                                  onClick={() => {
                                    const next = new Set(selectedSeatIdsForSponsor);
                                    if (next.has(st.id)) {
                                      next.delete(st.id);
                                    } else {
                                      if (next.size >= remainingSlots) {
                                        toast.error(`You can only allocate up to ${remainingSlots} remaining seats.`);
                                        return;
                                      }
                                      next.add(st.id);
                                    }
                                    setSelectedSeatIdsForSponsor(next);
                                  }}
                                  className={`px-2 py-1 rounded text-xs font-mono font-bold transition-all ${
                                    isSelected
                                      ? 'bg-cyan-500 text-slate-950 ring-2 ring-white scale-105'
                                      : 'bg-[#15283C] text-slate-300 hover:bg-[#1C3652] hover:text-white border border-[#234263]'
                                  }`}
                                >
                                  #{st.seat_no}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 text-center text-xs text-emerald-400 bg-emerald-950/40 rounded-xl border border-emerald-800">
                      ✓ All {maxAllowed} complimentary tickets for this sponsor have been fully allocated. If you need to re-allocate, release one of the seats above first.
                    </div>
                  )}

                  <DialogFooter className="pt-2 gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setAllocatingSponsor(null)}
                      className="text-slate-400 hover:text-white text-xs"
                    >
                      Close
                    </Button>

                    {remainingSlots > 0 && (
                      <Button
                        type="button"
                        disabled={isAllocatingAction || selectedSeatIdsForSponsor.size === 0}
                        onClick={handleAllocateSeats}
                        className="bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-bold text-xs"
                      >
                        {isAllocatingAction ? 'Allocating...' : `Allocate ${selectedSeatIdsForSponsor.size} Seats (Cyan)`}
                      </Button>
                    )}
                  </DialogFooter>
                </div>
              );
            })()}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
