'use client';

import { useState } from 'react';
import { Band } from '@/lib/types';
import { AuthUser } from '@/lib/auth/session';
import { cancelPassBySystemAdmin, movePassToBandBySystemAdmin, updatePassTicketDetailsBySystemAdmin } from '../actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Search, 
  XCircle, 
  ArrowRightLeft, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  Ticket,
  ShieldAlert,
  Edit3
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface AdminPassesClientProps {
  initialPasses: any[];
  bands: Band[];
  currentUser: AuthUser;
}

export function AdminPassesClient({
  initialPasses,
  bands,
}: AdminPassesClientProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [passes, setPasses] = useState(initialPasses);

  // Modal states
  const [cancellingPass, setCancellingPass] = useState<any | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const [movingPass, setMovingPass] = useState<any | null>(null);
  const [targetBandId, setTargetBandId] = useState<string>(bands[0]?.id || '');
  const [moveReason, setMoveReason] = useState('');

  // Edit Pass Ticket Details state
  const [editingPass, setEditingPass] = useState<any | null>(null);
  const [editPhysicalSerial, setEditPhysicalSerial] = useState('');
  const [editTicketType, setEditTicketType] = useState('physical');
  const [editDonorName, setEditDonorName] = useState('');
  const [editDonorPhone, setEditDonorPhone] = useState('');
  const [editDonorEmail, setEditDonorEmail] = useState('');
  const [editPaymentMode, setEditPaymentMode] = useState<string>('upi');
  const [editReferenceNo, setEditReferenceNo] = useState('');
  const [editPaymentStatus, setEditPaymentStatus] = useState<string>('received');
  const [editError, setEditError] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const openEditModal = (p: any) => {
    const payment = p.payments && p.payments.length > 0 ? p.payments[0] : null;
    setEditingPass(p);
    setEditPhysicalSerial(p.physical_serial || '');
    setEditTicketType(p.ticket_type || 'physical');
    setEditDonorName(p.donor_name || '');
    setEditDonorPhone(p.donor_phone || '');
    setEditDonorEmail(p.donor_email || '');
    setEditPaymentMode(payment?.mode || 'upi');
    setEditReferenceNo(payment?.reference_no || '');
    setEditPaymentStatus(payment?.status || 'received');
    setEditError(null);
    setCancellingPass(null);
    setMovingPass(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPass) return;

    if (!editDonorName.trim()) {
      setEditError('Donor name cannot be empty.');
      return;
    }

    const cleanPhone = editDonorPhone.replace(/\D/g, '').slice(-10);
    if (cleanPhone.length !== 10) {
      setEditError('Donor phone must be a valid 10-digit mobile number.');
      return;
    }

    setIsLoading(true);
    setEditError(null);

    const res = await updatePassTicketDetailsBySystemAdmin({
      passId: editingPass.id,
      physicalSerial: editPhysicalSerial.trim().toUpperCase() || undefined,
      ticketType: editTicketType,
      donorName: editDonorName.trim(),
      donorPhone: cleanPhone,
      donorEmail: editDonorEmail.trim() || undefined,
      paymentMode: editPaymentMode as any,
      paymentReferenceNo: editReferenceNo.trim(),
      paymentStatus: editPaymentStatus as any,
    });

    setIsLoading(false);

    if (res.success) {
      setPasses((prev) =>
        prev.map((p) => {
          if (p.id !== editingPass.id) return p;
          const updatedPayments = p.payments && p.payments.length > 0
            ? [{ ...p.payments[0], mode: editPaymentMode, reference_no: editReferenceNo.trim(), status: editPaymentStatus }]
            : [{ id: 'new', mode: editPaymentMode, reference_no: editReferenceNo.trim(), status: editPaymentStatus }];
          return {
            ...p,
            donor_name: editDonorName.trim(),
            donor_phone: cleanPhone,
            donor_email: editDonorEmail.trim() || null,
            ticket_type: editTicketType,
            physical_serial: editPhysicalSerial.trim().toUpperCase() || null,
            payments: updatedPayments,
          };
        })
      );
      setStatusMessage({
        type: 'success',
        text: `Pass ${editingPass.pass_code} details updated successfully.`,
      });
      setEditingPass(null);
    } else {
      setEditError(res.error || 'Failed to update pass details.');
    }
  };

  const handleCancelPass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancellingPass || !cancelReason.trim()) return;

    setIsLoading(true);
    setStatusMessage(null);

    const res = await cancelPassBySystemAdmin(cancellingPass.id, cancelReason);
    setIsLoading(false);

    if (res.success) {
      setPasses((prev) =>
        prev.map((p) => (p.id === cancellingPass.id ? { ...p, status: 'cancelled' } : p))
      );
      setStatusMessage({ type: 'success', text: `Pass ${cancellingPass.pass_code} has been cancelled and seat returned to inventory.` });
      setCancellingPass(null);
      setCancelReason('');
    } else {
      setStatusMessage({ type: 'error', text: res.error || 'Failed to cancel pass.' });
    }
  };

  const handleMovePass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!movingPass || !targetBandId) return;

    setIsLoading(true);
    setStatusMessage(null);

    const res = await movePassToBandBySystemAdmin(movingPass.id, targetBandId, moveReason);
    setIsLoading(false);

    if (res.success) {
      const newBand = bands.find((b) => b.id === targetBandId);
      setPasses((prev) =>
        prev.map((p) => (p.id === movingPass.id ? { ...p, band_id: targetBandId, band: newBand || p.band } : p))
      );
      setStatusMessage({ type: 'success', text: `Pass ${movingPass.pass_code} successfully moved to target band.` });
      setMovingPass(null);
      setMoveReason('');
    } else {
      setStatusMessage({ type: 'error', text: res.error || 'Failed to move pass.' });
    }
  };

  const filteredPasses = passes.filter((p) => {
    const q = searchQuery.toLowerCase();
    const paymentRef = p.payments?.[0]?.reference_no?.toLowerCase() || '';
    return (
      p.pass_code.toLowerCase().includes(q) ||
      p.donor_name.toLowerCase().includes(q) ||
      (p.donor_phone && p.donor_phone.includes(q)) ||
      (p.physical_serial && p.physical_serial.toLowerCase().includes(q)) ||
      paymentRef.includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {statusMessage && (
        <Alert className={statusMessage.type === 'success' ? 'bg-emerald-950/70 border-emerald-800 text-emerald-100' : 'bg-red-950/70 border-red-800 text-red-100'}>
          {statusMessage.type === 'success' ? <CheckCircle2 className="h-5 w-5 text-emerald-400" /> : <AlertCircle className="h-5 w-5 text-red-400" />}
          <AlertTitle className="text-base font-bold">{statusMessage.type === 'success' ? 'Success' : 'Error'}</AlertTitle>
          <AlertDescription className="text-sm">{statusMessage.text}</AlertDescription>
        </Alert>
      )}

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3.5 top-3.5 h-5 w-5 text-slate-400" />
        <Input
          placeholder="Lookup pass by code (HL-XXXX), serial number, donor name, or phone..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-11 h-12 bg-[#131F2E] border-slate-800 text-white rounded-xl text-base"
        />
      </div>

      {/* Edit Pass Ticket Details Modal / Card */}
      {editingPass && (
        <form onSubmit={handleSaveEdit} className="p-6 bg-[#131F2E] border-2 border-sky-500 rounded-3xl space-y-4 shadow-2xl">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <Edit3 className="w-6 h-6 text-sky-400" /> Edit Ticket Details — {editingPass.pass_code}
            </h3>
            <span className="text-xs px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 font-mono">
              {editingPass.band?.label}
            </span>
          </div>

          <p className="text-xs text-slate-400">
            Update physical serial number, donor identity, and payment reconciliation details. Every physical pass serial and payment reference ID must be unique.
          </p>

          {editError && (
            <div className="p-3 bg-red-950/80 border border-red-800 rounded-xl text-xs text-red-200 font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{editError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-300">Physical Pass Serial No.</Label>
              <Input
                placeholder="e.g. GF-SPL-001 or 1042"
                value={editPhysicalSerial}
                onChange={(e) => setEditPhysicalSerial(e.target.value.toUpperCase())}
                className="h-11 bg-[#1A2839] border-slate-700 text-white rounded-xl font-mono uppercase"
              />
              <p className="text-[11px] text-slate-400">Must be unique across all active tickets.</p>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-300">Ticket Type</Label>
              <select
                value={editTicketType}
                onChange={(e) => setEditTicketType(e.target.value)}
                className="w-full h-11 bg-[#1A2839] border border-slate-700 text-white rounded-xl px-3 text-sm font-bold"
              >
                <option value="physical">Physical Ticket</option>
                <option value="digital">Digital Pass (WhatsApp/QR)</option>
              </select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-300">Donor Name *</Label>
              <Input
                placeholder="Full Donor Name"
                value={editDonorName}
                onChange={(e) => setEditDonorName(e.target.value)}
                className="h-11 bg-[#1A2839] border-slate-700 text-white rounded-xl"
                required
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-300">Donor Mobile (10 Digits) *</Label>
              <Input
                placeholder="10-digit mobile number"
                value={editDonorPhone}
                onChange={(e) => setEditDonorPhone(e.target.value)}
                maxLength={10}
                className="h-11 bg-[#1A2839] border-slate-700 text-white rounded-xl font-mono"
                required
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-300">Donor Email (Optional)</Label>
              <Input
                type="email"
                placeholder="donor@example.com"
                value={editDonorEmail}
                onChange={(e) => setEditDonorEmail(e.target.value)}
                className="h-11 bg-[#1A2839] border-slate-700 text-white rounded-xl"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-300">Payment Mode</Label>
              <select
                value={editPaymentMode}
                onChange={(e) => setEditPaymentMode(e.target.value)}
                className="w-full h-11 bg-[#1A2839] border border-slate-700 text-white rounded-xl px-3 text-sm font-bold"
              >
                <option value="upi">UPI (GPay / PhonePe / Paytm)</option>
                <option value="bank_transfer">Cheque / Bank Transfer (NEFT/RTGS)</option>
                <option value="cash">Cash in Hand</option>
                <option value="card">Card / POS</option>
              </select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-300">Payment Ref / UTR / Cheque No.</Label>
              <Input
                placeholder="e.g. 129750328916 or Cheque #401829"
                value={editReferenceNo}
                onChange={(e) => setEditReferenceNo(e.target.value)}
                className="h-11 bg-[#1A2839] border-slate-700 text-white rounded-xl font-mono"
              />
              <p className="text-[11px] text-slate-400">Must be unique across different transactions.</p>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-300">Payment Status</Label>
              <select
                value={editPaymentStatus}
                onChange={(e) => setEditPaymentStatus(e.target.value)}
                className="w-full h-11 bg-[#1A2839] border border-slate-700 text-white rounded-xl px-3 text-sm font-bold"
              >
                <option value="received">Received (Collected)</option>
                <option value="pending">Pending (Awaiting payment)</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditingPass(null)}
              className="bg-[#1A2839] border-slate-700 text-white rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !editDonorName.trim() || !editDonorPhone.trim()}
              className="bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Save Changes
            </Button>
          </div>
        </form>
      )}

      {/* Cancel Pass Modal */}
      {cancellingPass && (
        <form onSubmit={handleCancelPass} className="p-6 bg-[#131F2E] border-2 border-red-600 rounded-3xl space-y-4 shadow-2xl">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <XCircle className="w-6 h-6 text-red-500" /> Cancel Pass {cancellingPass.pass_code}
          </h3>
          <p className="text-xs text-slate-300">
            Donor: <strong className="text-white">{cancellingPass.donor_name}</strong> • Band:{' '}
            <strong className="text-amber-400">{cancellingPass.band?.label}</strong>.
            This will release the seat back to the band inventory and void payments.
          </p>

          <div className="space-y-1">
            <Label className="text-xs font-bold text-slate-300">Cancellation Reason (Mandatory) *</Label>
            <Input
              placeholder="e.g. Donor requested refund / Wrong band issued"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="h-11 bg-[#1A2839] border-slate-700 text-white rounded-xl"
              required
              autoFocus
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCancellingPass(null)}
              className="bg-[#1A2839] border-slate-700 text-white rounded-xl"
            >
              Back
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !cancelReason.trim()}
              className="bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Confirm Cancellation
            </Button>
          </div>
        </form>
      )}

      {/* Move Pass Modal */}
      {movingPass && (
        <form onSubmit={handleMovePass} className="p-6 bg-[#131F2E] border-2 border-amber-500 rounded-3xl space-y-4 shadow-2xl">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <ArrowRightLeft className="w-6 h-6 text-[#E8913A]" /> Move Pass {movingPass.pass_code} to Another Band
          </h3>
          <p className="text-xs text-slate-300">
            Current Band: <strong className="text-white">{movingPass.band?.label}</strong>
          </p>

          <div className="space-y-2">
            <Label className="text-xs font-bold text-slate-300">Destination Band</Label>
            <select
              value={targetBandId}
              onChange={(e) => setTargetBandId(e.target.value)}
              className="w-full h-11 bg-[#1A2839] border border-slate-700 text-white rounded-xl px-3 text-sm font-bold"
            >
              {bands
                .filter((b) => b.id !== movingPass.band_id)
                .map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.label} (₹{b.price.toLocaleString('en-IN')})
                  </option>
                ))}
            </select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-bold text-slate-300">Reason / Note (Optional)</Label>
            <Input
              placeholder="e.g. Upgraded to VIP tier"
              value={moveReason}
              onChange={(e) => setMoveReason(e.target.value)}
              className="h-11 bg-[#1A2839] border-slate-700 text-white rounded-xl"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setMovingPass(null)}
              className="bg-[#1A2839] border-slate-700 text-white rounded-xl"
            >
              Back
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="bg-[#E8913A] hover:bg-[#D97706] text-slate-950 font-bold rounded-xl"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Confirm Move
            </Button>
          </div>
        </form>
      )}

      {/* Passes List */}
      <div className="space-y-3">
        {filteredPasses.length === 0 ? (
          <div className="p-12 text-center bg-[#131F2E] border border-slate-800 rounded-3xl text-slate-500">
            <Ticket className="w-12 h-12 mx-auto mb-3 text-slate-600" />
            <h3 className="text-base font-bold text-white">No passes match your search</h3>
          </div>
        ) : (
          filteredPasses.map((p) => {
            const isCancelled = p.status === 'cancelled';
            const isUsed = p.status === 'used';
            const payment = p.payments && p.payments.length > 0 ? p.payments[0] : null;

            return (
              <div
                key={p.id}
                className={`p-4 sm:p-5 rounded-2xl border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${
                  isCancelled
                    ? 'bg-slate-900/40 border-slate-800 opacity-60'
                    : 'bg-[#131F2E] border-slate-800'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-bold text-lg text-[#E8913A]">
                      {p.pass_code}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        isCancelled
                          ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                          : isUsed
                          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                          : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      }`}
                    >
                      {p.status.toUpperCase()}
                    </span>
                    {p.ticket_type === 'physical' && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 font-mono">
                        Serial: {p.physical_serial || 'None'}
                      </span>
                    )}
                    {payment && payment.reference_no && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-500/20 text-sky-300 font-mono border border-sky-500/30">
                        {payment.mode?.toUpperCase()}: {payment.reference_no}
                      </span>
                    )}
                  </div>

                  <div className="text-sm font-semibold text-white mt-1">
                    {p.donor_name} • <span className="font-mono text-slate-400">{p.donor_phone}</span>
                    {p.donor_email && <span className="text-slate-400 text-xs font-normal ml-2">({p.donor_email})</span>}
                  </div>

                  <div className="text-xs text-slate-400 mt-0.5">
                    {p.band?.label} • Seller: {p.seller?.full_name || 'N/A'}{' '}
                    {p.seller?.groups?.name ? `[${p.seller.groups.name}]` : ''}
                  </div>
                </div>

                {!isCancelled && (
                  <div className="flex items-center gap-2 w-full sm:w-auto border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-800 flex-wrap sm:flex-nowrap">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openEditModal(p)}
                      className="bg-[#1A2839] border-slate-700 text-sky-400 hover:text-white rounded-xl text-xs h-9 shrink-0"
                    >
                      <Edit3 className="w-3.5 h-3.5 mr-1" /> Edit Details
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setMovingPass(p);
                        const otherBand = bands.find((b) => b.id !== p.band_id);
                        if (otherBand) setTargetBandId(otherBand.id);
                        setCancellingPass(null);
                        setEditingPass(null);
                      }}
                      className="bg-[#1A2839] border-slate-700 text-amber-400 hover:text-white rounded-xl text-xs h-9 shrink-0"
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5 mr-1" /> Move Band
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setCancellingPass(p);
                        setCancelReason('');
                        setMovingPass(null);
                        setEditingPass(null);
                      }}
                      className="bg-red-950/40 border-red-800/60 text-red-400 hover:bg-red-900/60 rounded-xl text-xs h-9 shrink-0"
                    >
                      <XCircle className="w-3.5 h-3.5 mr-1" /> Void / Cancel
                    </Button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
