'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Sale, Band, Profile } from '@/lib/types';
import { formatINR, BANDS_CONFIG } from '@/lib/constants';
import { updateSaleDetails, recordIssuance, cancelSale, reassignSale } from './actions';
import { formatWhatsAppMessage, getWhatsAppShareUrl } from '@/lib/whatsapp';
import { toast } from 'sonner';
import { 
  Search, 
  Filter, 
  Share2, 
  Printer, 
  Edit3, 
  XCircle, 
  UserCheck, 
  ShieldAlert, 
  CheckCircle2, 
  Clock, 
  UserCog, 
  Download, 
  Phone,
  Sparkles,
  RotateCcw
} from 'lucide-react';

interface GuestsClientProps {
  initialSales: Sale[];
  bands: Band[];
  teamMembers: Profile[];
  currentUser: Profile;
}

export function GuestsClient({ initialSales, bands, teamMembers, currentUser }: GuestsClientProps) {
  const [sales, setSales] = useState<Sale[]>(initialSales);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBandFilter, setSelectedBandFilter] = useState<string>('all');
  const [selectedPaymentFilter, setSelectedPaymentFilter] = useState<string>('all');
  const [selectedIssuanceFilter, setSelectedIssuanceFilter] = useState<string>('all');
  const [selectedSellerFilter, setSelectedSellerFilter] = useState<string>('all');

  // Inline Edit Dialog state
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPaymentStatus, setEditPaymentStatus] = useState<'paid' | 'pending'>('paid');
  const [editComment, setEditComment] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Protected Cancel Dialog state (System Admin only)
  const [cancellingSale, setCancellingSale] = useState<Sale | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);

  // Protected Reassign Dialog state (System Admin only)
  const [reassigningSale, setReassigningSale] = useState<Sale | null>(null);
  const [reassignName, setReassignName] = useState('');
  const [reassignPhone, setReassignPhone] = useState('');
  const [reassignNotes, setReassignNotes] = useState('');
  const [isReassigning, setIsReassigning] = useState(false);

  const isSystemAdmin = currentUser?.role === 'system_admin';

  // Filtered sales
  const filteredSales = useMemo(() => {
    return sales.filter((s) => {
      if (s.cancelled) return false;

      // Band filter
      if (selectedBandFilter !== 'all' && s.band_id !== selectedBandFilter) return false;

      // Payment filter
      if (selectedPaymentFilter !== 'all' && s.payment_status !== selectedPaymentFilter) return false;

      // Issuance filter
      if (selectedIssuanceFilter === 'whatsapp' && s.issuance_type !== 'whatsapp') return false;
      if (selectedIssuanceFilter === 'printed' && s.issuance_type !== 'printed') return false;
      if (selectedIssuanceFilter === 'unissued' && s.issuance_type != null) return false;

      // Seller filter
      if (selectedSellerFilter !== 'all' && s.sold_by !== selectedSellerFilter) return false;

      // Search query (name, phone, pass code)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = (s.donor_name || '').toLowerCase().includes(q);
        const matchPhone = (s.donor_phone || '').includes(q);
        const matchCode = (s.pass_code || '').toLowerCase().includes(q);
        const matchComment = (s.comment || '').toLowerCase().includes(q);
        if (!matchName && !matchPhone && !matchCode && !matchComment) return false;
      }

      return true;
    });
  }, [sales, selectedBandFilter, selectedPaymentFilter, selectedIssuanceFilter, selectedSellerFilter, searchQuery]);

  // Open edit modal
  const handleOpenEdit = (sale: Sale) => {
    setEditingSale(sale);
    setEditName(sale.donor_name || '');
    setEditPhone(sale.donor_phone || '');
    setEditEmail(sale.donor_email || '');
    setEditPaymentStatus(sale.payment_status || 'paid');
    setEditComment(sale.comment || '');
  };

  // Save edit
  const handleSaveEdit = async () => {
    if (!editingSale) return;
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
      const res = await updateSaleDetails(editingSale.id, {
        donor_name: editName,
        donor_phone: cleanPhone,
        donor_email: editEmail,
        payment_status: editPaymentStatus,
        comment: editComment,
      });

      if (!res.success) {
        toast.error(res.error || 'Failed to update details');
        return;
      }

      setSales(prev => prev.map(s => {
        if (s.id === editingSale.id) {
          return {
            ...s,
            donor_name: editName.trim(),
            donor_phone: cleanPhone,
            donor_email: editEmail.trim() || null,
            payment_status: editPaymentStatus,
            comment: editComment.trim() || null,
          };
        }
        return s;
      }));

      toast.success('Sale details updated successfully');
      setEditingSale(null);
    } catch (err: any) {
      toast.error('Error saving sale details');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Send WhatsApp
  const handleSendWhatsApp = async (sale: Sale) => {
    if (sale.issuance_type === 'printed') {
      toast.error('GOLDEN RULE: Pass was already issued as a printed ticket. Cannot switch to WhatsApp.');
      return;
    }

    try {
      if (!sale.issuance_type) {
        await recordIssuance(sale.id, 'whatsapp');
        setSales(prev => prev.map(s => s.id === sale.id ? { ...s, issuance_type: 'whatsapp', issued_at: new Date().toISOString() } : s));
      }

      const bandName = sale.band?.name || 'Seating Band';
      const message = formatWhatsAppMessage({
        donorName: sale.donor_name,
        donorPhone: sale.donor_phone,
        passCode: sale.pass_code,
        bandName,
        paymentStatus: sale.payment_status,
      });

      const url = getWhatsAppShareUrl(sale.donor_phone, message);
      window.open(url, '_blank');
      toast.success(`WhatsApp pass link opened for ${sale.donor_name}`);
    } catch (err: any) {
      toast.error('Error sending WhatsApp pass');
    }
  };

  // Print PDF
  const handlePrintPDF = async (sale: Sale) => {
    if (sale.issuance_type === 'whatsapp') {
      toast.error('GOLDEN RULE: Pass was already issued via WhatsApp. Cannot switch to Printed Ticket.');
      return;
    }

    try {
      if (!sale.issuance_type) {
        await recordIssuance(sale.id, 'printed');
        setSales(prev => prev.map(s => s.id === sale.id ? { ...s, issuance_type: 'printed', issued_at: new Date().toISOString() } : s));
      }

      const res = await fetch('/api/tickets/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passCode: sale.pass_code }),
      });

      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Hrudhayam-Pass-${sale.pass_code}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success(`Printable ticket downloaded for ${sale.pass_code}`);
    } catch (err: any) {
      toast.error('Error downloading printable pass');
    }
  };

  // Cancel Sale (System Admin only)
  const handleConfirmCancel = async () => {
    if (!cancellingSale) return;
    setIsCancelling(true);
    try {
      const res = await cancelSale(cancellingSale.id, cancelReason);
      if (!res.success) {
        toast.error(res.error || 'Failed to cancel sale');
        return;
      }

      setSales(prev => prev.filter(s => s.id !== cancellingSale.id));
      toast.success(`Pass ${cancellingSale.pass_code} cancelled and released back to band`);
      setCancellingSale(null);
      setCancelReason('');
    } catch (err: any) {
      toast.error('Error cancelling sale');
    } finally {
      setIsCancelling(false);
    }
  };

  // Reassign Sale (System Admin only)
  const handleConfirmReassign = async () => {
    if (!reassigningSale) return;
    if (!reassignName.trim() || !reassignPhone.trim()) {
      toast.error('New donor name and phone number required');
      return;
    }

    setIsReassigning(true);
    try {
      const res = await reassignSale(reassigningSale.id, reassignName, reassignPhone, reassignNotes);
      if (!res.success) {
        toast.error(res.error || 'Failed to reassign sale');
        return;
      }

      setSales(prev => prev.map(s => {
        if (s.id === reassigningSale.id) {
          return {
            ...s,
            donor_name: reassignName.trim(),
            donor_phone: reassignPhone.replace(/\D/g, '').slice(-10),
            reassigned_to: `${reassignName.trim()} (${reassignPhone})`,
          };
        }
        return s;
      }));

      toast.success(`Pass ${reassigningSale.pass_code} reassigned to ${reassignName}`);
      setReassigningSale(null);
    } catch (err: any) {
      toast.error('Error reassigning sale');
    } finally {
      setIsReassigning(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* 1. Filter and Search Bar */}
      <Card className="bg-[#131F2E] border-[#223345] rounded-2xl shadow-xl p-4 sm:p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search Box */}
          <div className="relative sm:col-span-2 lg:col-span-1">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search name, phone, pass code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-[#1A2839] border-[#2A3F55] text-white text-xs h-10"
            />
          </div>

          {/* Band Filter */}
          <div>
            <Select value={selectedBandFilter} onValueChange={(val) => val && setSelectedBandFilter(val)}>
              <SelectTrigger className="bg-[#1A2839] border-[#2A3F55] text-white text-xs h-10">
                <SelectValue placeholder="All Bands" />
              </SelectTrigger>
              <SelectContent className="bg-[#131F2E] border-[#223345] text-white">
                <SelectItem value="all">All Bands</SelectItem>
                {bands.map(b => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Payment Status Filter */}
          <div>
            <Select value={selectedPaymentFilter} onValueChange={(val) => val && setSelectedPaymentFilter(val)}>
              <SelectTrigger className="bg-[#1A2839] border-[#2A3F55] text-white text-xs h-10">
                <SelectValue placeholder="Payment Status" />
              </SelectTrigger>
              <SelectContent className="bg-[#131F2E] border-[#223345] text-white">
                <SelectItem value="all">All Payments</SelectItem>
                <SelectItem value="paid">✓ Paid / Received</SelectItem>
                <SelectItem value="pending">⏳ Pending Payment</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Issuance Filter */}
          <div>
            <Select value={selectedIssuanceFilter} onValueChange={(val) => val && setSelectedIssuanceFilter(val)}>
              <SelectTrigger className="bg-[#1A2839] border-[#2A3F55] text-white text-xs h-10">
                <SelectValue placeholder="Pass Issuance" />
              </SelectTrigger>
              <SelectContent className="bg-[#131F2E] border-[#223345] text-white">
                <SelectItem value="all">All Issuance Types</SelectItem>
                <SelectItem value="whatsapp">📱 WhatsApp Pass</SelectItem>
                <SelectItem value="printed">🖨️ Printed Ticket</SelectItem>
                <SelectItem value="unissued">⚪ Unissued Passes</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Team Member Filter */}
          <div>
            <Select value={selectedSellerFilter} onValueChange={(val) => val && setSelectedSellerFilter(val)}>
              <SelectTrigger className="bg-[#1A2839] border-[#2A3F55] text-white text-xs h-10">
                <SelectValue placeholder="Sold By Member" />
              </SelectTrigger>
              <SelectContent className="bg-[#131F2E] border-[#223345] text-white">
                <SelectItem value="all">All Team Members</SelectItem>
                {teamMembers.map(m => (
                  <SelectItem key={m.id} value={m.id}>{m.full_name || m.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-[#223345]">
          <span>Showing <strong className="text-white">{filteredSales.length}</strong> sales</span>
          <span className="text-[11px] text-amber-400">
            * All sales are visible to the entire team. Any member can fix small details.
          </span>
        </div>
      </Card>

      {/* 2. Unified Sales Table */}
      <Card className="bg-[#131F2E] border-[#223345] rounded-2xl shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#0E1724] border-b border-[#223345] text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                <th className="p-3.5">Pass Code</th>
                <th className="p-3.5">Donor Name</th>
                <th className="p-3.5">Mobile (WhatsApp)</th>
                <th className="p-3.5">Price Band</th>
                <th className="p-3.5">Amount</th>
                <th className="p-3.5">Payment</th>
                <th className="p-3.5">Issuance</th>
                <th className="p-3.5">Sold By</th>
                <th className="p-3.5">Check-in</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E2D3D] text-slate-300">
              {filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-slate-500">
                    No sales matching the active filters.
                  </td>
                </tr>
              ) : (
                filteredSales.map((sale) => {
                  const bandConfig = BANDS_CONFIG.find(c => c.id === sale.band_id);
                  const isPaid = sale.payment_status === 'paid';
                  const isWhatsAppIssued = sale.issuance_type === 'whatsapp';
                  const isPrintedIssued = sale.issuance_type === 'printed';

                  return (
                    <tr key={sale.id} className="hover:bg-[#16273A] transition-colors">
                      <td className="p-3.5 font-mono font-bold text-amber-400">
                        {sale.pass_code}
                      </td>

                      <td className="p-3.5 font-bold text-white">
                        {sale.donor_name}
                        {sale.comment && (
                          <span className="block text-[10px] text-slate-500 font-normal italic">
                            {sale.comment}
                          </span>
                        )}
                        {sale.legacy_seat_id && (
                          <span className="block text-[9px] text-slate-500 font-mono">
                            Legacy seat: {sale.legacy_seat_id}
                          </span>
                        )}
                      </td>

                      <td className="p-3.5 font-mono text-slate-400">
                        {sale.donor_phone}
                      </td>

                      <td className="p-3.5">
                        <Badge className={`${bandConfig?.bgColor || 'bg-amber-500/10'} ${bandConfig?.textColor || 'text-amber-400'} border ${bandConfig?.borderColor || 'border-amber-500/30'} text-[10px] font-bold`}>
                          {sale.band?.name || bandConfig?.name || 'Band'}
                        </Badge>
                      </td>

                      <td className="p-3.5 font-mono font-bold text-white">
                        {formatINR(sale.collected_amount || sale.standard_price)}
                        {sale.discount_amount > 0 && (
                          <span className="block text-[9px] text-purple-400">
                            (-{formatINR(sale.discount_amount)})
                          </span>
                        )}
                      </td>

                      <td className="p-3.5">
                        <Badge className={`text-[10px] font-semibold ${
                          isPaid 
                            ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800' 
                            : 'bg-amber-950/80 text-amber-300 border-amber-800'
                        }`}>
                          {isPaid ? '✓ Paid' : '⏳ Pending'}
                        </Badge>
                      </td>

                      <td className="p-3.5">
                        {isWhatsAppIssued ? (
                          <Badge className="bg-emerald-950 text-emerald-300 border-emerald-800 text-[10px] gap-1">
                            <Share2 className="w-3 h-3" />
                            WhatsApp
                          </Badge>
                        ) : isPrintedIssued ? (
                          <Badge className="bg-sky-950 text-sky-300 border-sky-800 text-[10px] gap-1">
                            <Printer className="w-3 h-3" />
                            Printed
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-slate-500 border-slate-700 text-[10px]">
                            Unissued
                          </Badge>
                        )}
                      </td>

                      <td className="p-3.5 text-slate-400 text-[11px]">
                        {sale.seller?.full_name || 'Team Member'}
                      </td>

                      <td className="p-3.5">
                        {sale.checked_in ? (
                          <span className="text-emerald-400 font-bold text-[11px] flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Admitted
                          </span>
                        ) : (
                          <span className="text-slate-500 text-[11px]">Not yet</span>
                        )}
                      </td>

                      <td className="p-3.5 text-right space-x-1.5 whitespace-nowrap">
                        {/* WhatsApp Send Button */}
                        <Button
                          size="icon"
                          variant="ghost"
                          title={isPrintedIssued ? 'Already issued as Printed ticket' : 'Send via WhatsApp'}
                          disabled={isPrintedIssued}
                          onClick={() => handleSendWhatsApp(sale)}
                          className={`h-7 w-7 rounded-lg ${isPrintedIssued ? 'opacity-30 cursor-not-allowed' : 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/50'}`}
                        >
                          <Share2 className="w-3.5 h-3.5" />
                        </Button>

                        {/* Print PDF Button */}
                        <Button
                          size="icon"
                          variant="ghost"
                          title={isWhatsAppIssued ? 'Already issued as WhatsApp pass' : 'Download Printable PDF'}
                          disabled={isWhatsAppIssued}
                          onClick={() => handlePrintPDF(sale)}
                          className={`h-7 w-7 rounded-lg ${isWhatsAppIssued ? 'opacity-30 cursor-not-allowed' : 'text-sky-400 hover:text-sky-300 hover:bg-sky-950/50'}`}
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </Button>

                        {/* Inline Edit Button (Open to all) */}
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Edit Donor Details"
                          onClick={() => handleOpenEdit(sale)}
                          className="h-7 w-7 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </Button>

                        {/* Cancel / Reassign (Protected: System Admin only) */}
                        {isSystemAdmin ? (
                          <>
                            <Button
                              size="icon"
                              variant="ghost"
                              title="Reassign Seat (System Admin)"
                              onClick={() => {
                                setReassigningSale(sale);
                                setReassignName(sale.donor_name);
                                setReassignPhone(sale.donor_phone);
                              }}
                              className="h-7 w-7 rounded-lg text-purple-400 hover:text-purple-300 hover:bg-purple-950/50"
                            >
                              <UserCog className="w-3.5 h-3.5" />
                            </Button>

                            <Button
                              size="icon"
                              variant="ghost"
                              title="Cancel Seat (System Admin)"
                              onClick={() => setCancellingSale(sale)}
                              className="h-7 w-7 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-950/50"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                            </Button>
                          </>
                        ) : null}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* 3. INLINE EDIT DETAILS DIALOG (Open to all) */}
      <Dialog open={!!editingSale} onOpenChange={(open) => !open && setEditingSale(null)}>
        <DialogContent className="bg-[#131F2E] border-[#223345] text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-white">Edit Sale Details</DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Update donor contact information and payment status for pass {editingSale?.pass_code}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2">
            <div className="space-y-1">
              <Label className="text-xs text-slate-300">Donor Name *</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="bg-[#1A2839] border-[#2A3F55] text-white text-xs h-9"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-slate-300">Mobile Number *</Label>
              <Input
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                className="bg-[#1A2839] border-[#2A3F55] text-white text-xs h-9 font-mono"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-slate-300">Payment Status *</Label>
              <Select 
                value={editPaymentStatus} 
                onValueChange={(v) => v && setEditPaymentStatus(v as 'paid' | 'pending')}
              >
                <SelectTrigger className="bg-[#1A2839] border-[#2A3F55] text-white text-xs h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#131F2E] border-[#223345] text-white">
                  <SelectItem value="paid">✓ Received / Paid</SelectItem>
                  <SelectItem value="pending">⏳ Pending Collection</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-slate-300">Comment / Note</Label>
              <Input
                value={editComment}
                onChange={(e) => setEditComment(e.target.value)}
                className="bg-[#1A2839] border-[#2A3F55] text-white text-xs h-9"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditingSale(null)}
              className="bg-[#1A2839] border-[#2A3F55] text-slate-300 text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={isSavingEdit}
              onClick={handleSaveEdit}
              className="bg-[#E8913A] hover:bg-[#D97706] text-slate-950 font-bold text-xs"
            >
              {isSavingEdit ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 4. PROTECTED CANCEL DIALOG (System Admin only) */}
      <Dialog open={!!cancellingSale} onOpenChange={(open) => !open && setCancellingSale(null)}>
        <DialogContent className="bg-[#131F2E] border-2 border-red-500/40 text-white max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 text-red-400 font-bold">
              <ShieldAlert className="w-5 h-5" />
              <span>Cancel Seat Sale (System Admin Action)</span>
            </div>
            <DialogDescription className="text-xs text-slate-400 pt-1">
              This will mark pass <strong>{cancellingSale?.pass_code}</strong> as cancelled and release 1 seat back to the {cancellingSale?.band?.name} inventory.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="p-3 bg-red-950/30 rounded-xl border border-red-800/40 text-xs text-red-200">
              <strong className="block text-red-300">Protected Integrity Action:</strong>
              This cancellation will be permanently logged in the audit trail with your name.
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-slate-300">Cancellation Reason *</Label>
              <Input
                placeholder="e.g. Donor requested refund, duplicate booking"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="bg-[#1A2839] border-[#2A3F55] text-white text-xs h-9"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCancellingSale(null)}
              className="bg-[#1A2839] border-[#2A3F55] text-slate-300 text-xs"
            >
              Back
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={isCancelling}
              onClick={handleConfirmCancel}
              className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs"
            >
              {isCancelling ? 'Cancelling...' : 'Confirm Cancellation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 5. PROTECTED REASSIGN DIALOG (System Admin only) */}
      <Dialog open={!!reassigningSale} onOpenChange={(open) => !open && setReassigningSale(null)}>
        <DialogContent className="bg-[#131F2E] border-2 border-purple-500/40 text-white max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 text-purple-400 font-bold">
              <UserCog className="w-5 h-5" />
              <span>Reassign Pass (System Admin Action)</span>
            </div>
            <DialogDescription className="text-xs text-slate-400 pt-1">
              Reassign pass <strong>{reassigningSale?.pass_code}</strong> to a new donor.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs text-slate-300">New Donor Name *</Label>
              <Input
                value={reassignName}
                onChange={(e) => setReassignName(e.target.value)}
                className="bg-[#1A2839] border-[#2A3F55] text-white text-xs h-9"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-slate-300">New Mobile Number *</Label>
              <Input
                value={reassignPhone}
                onChange={(e) => setReassignPhone(e.target.value)}
                className="bg-[#1A2839] border-[#2A3F55] text-white text-xs h-9 font-mono"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-slate-300">Reassignment Reason / Note</Label>
              <Input
                placeholder="e.g. Transferred upon request of original donor"
                value={reassignNotes}
                onChange={(e) => setReassignNotes(e.target.value)}
                className="bg-[#1A2839] border-[#2A3F55] text-white text-xs h-9"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setReassigningSale(null)}
              className="bg-[#1A2839] border-[#2A3F55] text-slate-300 text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={isReassigning}
              onClick={handleConfirmReassign}
              className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs"
            >
              {isReassigning ? 'Reassigning...' : 'Confirm Reassignment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
