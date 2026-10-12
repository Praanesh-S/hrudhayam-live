'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AuthUser } from '@/lib/auth/session';
import { markPaymentReceived, updatePaymentAmountAction } from './actions';
import { formatPendingPaymentReminder, getWhatsAppUrl } from '@/lib/whatsapp';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  CreditCard, 
  Search, 
  CheckCircle2, 
  Clock, 
  Send, 
  Loader2, 
  AlertCircle,
  FileCheck,
  Pencil,
  Coins
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

interface PaymentsClientProps {
  payments: any[];
  upiVpa: string;
  currentUser: AuthUser;
}

export function PaymentsClient({ payments, upiVpa }: PaymentsClientProps) {
  const router = useRouter();
  const [currentPayments, setCurrentPayments] = useState<any[]>(payments);
  const [filter, setFilter] = useState<'all' | 'pending' | 'received'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    setCurrentPayments(payments);
  }, [payments]);

  // Confirm payment modal
  const [confirmingPayment, setConfirmingPayment] = useState<any | null>(null);
  const [referenceNo, setReferenceNo] = useState('');
  const [selectedMode, setSelectedMode] = useState<string>('upi');
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Edit pending amount modal
  const [editingPaymentAmount, setEditingPaymentAmount] = useState<any | null>(null);
  const [newPaymentAmountInput, setNewPaymentAmountInput] = useState<string>('');
  const [amountReasonInput, setAmountReasonInput] = useState<string>('');
  const [isSavingAmount, setIsSavingAmount] = useState<boolean>(false);

  const handleOpenEditAmount = (payment: any) => {
    setEditingPaymentAmount(payment);
    setNewPaymentAmountInput(payment.amount !== undefined ? String(payment.amount) : '0');
    setAmountReasonInput('');
  };

  const handleSavePaymentAmount = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editingPaymentAmount) return;

    const val = Number(newPaymentAmountInput);
    if (isNaN(val) || val < 0) {
      setStatusMessage({ type: 'error', text: 'Please enter a valid non-negative amount.' });
      return;
    }

    setIsSavingAmount(true);
    setStatusMessage(null);

    const res = await updatePaymentAmountAction(
      editingPaymentAmount.id,
      val,
      amountReasonInput.trim() || undefined
    );
    setIsSavingAmount(false);

    if (res.success) {
      const pName =
        editingPaymentAmount.pass?.donor_name ||
        editingPaymentAmount.sponsor?.sponsor_name ||
        editingPaymentAmount.club?.club_name ||
        'Donor';
      setStatusMessage({
        type: 'success',
        text: `Amount updated to ₹${val.toLocaleString('en-IN')} for ${pName}.`,
      });
      setCurrentPayments((prev) =>
        prev.map((p) =>
          p.id === editingPaymentAmount.id ? { ...p, amount: val } : p
        )
      );
      setEditingPaymentAmount(null);
      router.refresh();
    } else {
      setStatusMessage({
        type: 'error',
        text: res.error || 'Failed to update payment amount.',
      });
    }
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmingPayment || !referenceNo.trim() || !selectedMode) return;

    setIsLoading(true);
    setStatusMessage(null);

    const res = await markPaymentReceived(confirmingPayment.id, referenceNo.trim(), selectedMode);
    setIsLoading(false);

    if (res.success) {
      setStatusMessage({ type: 'success', text: 'Payment confirmed as received!' });
      setCurrentPayments((prev) =>
        prev.map((p) =>
          p.id === confirmingPayment.id
            ? { ...p, status: 'received', reference_no: referenceNo.trim(), mode: selectedMode }
            : p
        )
      );
      setConfirmingPayment(null);
      setReferenceNo('');
      router.refresh();
    } else {
      setStatusMessage({ type: 'error', text: res.error || 'Failed to confirm payment.' });
    }
  };

  // Filter payments
  const filteredPayments = currentPayments.filter((p) => {
    const matchesFilter = filter === 'all' || p.status === filter;
    const name = p.pass?.donor_name || p.sponsor?.sponsor_name || p.club?.club_name || '';
    const phone = p.pass?.donor_phone || p.sponsor?.contact_phone || p.club?.contact_phone || '';
    const code = p.pass?.pass_code || '';
    const ref = p.reference_no || '';
    const q = searchQuery.toLowerCase();

    const matchesSearch =
      name.toLowerCase().includes(q) ||
      phone.includes(q) ||
      code.toLowerCase().includes(q) ||
      ref.toLowerCase().includes(q);

    return matchesFilter && matchesSearch;
  });

  // KPI Metrics
  const totalReceived = currentPayments
    .filter((p) => p.status === 'received')
    .reduce((sum, p) => sum + (p.amount || 0), 0);

  const totalPending = currentPayments
    .filter((p) => p.status === 'pending')
    .reduce((sum, p) => sum + (p.amount || 0), 0);

  const totalCollectable = totalReceived + totalPending;

  return (
    <div className="space-y-6">
      {statusMessage && (
        <Alert className={statusMessage.type === 'success' ? 'bg-emerald-950/70 border-emerald-800 text-emerald-100' : 'bg-red-950/70 border-red-800 text-red-100'}>
          {statusMessage.type === 'success' ? <CheckCircle2 className="h-5 w-5 text-emerald-400" /> : <AlertCircle className="h-5 w-5 text-red-400" />}
          <AlertTitle className="text-base font-bold">{statusMessage.type === 'success' ? 'Payment Updated' : 'Error'}</AlertTitle>
          <AlertDescription className="text-sm">{statusMessage.text}</AlertDescription>
        </Alert>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#131F2E] border border-amber-500/30 p-5 rounded-2xl shadow-lg">
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Total Collectable
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400">
              Target
            </span>
          </div>
          <div className="text-3xl font-black text-white font-mono mt-1">
            ₹{totalCollectable.toLocaleString('en-IN')}
          </div>
          <span className="text-xs text-slate-400 mt-1 block">Confirmed + Pending Receivables</span>
        </div>

        <div className="bg-[#131F2E] border border-slate-800 p-5 rounded-2xl">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Total Confirmed Received
          </span>
          <div className="text-3xl font-black text-emerald-400 font-mono mt-1">
            ₹{totalReceived.toLocaleString('en-IN')}
          </div>
          <span className="text-xs text-slate-500 mt-1 block">Verified with bank / cash vouchers</span>
        </div>

        <div className="bg-[#131F2E] border border-slate-800 p-5 rounded-2xl">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Total Pending Receivables
          </span>
          <div className="text-3xl font-black text-[#E8913A] font-mono mt-1">
            ₹{totalPending.toLocaleString('en-IN')}
          </div>
          <span className="text-xs text-slate-500 mt-1 block">Active follow-up pledges</span>
        </div>

        <div className="bg-[#131F2E] border border-slate-800 p-5 rounded-2xl">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Trust UPI VPA
          </span>
          <div className="text-xl font-bold font-mono text-white mt-2 truncate">
            {upiVpa}
          </div>
          <span className="text-xs text-slate-500">Attached to payment reminder messages</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
        <div className="flex overflow-x-auto no-scrollbar gap-1.5 p-1 bg-[#131F2E] border border-slate-800 rounded-xl max-w-full">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 transition-all ${
              filter === 'all' ? 'bg-[#E8913A] text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            All Collections ({payments.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('pending')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 transition-all ${
              filter === 'pending' ? 'bg-[#E8913A] text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            Pending Only ({payments.filter((p) => p.status === 'pending').length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('received')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 transition-all ${
              filter === 'received' ? 'bg-[#E8913A] text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            Received Only ({payments.filter((p) => p.status === 'received').length})
          </button>
        </div>

        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search by name, phone, code, or UTR..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-10 bg-[#131F2E] border-slate-800 text-white rounded-xl text-sm"
          />
        </div>
      </div>

      {/* Confirm Payment Modal */}
      {confirmingPayment && (
        <form onSubmit={handleConfirm} className="p-6 bg-[#131F2E] border-2 border-amber-500 rounded-3xl space-y-4 shadow-2xl">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" /> Confirm Payment Received
          </h3>
          <p className="text-xs text-slate-300">
            Amount: <strong className="text-emerald-400 font-mono">₹{confirmingPayment.amount?.toLocaleString('en-IN')}</strong> • Mode: {confirmingPayment.mode.toUpperCase()}
          </p>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-300">
              Payment Mode *
            </Label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {[
                { id: 'upi', label: 'UPI' },
                { id: 'cheque', label: 'Cheque' },
                { id: 'cash', label: 'Cash' },
                { id: 'bank_transfer', label: 'Bank Transfer' },
                { id: 'card', label: 'Card' },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSelectedMode(m.id)}
                  className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition-all ${
                    selectedMode === m.id
                      ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md font-black'
                      : 'bg-[#1A2839] text-slate-300 border-slate-700 hover:border-slate-600'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-bold text-slate-300">
              Bank Transaction Reference / UTR Number *
            </Label>
            <Input
              placeholder="e.g. 423589102431 or CASH VOUCHER #12"
              value={referenceNo}
              onChange={(e) => setReferenceNo(e.target.value)}
              className="h-11 bg-[#1A2839] border-slate-700 text-white font-mono rounded-xl"
              required
              autoFocus
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmingPayment(null)}
              className="bg-[#1A2839] border-slate-700 text-white rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !referenceNo.trim()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Confirm Received
            </Button>
          </div>
        </form>
      )}

      {/* Payments List */}
      <div className="space-y-3">
        {filteredPayments.length === 0 ? (
          <div className="p-12 text-center bg-[#131F2E] border border-slate-800 rounded-3xl text-slate-500">
            <CreditCard className="w-12 h-12 mx-auto mb-3 text-slate-600" />
            <h3 className="text-base font-bold text-white">No payments match your filter</h3>
          </div>
        ) : (
          filteredPayments.map((p) => {
            const isReceived = p.status === 'received';
            const name = p.pass?.donor_name || p.sponsor?.sponsor_name || p.club?.club_name || 'Direct';
            const phone = p.pass?.donor_phone || p.sponsor?.contact_phone || p.club?.contact_phone;
            const category = p.pass ? `Pass (${p.pass.pass_code})` : p.sponsor ? `Sponsor (${p.sponsor.tier})` : 'Club';

            const reminderMsg = formatPendingPaymentReminder({
              donorOrSponsorName: name,
              amount: p.amount,
              category,
              upiVpa,
            });

            return (
              <div
                key={p.id}
                className="p-4 sm:p-5 bg-[#131F2E] border border-slate-800 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-lg text-white">{name}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        isReceived
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      }`}
                    >
                      {isReceived ? '✓ RECEIVED' : '⏳ PENDING'}
                    </span>
                    <span className="text-xs text-slate-500">[{category}]</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 mt-1">
                    <span>Mode: <strong className="text-white">{p.mode?.toUpperCase()}</strong></span>
                    <span>Ref / UTR: <strong className="font-mono text-white">{p.reference_no}</strong></span>
                    {phone && <span className="font-mono">{phone}</span>}
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-800">
                  <div className="text-left sm:text-right">
                    <div className="flex items-center gap-1.5 sm:justify-end">
                      <div className="text-2xl font-black font-mono text-[#E8913A]">
                        ₹{p.amount?.toLocaleString('en-IN')}
                      </div>
                      {!isReceived && (
                        <button
                          type="button"
                          onClick={() => handleOpenEditAmount(p)}
                          title="Edit pending amount to collect"
                          className="p-1 rounded-md text-slate-400 hover:text-amber-400 hover:bg-amber-400/10 transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {!isReceived && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenEditAmount(p)}
                          className="bg-[#1A2839] hover:bg-[#253950] border-slate-700 text-amber-400 font-bold text-xs h-9 px-3 rounded-xl gap-1"
                        >
                          <Pencil className="w-3.5 h-3.5" /> Edit (₹)
                        </Button>

                        {phone && (
                          <a
                            href={getWhatsAppUrl(phone, reminderMsg)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 h-9 px-3 bg-[#25D366] hover:bg-[#20bd5a] text-slate-950 font-bold text-xs rounded-xl shadow transition-all"
                          >
                            <Send className="w-3.5 h-3.5" /> Remind
                          </a>
                        )}

                        <Button
                          size="sm"
                          onClick={() => {
                            setConfirmingPayment(p);
                            setReferenceNo(p.reference_no && p.reference_no !== 'MIGRATED' ? p.reference_no : '');
                            setSelectedMode(p.mode || 'upi');
                          }}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-9 px-3 rounded-xl"
                        >
                          <FileCheck className="w-3.5 h-3.5 mr-1" /> Mark Paid
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Dedicated Adjust Pending Payment Amount Dialog */}
      <Dialog open={!!editingPaymentAmount} onOpenChange={(open) => !open && setEditingPaymentAmount(null)}>
        <DialogContent className="bg-[#102030] border border-slate-800 text-white max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-white flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-amber-400" />
              <span>Adjust Pending Payment Amount</span>
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs mt-1">
              Change receivable amount for{' '}
              <strong>
                {editingPaymentAmount?.pass?.donor_name ||
                  editingPaymentAmount?.sponsor?.sponsor_name ||
                  editingPaymentAmount?.club?.club_name ||
                  'Donor'}
              </strong>{' '}
              ({editingPaymentAmount?.pass ? `Pass ${editingPaymentAmount.pass.pass_code}` : 'Pending Pledge'}).
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSavePaymentAmount} className="space-y-4 py-2">
            <div className="p-3 bg-[#0B1724] rounded-xl border border-slate-800/80 space-y-1 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Currently Recorded Amount:</span>
                <span className="font-mono text-amber-400 font-bold">
                  ₹{editingPaymentAmount?.amount?.toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-200">
                New Amount to Collect (₹) <span className="text-red-400">*</span>
              </Label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-base">₹</span>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={newPaymentAmountInput}
                  onChange={(e) => setNewPaymentAmountInput(e.target.value)}
                  className="h-12 pl-8 bg-[#0B1724] border-slate-700 text-white font-mono text-lg font-bold rounded-xl focus:border-amber-500"
                  placeholder="0 for complimentary"
                  autoFocus
                />
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setNewPaymentAmountInput('0')}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold bg-purple-950/60 border border-purple-700/50 text-purple-300 hover:bg-purple-900/60 transition-colors cursor-pointer"
                >
                  🎁 Complimentary (₹0)
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-300">
                Reason / Note for Change (optional)
              </Label>
              <Input
                placeholder="e.g. Last-minute discount, Complimentary pass, Concession..."
                value={amountReasonInput}
                onChange={(e) => setAmountReasonInput(e.target.value)}
                className="h-10 bg-[#0B1724] border-slate-700 text-white rounded-xl text-xs"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingPaymentAmount(null)}
                className="border-slate-800 bg-[#0B1724] text-slate-300 hover:bg-slate-800 rounded-xl text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSavingAmount || !newPaymentAmountInput}
                className="bg-[#E58327] hover:bg-amber-600 text-slate-950 font-black rounded-xl text-xs"
              >
                {isSavingAmount ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                Save Amount
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
