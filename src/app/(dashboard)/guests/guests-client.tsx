'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Band, Group, Pass } from '@/lib/types';
import { AuthUser } from '@/lib/auth/session';
import { formatINR } from '@/lib/constants';
import { updatePassDonorDetails } from './actions';
import { formatDonorPassMessage, getWhatsAppUrl } from '@/lib/whatsapp';
import { toast } from 'sonner';
import { 
  Search, 
  Share2, 
  Edit3, 
  CheckCircle2, 
  Clock, 
  Download, 
  Phone,
  ExternalLink,
  QrCode,
  Tag,
  XCircle,
  RotateCcw,
  Users
} from 'lucide-react';

interface GuestsClientProps {
  initialPasses: any[];
  bands: Band[];
  groups: Group[];
  currentUser: AuthUser;
}

export function GuestsClient({ initialPasses, bands, groups, currentUser }: GuestsClientProps) {
  const [passes, setPasses] = useState<any[]>(initialPasses);
  const [searchQuery, setSearchQuery] = useState('');
  const [bandFilter, setBandFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [groupFilter, setGroupFilter] = useState('all');

  // Edit Modal State
  const [editingPass, setEditingPass] = useState<any | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Filtered Passes
  const filteredPasses = useMemo(() => {
    return passes.filter((p) => {
      // Band filter
      if (bandFilter !== 'all' && p.band_id !== bandFilter) return false;

      // Ticket Type filter
      if (typeFilter !== 'all' && p.ticket_type !== typeFilter) return false;

      // Payment Status filter
      if (paymentFilter !== 'all') {
        const paymentStatus = p.payment?.status || 'received';
        if (paymentStatus !== paymentFilter) return false;
      }

      // Gate Status filter
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;

      // Group filter
      if (groupFilter !== 'all') {
        const sellerGroupId = p.seller?.group_id?.toString();
        if (sellerGroupId !== groupFilter) return false;
      }

      // Search query (donor name, phone, pass code, physical serial)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = (p.donor_name || '').toLowerCase().includes(q);
        const matchPhone = (p.donor_phone || '').includes(q);
        const matchCode = (p.pass_code || '').toLowerCase().includes(q);
        const matchSerial = (p.physical_serial || '').toLowerCase().includes(q);
        const matchSeller = (p.seller?.full_name || '').toLowerCase().includes(q);
        if (!matchName && !matchPhone && !matchCode && !matchSerial && !matchSeller) return false;
      }

      return true;
    });
  }, [passes, bandFilter, typeFilter, paymentFilter, statusFilter, groupFilter, searchQuery]);

  // Overall statistics
  const stats = useMemo(() => {
    const total = passes.length;
    const digital = passes.filter(p => p.ticket_type === 'digital').length;
    const physical = passes.filter(p => p.ticket_type === 'physical').length;
    const checkedIn = passes.filter(p => p.status === 'used').length;
    const received = passes.filter(p => (p.payment?.status || 'received') === 'received').length;
    const pending = passes.filter(p => p.payment?.status === 'pending').length;

    return { total, digital, physical, checkedIn, received, pending };
  }, [passes]);

  // Handle WhatsApp Resend
  const handleResendWhatsApp = (pass: any) => {
    const bandLabel = pass.band?.label || pass.band?.name || 'Seating Band';
    const paymentStatus = pass.payment?.status || 'received';
    const message = formatDonorPassMessage({
      donorName: pass.donor_name,
      donorPhone: pass.donor_phone,
      bandLabel,
      passCode: pass.pass_code,
      ticketType: pass.ticket_type,
      physicalSerial: pass.physical_serial,
      paymentStatus,
      language: 'en',
    });

    const url = getWhatsAppUrl(pass.donor_phone, message);
    window.open(url, '_blank');
    toast.success(`WhatsApp opened for ${pass.donor_name}`);
  };

  // Open Edit Modal
  const handleOpenEdit = (pass: any) => {
    setEditingPass(pass);
    setEditName(pass.donor_name || '');
    setEditPhone(pass.donor_phone || '');
    setEditEmail(pass.donor_email || '');
  };

  // Save Edit
  const handleSaveEdit = async () => {
    if (!editingPass) return;
    if (!editName.trim()) {
      toast.error('Donor name is required');
      return;
    }
    const cleanPhone = editPhone.replace(/\D/g, '').slice(-10);
    if (cleanPhone.length !== 10) {
      toast.error('Valid 10-digit phone number is required');
      return;
    }

    setIsSavingEdit(true);
    try {
      const res = await updatePassDonorDetails(editingPass.id, {
        donor_name: editName.trim(),
        donor_phone: cleanPhone,
        donor_email: editEmail.trim() || null,
      });

      if (!res.success) {
        toast.error(res.error || 'Failed to update details');
        return;
      }

      setPasses(prev => prev.map(p => {
        if (p.id === editingPass.id) {
          return {
            ...p,
            donor_name: editName.trim(),
            donor_phone: cleanPhone,
            donor_email: editEmail.trim() || null,
          };
        }
        return p;
      }));

      toast.success('Donor details updated successfully');
      setEditingPass(null);
    } catch (err: any) {
      toast.error('Error saving details');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setBandFilter('all');
    setTypeFilter('all');
    setPaymentFilter('all');
    setStatusFilter('all');
    setGroupFilter('all');
  };

  return (
    <div className="space-y-6">
      {/* 1. Statistics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="bg-[#0B1724] border-[#1D3249]">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-slate-400 font-medium">Total Passes</p>
            <p className="text-2xl font-black text-white mt-1">{stats.total}</p>
          </CardContent>
        </Card>

        <Card className="bg-[#0B1724] border-[#1D3249]">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-blue-400 font-medium">Digital Passes</p>
            <p className="text-2xl font-black text-blue-300 mt-1">{stats.digital}</p>
          </CardContent>
        </Card>

        <Card className="bg-[#0B1724] border-[#1D3249]">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-amber-400 font-medium">Physical Serials</p>
            <p className="text-2xl font-black text-amber-300 mt-1">{stats.physical}</p>
          </CardContent>
        </Card>

        <Card className="bg-[#0B1724] border-[#1D3249]">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-emerald-400 font-medium">Gate Checked-In</p>
            <p className="text-2xl font-black text-emerald-400 mt-1">{stats.checkedIn}</p>
          </CardContent>
        </Card>

        <Card className="bg-[#0B1724] border-[#1D3249]">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-green-400 font-medium">Payment Received</p>
            <p className="text-2xl font-black text-green-400 mt-1">{stats.received}</p>
          </CardContent>
        </Card>

        <Card className="bg-[#0B1724] border-[#1D3249]">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-yellow-400 font-medium">Payment Pending</p>
            <p className="text-2xl font-black text-yellow-400 mt-1">{stats.pending}</p>
          </CardContent>
        </Card>
      </div>

      {/* 2. Search & Filter Bar */}
      <Card className="bg-[#0B1724] border-[#1D3249]">
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            {/* Search Box */}
            <div className="lg:col-span-2 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
              <Input
                placeholder="Search donor, phone, pass code, serial..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-[#07111C] border-[#1D3249] text-white text-xs h-10"
              />
            </div>

            {/* Band Filter */}
            <Select value={bandFilter} onValueChange={(v) => v && setBandFilter(v)}>
              <SelectTrigger className="bg-[#07111C] border-[#1D3249] text-white text-xs h-10">
                <SelectValue placeholder="All Bands" />
              </SelectTrigger>
              <SelectContent className="bg-[#0B1724] border-[#1D3249] text-white">
                <SelectItem value="all">All Bands</SelectItem>
                {bands.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.label} (₹{(b.price || 0).toLocaleString('en-IN')})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Ticket Type Filter */}
            <Select value={typeFilter} onValueChange={(v) => v && setTypeFilter(v)}>
              <SelectTrigger className="bg-[#07111C] border-[#1D3249] text-white text-xs h-10">
                <SelectValue placeholder="All Pass Types" />
              </SelectTrigger>
              <SelectContent className="bg-[#0B1724] border-[#1D3249] text-white">
                <SelectItem value="all">All Pass Types</SelectItem>
                <SelectItem value="digital">Digital (QR Pass)</SelectItem>
                <SelectItem value="physical">Physical (Serial Number)</SelectItem>
              </SelectContent>
            </Select>

            {/* Payment Filter */}
            <Select value={paymentFilter} onValueChange={(v) => v && setPaymentFilter(v)}>
              <SelectTrigger className="bg-[#07111C] border-[#1D3249] text-white text-xs h-10">
                <SelectValue placeholder="All Payments" />
              </SelectTrigger>
              <SelectContent className="bg-[#0B1724] border-[#1D3249] text-white">
                <SelectItem value="all">All Payments</SelectItem>
                <SelectItem value="received">Payment Received</SelectItem>
                <SelectItem value="pending">Payment Pending</SelectItem>
              </SelectContent>
            </Select>

            {/* Group Filter */}
            <Select value={groupFilter} onValueChange={(v) => v && setGroupFilter(v)}>
              <SelectTrigger className="bg-[#07111C] border-[#1D3249] text-white text-xs h-10">
                <SelectValue placeholder="All Teams" />
              </SelectTrigger>
              <SelectContent className="bg-[#0B1724] border-[#1D3249] text-white">
                <SelectItem value="all">All Teams</SelectItem>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={g.id.toString()}>
                    Team {g.id}: {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-400 shrink-0">Gate Status:</span>
              <div className="flex flex-wrap gap-1">
                {['all', 'issued', 'used', 'cancelled'].map((st) => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                      statusFilter === st
                        ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                        : 'bg-[#07111C] text-slate-400 hover:text-white border border-[#1D3249]'
                    }`}
                  >
                    {st === 'all' ? 'All' : st === 'issued' ? 'Issued' : st === 'used' ? 'Gate Checked-In' : 'Cancelled'}
                  </button>
                ))}
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetFilters}
              className="text-xs text-slate-400 hover:text-white h-7 gap-1 shrink-0 self-end sm:self-auto"
            >
              <RotateCcw className="w-3 h-3" />
              Reset Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 3. Passes Table */}
      <div className="bg-[#0B1724] rounded-2xl border border-[#1D3249] overflow-hidden shadow-xl">
        <div className="p-4 border-b border-[#1D3249] flex items-center justify-between">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <span>Passes</span>
            <Badge variant="outline" className="bg-[#07111C] text-amber-400 border-amber-500/30 text-xs">
              {filteredPasses.length} records
            </Badge>
          </h2>
        </div>

        {filteredPasses.length === 0 ? (
          <div className="py-16 text-center text-slate-500 text-sm">
            No passes found matching your filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#07111C] text-slate-400 border-b border-[#1D3249] font-medium">
                  <th className="p-3 pl-4">Pass Code / Serial</th>
                  <th className="p-3">Donor</th>
                  <th className="p-3">Band</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Payment</th>
                  <th className="p-3">Gate Status</th>
                  <th className="p-3">Seller & Team</th>
                  <th className="p-3 pr-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1D3249]/60 text-slate-200">
                {filteredPasses.map((p) => {
                  const isPhysical = p.ticket_type === 'physical';
                  const isUsed = p.status === 'used';
                  const isCancelled = p.status === 'cancelled';
                  const paymentStatus = p.payment?.status || 'received';
                  const isPaid = paymentStatus === 'received';
                  const bandLabel = p.band?.label || p.band?.name || 'Band';
                  const bandPrice = p.band?.price || p.band?.standard_price || 0;

                  return (
                    <tr key={p.id} className="hover:bg-[#0E2032] transition-colors">
                      {/* Pass Code / Serial */}
                      <td className="p-3 pl-4 font-mono font-bold text-white">
                        <div className="flex flex-col">
                          <span className="text-amber-400">{p.pass_code}</span>
                          {isPhysical && p.physical_serial && (
                            <span className="text-[11px] text-slate-400 font-mono">
                              Serial: {p.physical_serial}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Donor */}
                      <td className="p-3">
                        <div className="flex flex-col">
                          <span className="font-bold text-white flex items-center gap-1.5">
                            {p.donor_name}
                            {p.donor_is_seller_fallback && (
                              <Badge className="bg-slate-800 text-slate-400 border-slate-700 text-[10px] px-1 py-0">
                                Seller Fallback
                              </Badge>
                            )}
                          </span>
                          <a 
                            href={`tel:${p.donor_phone}`}
                            className="text-slate-400 hover:text-amber-400 flex items-center gap-1 text-[11px] mt-0.5"
                          >
                            <Phone className="w-2.5 h-2.5" />
                            {p.donor_phone}
                          </a>
                          {p.donor_email && (
                            <span className="text-slate-500 text-[10px]">{p.donor_email}</span>
                          )}
                        </div>
                      </td>

                      {/* Band */}
                      <td className="p-3">
                        <Badge className="bg-[#07111C] border-[#2A4668] text-white text-[11px] font-bold">
                          {bandLabel} • ₹{bandPrice.toLocaleString('en-IN')}
                        </Badge>
                      </td>

                      {/* Type */}
                      <td className="p-3">
                        {isPhysical ? (
                          <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/30 gap-1 text-[11px]">
                            <Tag className="w-3 h-3" />
                            Physical
                          </Badge>
                        ) : (
                          <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/30 gap-1 text-[11px]">
                            <QrCode className="w-3 h-3" />
                            Digital
                          </Badge>
                        )}
                      </td>

                      {/* Payment */}
                      <td className="p-3">
                        <div className="flex flex-col gap-0.5">
                          <Badge className={`text-[10px] w-fit font-bold ${
                            isPaid
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
                          }`}>
                            {isPaid ? '✓ Paid' : 'Pending'}
                          </Badge>
                          {p.payment?.mode && (
                            <span className="text-[10px] text-slate-500 uppercase font-medium">
                              {p.payment.mode}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Gate Status */}
                      <td className="p-3">
                        {isCancelled ? (
                          <Badge className="bg-red-500/10 text-red-400 border-red-500/30 text-[10px]">
                            Cancelled
                          </Badge>
                        ) : isUsed ? (
                          <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[10px] gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Gate Checked In
                          </Badge>
                        ) : (
                          <Badge className="bg-slate-800 text-slate-300 border-slate-700 text-[10px] gap-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            Issued
                          </Badge>
                        )}
                      </td>

                      {/* Seller & Team */}
                      <td className="p-3">
                        <div className="flex flex-col">
                          <span className="font-medium text-white">{p.seller?.full_name || 'Direct / System'}</span>
                          <span className="text-[11px] text-slate-400">
                            {p.seller?.group?.name ? `Team ${p.seller.group_id}: ${p.seller.group.name}` : '—'}
                          </span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="p-3 pr-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          {/* Resend WhatsApp */}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleResendWhatsApp(p)}
                            className="h-8 px-2.5 bg-emerald-950/40 border-emerald-700/50 hover:bg-emerald-900/60 text-emerald-300 gap-1 text-xs"
                            title="Resend WhatsApp confirmation"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">WhatsApp</span>
                          </Button>

                          {/* View Digital Pass */}
                          <a
                            href={`/pass/${p.pass_code}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="h-8 px-2.5 rounded-md border border-[#1D3249] bg-[#07111C] hover:bg-[#15283C] text-slate-300 flex items-center gap-1 text-xs transition-colors"
                            title="View Public Mobile Pass"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Pass</span>
                          </a>

                          {/* Download PDF (Digital Only) */}
                          {!isPhysical && (
                            <a
                              href={`/api/tickets/generate?passCode=${p.pass_code}`}
                              target="_blank"
                              download={`Hrudhayam-Pass-${p.pass_code}.pdf`}
                              className="h-8 px-2 rounded-md border border-[#1D3249] bg-[#07111C] hover:bg-[#15283C] text-slate-300 flex items-center justify-center text-xs transition-colors"
                              title="Download Printable PDF Ticket"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </a>
                          )}

                          {/* Edit Donor Details */}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleOpenEdit(p)}
                            className="h-8 w-8 p-0 text-slate-400 hover:text-white"
                            title="Edit Donor Details"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
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

      {/* Edit Donor Details Dialog */}
      <Dialog open={!!editingPass} onOpenChange={(open) => !open && setEditingPass(null)}>
        <DialogContent className="bg-[#0B1724] border-[#1D3249] text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Edit Donor Details</DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Update name, phone number, or email for pass{' '}
              <span className="font-mono text-amber-400 font-bold">{editingPass?.pass_code}</span>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-300">Donor Name *</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Full Name"
                className="bg-[#07111C] border-[#1D3249] text-white text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-300">Phone Number (10 digits) *</Label>
              <Input
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                placeholder="10-digit mobile number"
                className="bg-[#07111C] border-[#1D3249] text-white text-sm font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-300">Email Address (optional)</Label>
              <Input
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                placeholder="donor@example.com"
                className="bg-[#07111C] border-[#1D3249] text-white text-sm"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setEditingPass(null)}
              className="bg-transparent border-[#1D3249] text-slate-300"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={isSavingEdit}
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold"
            >
              {isSavingEdit ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
