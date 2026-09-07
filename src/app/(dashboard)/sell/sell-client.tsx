'use client';

import { useState, useEffect, useMemo } from 'react';
import { Band, PaymentMode, PaymentStatus, SeatData } from '@/lib/types';
import { AuthUser } from '@/lib/auth/session';
import { issuePass, undoSale, checkDonorPassCount, markPendingPaymentReceived, demoSwitchRoleAction } from './actions';
import { updatePassDonorDetails } from '@/app/(dashboard)/guests/actions';
import { numberToIndianWords } from '@/lib/format-utils';
import { getWhatsAppUrl } from '@/lib/whatsapp';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { 
  Ticket, 
  CheckCircle2, 
  AlertCircle, 
  ArrowLeft, 
  ArrowRight, 
  Loader2, 
  RotateCcw, 
  Send, 
  ShieldAlert,
  CreditCard,
  Plus,
  Minus,
  Check,
  Edit3,
  UserCheck
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PendingSaleItem } from './page';
import { cn } from '@/lib/utils';

interface SellClientProps {
  bands: Band[];
  sellers: any[];
  seats: SeatData[];
  currentUser: AuthUser;
  initialHolds?: any[];
  pendingSales: PendingSaleItem[];
}

export function SellClient({
  bands,
  sellers,
  currentUser,
  pendingSales: initialPendingSales,
}: SellClientProps) {
  // Top level active tab: 'sell' | 'pending'
  const [activeTab, setActiveTab] = useState<'sell' | 'pending'>('sell');

  // Step in wizard: 1 (Sale details) | 2 (Payment & confirm) | 3 (Success)
  const [step, setStep] = useState<number>(1);

  // Form states
  const [selectedBandId, setSelectedBandId] = useState<string>('band_5000');
  const [quantity, setQuantity] = useState<number>(1);
  const [physicalSerials, setPhysicalSerials] = useState<string[]>(['']);
  
  // Default seller to logged in user if they are a member, else first in list
  const defaultSellerId = currentUser.memberId || (sellers.length > 0 ? sellers[0].id : '');
  const [sellerMemberId, setSellerMemberId] = useState<number | ''>(defaultSellerId);

  // Donor fields
  const [donorName, setDonorName] = useState<string>('');
  const [donorPhone, setDonorPhone] = useState<string>('');
  const [donorEmail, setDonorEmail] = useState<string>('');
  const [donorIsFallback, setDonorIsFallback] = useState<boolean>(false);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  // Payment fields
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('upi');
  const [paymentReferenceNo, setPaymentReferenceNo] = useState<string>('');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('received');
  const [preferredLanguage, setPreferredLanguage] = useState<'en' | 'ta'>('en');

  // Submission & Confirmation modal states
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Success state
  const [successResult, setSuccessResult] = useState<{
    passCode: string;
    passCodes: string[];
    quantity: number;
    totalAmount: number;
    undoToken: string;
    donorMessage: string;
    donorPhone: string;
    sellerMessage: string;
    sellerPhone: string;
    sellerName: string;
    bandLabel: string;
    seatDetails?: string;
    passId: string;
  } | null>(null);

  // 60-Second Undo Timer State
  const [undoSecondsLeft, setUndoSecondsLeft] = useState<number>(60);
  const [isUndoing, setIsUndoing] = useState<boolean>(false);
  const [undoMessage, setUndoMessage] = useState<string | null>(null);

  // Pending Payments list state
  const [pendingSales, setPendingSales] = useState<PendingSaleItem[]>(initialPendingSales);
  const [expandedPaymentSaleId, setExpandedPaymentSaleId] = useState<string | null>(null);
  const [inlineRefNo, setInlineRefNo] = useState<string>('');
  const [inlineMode, setInlineMode] = useState<PaymentMode>('upi');
  const [isMarkingReceived, setIsMarkingReceived] = useState<boolean>(false);

  // Edit Donor modal state
  const [editingSale, setEditingSale] = useState<PendingSaleItem | null>(null);
  const [editDonorName, setEditDonorName] = useState<string>('');
  const [editDonorPhone, setEditDonorPhone] = useState<string>('');
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);

  // Demo Switcher Modal
  const [showDemoModal, setShowDemoModal] = useState<boolean>(false);
  const [isSwitchingRole, setIsSwitchingRole] = useState<boolean>(false);

  // Ensure default selected band is valid
  const currentBand = bands.find((b) => b.id === selectedBandId) || bands[0] || null;
  const totalAmount = (currentBand?.price || 0) * quantity;

  // Keep physical serials list matching quantity
  useEffect(() => {
    setPhysicalSerials((prev) => {
      const updated = [...prev];
      while (updated.length < quantity) updated.push('');
      return updated.slice(0, quantity);
    });
  }, [quantity]);

  // Handle seller fallback toggle
  useEffect(() => {
    if (donorIsFallback) {
      const selectedSeller = sellers.find((s) => s.id === Number(sellerMemberId));
      if (selectedSeller) {
        setDonorName(selectedSeller.full_name);
        const cleanPhone = (selectedSeller.phone_e164 || selectedSeller.phone_raw || '').replace(/\D/g, '').slice(-10);
        setDonorPhone(cleanPhone);
      }
    }
  }, [donorIsFallback, sellerMemberId, sellers]);

  // Check duplicate donor on phone blur (§19.3)
  const handleDonorPhoneBlur = async () => {
    if (donorIsFallback || !donorPhone || donorPhone.length < 10) {
      setDuplicateWarning(null);
      return;
    }
    const res = await checkDonorPassCount(donorPhone);
    if (res.count > 0) {
      setDuplicateWarning(`Notice: This mobile number already has ${res.count} active pass${res.count === 1 ? '' : 'es'}.`);
    } else {
      setDuplicateWarning(null);
    }
  };

  // 60-Second Countdown timer for Undo window
  useEffect(() => {
    if (!successResult || undoSecondsLeft <= 0) return;
    const timer = setInterval(() => {
      setUndoSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [successResult, undoSecondsLeft]);

  // Step 1 Validation
  const canContinueToStep2 = useMemo(() => {
    if (!selectedBandId || !currentBand) return false;
    if ((currentBand.remaining_count ?? 0) < quantity) return false;
    if (quantity < 1 || quantity > 10) return false;
    if (!sellerMemberId) return false;
    if (!donorName.trim()) return false;
    if (!donorPhone.trim() || donorPhone.replace(/\D/g, '').length < 10) return false;
    return true;
  }, [selectedBandId, currentBand, quantity, sellerMemberId, donorName, donorPhone]);

  // Step 2 Validation
  const canSubmitSale = useMemo(() => {
    if (!paymentReferenceNo.trim()) return false;
    const emptySerials = physicalSerials.filter((s) => !s || !s.trim());
    if (emptySerials.length > 0) return false;
    const uniqueSet = new Set(physicalSerials.map((s) => s.trim().toUpperCase()));
    if (uniqueSet.size !== physicalSerials.length) return false;
    return true;
  }, [paymentReferenceNo, physicalSerials]);

  // Handle Form Submission
  const handleConfirmIssue = async () => {
    setShowConfirmModal(false);
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await issuePass({
        bandId: selectedBandId,
        quantity,
        ticketType: 'physical',
        physicalSerials: physicalSerials.map((s) => s.trim().toUpperCase()),
        sellerMemberId: Number(sellerMemberId),
        donorName: donorName.trim(),
        donorPhone: donorPhone.trim(),
        donorEmail: donorEmail?.trim() || null,
        donorIsSellerFallback: donorIsFallback,
        paymentMode,
        paymentAmount: totalAmount,
        paymentReferenceNo: paymentReferenceNo.trim(),
        paymentStatus,
        preferredLanguage,
      });

      if (!res.success) {
        setErrorMessage(res.error || 'Failed to issue passes.');
        toast.error(res.error || 'Failed to issue passes.');
        setIsSubmitting(false);
        return;
      }

      toast.success(`${quantity} Pass${quantity > 1 ? 'es' : ''} issued successfully!`);

      // Success
      setSuccessResult({
        passCode: res.passCode!,
        passCodes: (res as any).passCodes || [res.passCode!],
        quantity: (res as any).quantity || quantity,
        totalAmount: (res as any).totalAmount || totalAmount,
        undoToken: res.undoToken!,
        donorMessage: res.donorMessage!,
        donorPhone: res.donorPhone!,
        sellerMessage: res.sellerMessage!,
        sellerPhone: res.sellerPhone!,
        sellerName: res.sellerName!,
        bandLabel: res.bandLabel!,
        seatDetails: (res as any).seatDetails || `${quantity} Seat(s) in ${res.bandLabel}`,
        passId: res.pass.id,
      });

      setUndoSecondsLeft(60);
      setStep(3); // Success view
    } catch (err: any) {
      setErrorMessage(err.message || 'An unexpected error occurred.');
      toast.error(err.message || 'An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Undo Sale
  const handleUndo = async () => {
    if (!successResult) return;
    setIsUndoing(true);
    try {
      const res = await undoSale(successResult.passId, successResult.undoToken);
      if (res.success) {
        setUndoMessage(res.message || 'Sale cancelled and seats released.');
        toast.success('Sale successfully undone.');
      } else {
        toast.error(res.error || 'Failed to undo sale.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Could not undo sale.');
    } finally {
      setIsUndoing(false);
    }
  };

  // Reset form to sell another pass
  const handleResetForm = () => {
    setStep(1);
    setQuantity(1);
    setPhysicalSerials(['']);
    setDonorName('');
    setDonorPhone('');
    setDonorEmail('');
    setDonorIsFallback(false);
    setPaymentReferenceNo('');
    setPaymentStatus('received');
    setPaymentMode('upi');
    setSuccessResult(null);
    setUndoMessage(null);
    setUndoSecondsLeft(60);
    setErrorMessage(null);
  };

  // Handle Mark Received inline in Pending Payments tab
  const handleSaveReceived = async (sale: PendingSaleItem) => {
    if (!inlineRefNo.trim()) {
      toast.error('Reference number / UTR is mandatory.');
      return;
    }
    setIsMarkingReceived(true);
    try {
      const res = await markPendingPaymentReceived(sale.payment_ids, inlineRefNo.trim(), inlineMode);
      if (res.success) {
        toast.success(`Payment of ₹${sale.total_amount.toLocaleString('en-IN')} marked as received!`);
        setPendingSales((prev) => prev.filter((item) => item.id !== sale.id));
        setExpandedPaymentSaleId(null);
        setInlineRefNo('');
      } else {
        toast.error(res.error || 'Failed to mark payment received.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error updating payment.');
    } finally {
      setIsMarkingReceived(false);
    }
  };

  // Handle Save Edited Donor Details
  const handleSaveDonorEdit = async () => {
    if (!editingSale) return;
    if (!editDonorName.trim() || !editDonorPhone.trim()) {
      toast.error('Donor name and valid 10-digit mobile are required.');
      return;
    }
    setIsSavingEdit(true);
    try {
      let allGood = true;
      for (const passId of editingSale.pass_ids) {
        const res = await updatePassDonorDetails(passId, {
          donor_name: editDonorName.trim(),
          donor_phone: editDonorPhone.trim(),
        });
        if (!res.success) {
          allGood = false;
          toast.error(res.error || 'Failed to update pass.');
          break;
        }
      }
      if (allGood) {
        toast.success('Donor details updated.');
        setPendingSales((prev) =>
          prev.map((s) =>
            s.id === editingSale.id
              ? { ...s, donor_name: editDonorName.trim(), donor_phone: editDonorPhone.trim() }
              : s
          )
        );
        setEditingSale(null);
      }
    } catch (err: any) {
      toast.error(err.message || 'Could not update details.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Handle Demo Switch Role
  const handleDemoSwitch = async (role: 'super_admin' | 'group_admin' | 'tech_coordinator') => {
    setIsSwitchingRole(true);
    try {
      const res = await demoSwitchRoleAction(role);
      if (res.success) {
        toast.success(`Switched role to ${role.replace('_', ' ')}! Reloading...`);
        setShowDemoModal(false);
        window.location.reload();
      } else {
        toast.error(res.error || 'Could not switch demo user.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error switching demo user.');
    } finally {
      setIsSwitchingRole(false);
    }
  };

  const totalPendingAmount = useMemo(() => {
    return pendingSales.reduce((acc, curr) => acc + curr.total_amount, 0);
  }, [pendingSales]);

  // Role subtitle format
  const roleDisplayTitle = useMemo(() => {
    if (currentUser.role === 'super_admin' || currentUser.role === 'system_admin') {
      return `${currentUser.fullName} — Super Admin (sees all teams)`;
    }
    const team = currentUser.groupName || `Team ${currentUser.groupId || 1}`;
    const roleName = currentUser.role === 'tech_coordinator' ? 'Tech Coordinator' : 'Group Admin';
    return `${currentUser.fullName} — ${roleName}, ${team} (sees ${team} only)`;
  }, [currentUser]);

  return (
    <div className="space-y-6">
      {/* Top Header & Role Information */}
      <div>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
          Sell a Pass
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          {roleDisplayTitle}
        </p>
      </div>

      {/* Top Navigation Tabs (matches Image 2 & Image 3) */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => setActiveTab('sell')}
          className={cn(
            "px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-sm",
            activeTab === 'sell'
              ? "bg-[#E58327] text-slate-950 shadow-amber-950/40"
              : "bg-[#102030] text-slate-300 border border-slate-800 hover:bg-slate-800 hover:text-white"
          )}
        >
          Sell a Pass
        </button>

        <button
          onClick={() => setActiveTab('pending')}
          className={cn(
            "px-5 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 shadow-sm",
            activeTab === 'pending'
              ? "bg-[#E58327] text-slate-950 shadow-amber-950/40"
              : "bg-[#102030] text-slate-300 border border-slate-800 hover:bg-slate-800 hover:text-white"
          )}
        >
          <span>Pending Payments ({pendingSales.length})</span>
        </button>

        <button
          onClick={() => setShowDemoModal(true)}
          className="px-4 py-2.5 rounded-xl font-semibold text-xs text-slate-400 bg-[#102030] border border-slate-800 hover:bg-slate-800 hover:text-white transition-all flex items-center gap-1.5 ml-auto"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Demo: switch role</span>
        </button>
      </div>

      {/* TAB 1: SELL A PASS */}
      {activeTab === 'sell' && (
        <div className="space-y-6">
          {/* Step Indicator (matches Image 2) */}
          {step !== 3 && (
            <div className="grid grid-cols-2 gap-3">
              <div
                onClick={() => setStep(1)}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl border transition-all cursor-pointer",
                  step === 1
                    ? "border-amber-500/80 bg-[#102030] shadow-sm shadow-amber-950/20"
                    : "border-slate-800 bg-[#0B1724]/60 opacity-60 hover:opacity-80"
                )}
              >
                <span
                  className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-xs font-black",
                    step === 1 ? "bg-[#E58327] text-slate-950" : "bg-slate-800 text-slate-400"
                  )}
                >
                  1
                </span>
                <span className="font-bold text-sm text-white">Sale details</span>
              </div>

              <div
                onClick={() => {
                  if (canContinueToStep2) setStep(2);
                }}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl border transition-all",
                  step === 2
                    ? "border-amber-500/80 bg-[#102030] shadow-sm shadow-amber-950/20"
                    : "border-slate-800 bg-[#0B1724]/60 opacity-60",
                  !canContinueToStep2 && "pointer-events-none"
                )}
              >
                <span
                  className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-xs font-black",
                    step === 2 ? "bg-[#E58327] text-slate-950" : "bg-slate-800 text-slate-400"
                  )}
                >
                  2
                </span>
                <span className="font-bold text-sm text-white">Payment & confirm</span>
              </div>
            </div>
          )}

          {/* STEP 1: SALE DETAILS (matches Image 2) */}
          {step === 1 && (
            <div className="bg-[#102030] border border-slate-800 rounded-2xl p-5 sm:p-7 space-y-7 shadow-xl">
              <div>
                <h2 className="text-xl font-black text-white">Sale details</h2>
                <p className="text-sm text-slate-400 mt-0.5">
                  Fill this page, then continue to payment.
                </p>
              </div>

              {/* 1. PRICE BAND */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-amber-500 uppercase tracking-wider">
                    ① PRICE BAND
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  {bands.map((band) => {
                    const isSelected = selectedBandId === band.id;
                    const isSoldOut = (band.remaining_count ?? 0) <= 0;

                    let priceColorClass = 'text-white';
                    if (band.id === 'band_5000') priceColorClass = 'text-[#F59E0B]';
                    if (band.id === 'band_3500') priceColorClass = 'text-[#A78BFA]';
                    if (band.id === 'band_2500') priceColorClass = 'text-[#2DD4BF]';
                    if (band.id === 'band_1500') priceColorClass = 'text-[#94A3B8]';
                    if (band.id === 'band_pp') priceColorClass = 'text-[#38BDF8]';

                    return (
                      <button
                        key={band.id}
                        type="button"
                        disabled={isSoldOut}
                        onClick={() => setSelectedBandId(band.id)}
                        className={cn(
                          "relative text-left p-4 rounded-xl border transition-all flex flex-col justify-between h-24",
                          isSelected
                            ? "border-amber-500 bg-[#16293D] ring-2 ring-amber-500/20"
                            : isSoldOut
                            ? "border-slate-800/60 bg-slate-900/30 opacity-50 cursor-not-allowed"
                            : "border-slate-800 bg-[#0B1724]/80 hover:border-slate-700 hover:bg-[#122436]"
                        )}
                      >
                        <div className="flex items-start justify-between w-full">
                          <span className={cn("text-xl font-black tracking-tight", priceColorClass)}>
                            ₹{band.price.toLocaleString('en-IN')}
                          </span>
                          {isSelected && (
                            <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center">
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                            </span>
                          )}
                        </div>

                        <div>
                          {isSoldOut ? (
                            <span className="text-xs font-semibold text-rose-400">Sold out</span>
                          ) : (
                            <span className="text-xs font-semibold text-emerald-400">
                              {band.remaining_count ?? 0} left
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. HOW MANY PASSES? */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-amber-500 uppercase tracking-wider">
                    ② HOW MANY PASSES? (UP TO 10)
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {/* Stepper */}
                  <div className="flex items-center bg-[#0B1724] border border-slate-800 rounded-xl p-1">
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      disabled={quantity <= 1}
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-slate-300 hover:bg-slate-800 disabled:opacity-30 transition-colors"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="w-12 text-center text-xl font-black text-white">
                      {quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const maxAvail = currentBand ? Math.min(10, currentBand.remaining_count ?? 0) : 10;
                        setQuantity((q) => Math.min(maxAvail, q + 1));
                      }}
                      disabled={currentBand ? quantity >= Math.min(10, currentBand.remaining_count ?? 0) : quantity >= 10}
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-slate-300 hover:bg-slate-800 disabled:opacity-30 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Quick Pick Pills */}
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5, 10].map((num) => {
                      const isAvail = currentBand ? (currentBand.remaining_count ?? 0) >= num : true;
                      const isQuickSelected = quantity === num;
                      return (
                        <button
                          key={num}
                          type="button"
                          disabled={!isAvail}
                          onClick={() => setQuantity(num)}
                          className={cn(
                            "w-10 h-10 rounded-xl font-bold text-sm transition-all border",
                            isQuickSelected
                              ? "bg-[#E58327] text-slate-950 border-amber-500"
                              : !isAvail
                              ? "bg-slate-900/40 text-slate-600 border-slate-800/40 cursor-not-allowed"
                              : "bg-[#0B1724] text-slate-300 border-slate-800 hover:border-slate-700 hover:text-white"
                          )}
                        >
                          {num}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Green Summary Banner (matches Image 2) */}
                <div className="bg-[#0D281E] border border-emerald-800/60 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-inner">
                  <div>
                    <span className="text-base sm:text-lg font-medium text-emerald-300">
                      {quantity} pass{quantity > 1 ? 'es' : ''} at ₹{(currentBand?.price || 0).toLocaleString('en-IN')}
                    </span>
                    <p className="text-xs text-emerald-400/80 mt-0.5 font-mono">
                      {numberToIndianWords(totalAmount)}
                    </p>
                  </div>
                  <span className="text-2xl sm:text-3xl font-black text-emerald-400 tracking-tight">
                    ₹{totalAmount.toLocaleString('en-IN')}
                  </span>
                </div>

                {/* Orange Left Border Info Box (matches Image 2) */}
                <div className="border-l-4 border-amber-500 bg-[#0B1724]/90 p-4 rounded-r-xl space-y-2 text-xs sm:text-sm text-slate-300">
                  <p>
                    <strong className="text-white">Buying for one family or a group of friends?</strong> You can block up to 10 passes together — they all go to one person, in one confirmation message.
                  </p>
                  <p>
                    <strong className="text-white">Buying for different individuals?</strong> Please enter them as separate sales, so each person's pass and credit is recorded correctly.
                  </p>
                </div>

                {/* Row allocation verbatim helper text */}
                <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl text-xs text-slate-400">
                  <span className="text-slate-300 font-medium">Automatic Seating:</span> You are reserving passes by price band. Seats will be allocated row-wise automatically — donors do not pick individual seat numbers.
                </div>
              </div>

              {/* 3. WHO SOLD THIS PASS? (matches Image 2) */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-amber-500 uppercase tracking-wider">
                    ③ WHO SOLD THIS PASS?
                  </span>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="sellerSelect" className="text-sm font-semibold text-slate-200">
                    Seller — gets competition credit <span className="text-red-400">*</span>
                  </Label>
                  <select
                    id="sellerSelect"
                    value={sellerMemberId}
                    onChange={(e) => setSellerMemberId(Number(e.target.value))}
                    className="w-full h-12 px-3 bg-[#0B1724] border border-slate-800 rounded-xl text-white font-medium text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  >
                    {sellers.map((s) => {
                      const roleTag = s.is_group_admin
                        ? 'Group Admin'
                        : s.is_tech_coord
                        ? 'Tech Coordinator'
                        : 'Member';
                      return (
                        <option key={s.id} value={s.id}>
                          {s.full_name} [T{s.group_id}] — {roleTag}
                        </option>
                      );
                    })}
                  </select>
                  <p className="text-[11px] text-slate-400">
                    {currentUser.role === 'super_admin' || currentUser.role === 'system_admin'
                      ? 'Super Admin: all members across all 8 teams are listed.'
                      : `${currentUser.role === 'tech_coordinator' ? 'Tech Coordinator' : 'Group Admin'}: only your ${currentUser.groupName || 'Team'} members — and your own name — are listed.`}
                  </p>
                </div>
              </div>

              {/* 4. DONOR DETAILS */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-amber-500 uppercase tracking-wider">
                    ④ DONOR DETAILS
                  </span>
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300 hover:text-white">
                    <input
                      type="checkbox"
                      checked={donorIsFallback}
                      onChange={(e) => setDonorIsFallback(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-amber-500"
                    />
                    <span>Donor details same as seller</span>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="donorName" className="text-sm font-semibold text-slate-200">
                      Donor Name <span className="text-red-400">*</span>
                    </Label>
                    <Input
                      id="donorName"
                      placeholder="e.g. Mr. S. Ramanathan"
                      value={donorName}
                      disabled={donorIsFallback}
                      onChange={(e) => setDonorName(e.target.value)}
                      className="h-12 bg-[#0B1724] border-slate-800 rounded-xl text-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="donorPhone" className="text-sm font-semibold text-slate-200">
                      Donor WhatsApp Mobile <span className="text-red-400">*</span>
                    </Label>
                    <Input
                      id="donorPhone"
                      placeholder="e.g. 98410 11111 or +1 415 555 0134"
                      value={donorPhone}
                      disabled={donorIsFallback}
                      onChange={(e) => setDonorPhone(e.target.value)}
                      onBlur={handleDonorPhoneBlur}
                      className="h-12 bg-[#0B1724] border-slate-800 rounded-xl text-white"
                    />
                  </div>
                </div>

                {duplicateWarning && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>{duplicateWarning}</span>
                  </div>
                )}
              </div>

              {/* Step 1 Continue CTA */}
              <div className="pt-2">
                <Button
                  type="button"
                  disabled={!canContinueToStep2}
                  onClick={() => setStep(2)}
                  className="w-full h-14 bg-[#E58327] hover:bg-amber-600 text-slate-950 font-black text-base rounded-xl transition-colors shadow-lg shadow-amber-950/40"
                >
                  <span>Continue to Payment & Serials →</span>
                </Button>
              </div>
            </div>
          )}

          {/* STEP 2: PAYMENT & CONFIRM */}
          {step === 2 && (
            <div className="bg-[#102030] border border-slate-800 rounded-2xl p-5 sm:p-7 space-y-7 shadow-xl">
              <div>
                <h2 className="text-xl font-black text-white">Step 2 of 2: Physical Pass Serials & Payment</h2>
                <p className="text-sm text-slate-400 mt-0.5">
                  Enter physical serial numbers and payment details to complete sale.
                </p>
              </div>

              {/* Summary Chip */}
              <div className="p-4 bg-[#0B1724] border border-slate-800 rounded-xl flex flex-wrap items-center justify-between gap-3 text-sm">
                <div>
                  <span className="font-bold text-white">
                    Selected: {quantity} × {currentBand?.label} = ₹{totalAmount.toLocaleString('en-IN')}
                  </span>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Donor: {donorName} ({donorPhone})
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-xs font-semibold text-amber-400 hover:text-amber-300 underline"
                >
                  Edit details
                </button>
              </div>

              {/* Payment Mode Selector */}
              <div className="space-y-3">
                <Label className="text-sm font-semibold text-slate-200">
                  Payment Mode <span className="text-red-400">*</span>
                </Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {[
                    { id: 'upi', label: 'UPI' },
                    { id: 'cash', label: 'Cash' },
                    { id: 'bank_transfer', label: 'Cheque / Bank' },
                    ...(currentUser.role === 'super_admin' || currentUser.role === 'system_admin'
                      ? [{ id: 'sponsor_comp', label: 'Complementary' }]
                      : []),
                  ].map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => setPaymentMode(mode.id as PaymentMode)}
                      className={cn(
                        "h-12 rounded-xl font-bold text-sm border transition-all flex items-center justify-center gap-2",
                        paymentMode === mode.id
                          ? "bg-[#E58327] text-slate-950 border-amber-500 shadow-md shadow-amber-950/20"
                          : "bg-[#0B1724] text-slate-300 border-slate-800 hover:border-slate-700 hover:text-white"
                      )}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Payment Reference / UTR (MANDATORY) */}
              <div className="space-y-1.5">
                <Label htmlFor="paymentRef" className="text-sm font-semibold text-slate-200">
                  Payment reference / UTR / Cash voucher no. <span className="text-red-400">*</span>
                </Label>
                <Input
                  id="paymentRef"
                  placeholder="Enter UPI ref / UTR / Cash voucher now"
                  value={paymentReferenceNo}
                  onChange={(e) => setPaymentReferenceNo(e.target.value)}
                  className="h-12 bg-[#0B1724] border-slate-800 rounded-xl text-white font-mono"
                  required
                />
                <p className="text-[11px] text-slate-400">
                  Required for audit trail and financial reconciliation.
                </p>
              </div>

              {/* Payment Status Toggle */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-slate-200">
                  Payment Status
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPaymentStatus('received')}
                    className={cn(
                      "h-12 rounded-xl font-bold text-sm border transition-all flex items-center justify-center gap-2",
                      paymentStatus === 'received'
                        ? "bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-950/20"
                        : "bg-[#0B1724] text-slate-300 border-slate-800 hover:border-slate-700"
                    )}
                  >
                    <Check className="w-4 h-4" />
                    <span>Received (Money in hand/bank)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentStatus('pending')}
                    className={cn(
                      "h-12 rounded-xl font-bold text-sm border transition-all flex items-center justify-center gap-2",
                      paymentStatus === 'pending'
                        ? "bg-amber-600 text-white border-amber-500 shadow-md shadow-amber-950/20"
                        : "bg-[#0B1724] text-slate-300 border-slate-800 hover:border-slate-700"
                    )}
                  >
                    <span>Pending (Awaiting money)</span>
                  </button>
                </div>

                {paymentStatus === 'pending' && (
                  <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300 flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <span>
                      Passes will be issued immediately so the donor gets their physical serials, but the amount will <strong>NOT</strong> count towards your group's competition total until marked received in the Pending Payments tab.
                    </span>
                  </div>
                )}
              </div>

              {/* Physical Pass Serial Numbers (N Inputs) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold text-slate-200">
                    Physical Pass Serial Numbers <span className="text-red-400">*</span>
                  </Label>
                  <span className="text-xs text-slate-400 font-mono">
                    {physicalSerials.filter((s) => s.trim()).length} of {quantity} entered
                  </span>
                </div>

                <div className="space-y-2.5">
                  {Array.from({ length: quantity }).map((_, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <span className="w-24 text-xs font-bold text-slate-400 shrink-0">
                        Pass {index + 1} of {quantity}
                      </span>
                      <Input
                        placeholder={`e.g. HL-${currentBand?.id === 'band_5000' ? 'A' : currentBand?.id === 'band_3500' ? 'B' : currentBand?.id === 'band_2500' ? 'C' : currentBand?.id === 'band_1500' ? 'D' : 'PP'}-${String(index + 1).padStart(4, '0')}`}
                        value={physicalSerials[index] || ''}
                        onChange={(e) => {
                          const updated = [...physicalSerials];
                          updated[index] = e.target.value.toUpperCase();
                          setPhysicalSerials(updated);
                        }}
                        className="h-11 bg-[#0B1724] border-slate-800 rounded-xl text-white font-mono uppercase"
                        required
                      />
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-slate-400">
                  Every pass is physical and serial-numbered. Each serial must be unique across all issued passes.
                </p>
              </div>

              {errorMessage && (
                <div className="p-3 bg-red-950/40 border border-red-800 rounded-xl text-xs text-red-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep(1)}
                  className="h-14 px-6 border-slate-800 bg-[#0B1724] hover:bg-slate-800 text-slate-300 rounded-xl"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  <span>Back</span>
                </Button>

                <Button
                  type="button"
                  disabled={!canSubmitSale || isSubmitting}
                  onClick={() => setShowConfirmModal(true)}
                  className="flex-1 h-14 bg-[#E58327] hover:bg-amber-600 text-slate-950 font-black text-base rounded-xl transition-colors shadow-lg shadow-amber-950/40"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin mr-2" />
                      <span>Issuing Passes...</span>
                    </>
                  ) : (
                    <span>Issue {quantity} Physical Pass{quantity > 1 ? 'es' : ''} (₹{totalAmount.toLocaleString('en-IN')})</span>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* STEP 3: SUCCESS VIEW */}
          {step === 3 && successResult && (
            <div className="bg-[#102030] border border-emerald-800/60 rounded-2xl p-6 sm:p-8 space-y-6 shadow-2xl text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-500 mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10 text-emerald-400" />
              </div>

              <div>
                <h2 className="text-2xl sm:text-3xl font-black text-white">
                  {successResult.quantity} Pass{successResult.quantity > 1 ? 'es' : ''} Issued Successfully!
                </h2>
                <p className="text-sm text-slate-300 mt-1">
                  Issued to <strong className="text-white">{successResult.donorPhone} ({successResult.donorMessage ? successResult.sellerName : ''})</strong> for ₹{successResult.totalAmount.toLocaleString('en-IN')}.
                </p>
              </div>

              {/* Physical Serial Badges */}
              <div className="bg-[#0B1724] border border-slate-800 rounded-xl p-4 text-left space-y-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Physical Serials & Row Allocation
                </span>
                <div className="flex flex-wrap gap-2">
                  {physicalSerials.map((s, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-300 font-mono text-xs font-bold rounded-lg"
                    >
                      {s}
                    </span>
                  ))}
                </div>
                <p className="text-xs text-slate-400 pt-1">
                  {successResult.seatDetails}
                </p>
              </div>

              {/* WhatsApp CTA */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                <a
                  href={`https://wa.me/${successResult.donorPhone.replace(/\D/g, '')}?text=${encodeURIComponent(successResult.donorMessage)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto h-12 px-6 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 transition-colors"
                >
                  <Send className="w-4 h-4" />
                  <span>Send WhatsApp Confirmation</span>
                </a>

                {/* 60s Undo Window */}
                {undoSecondsLeft > 0 && !undoMessage && (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isUndoing}
                    onClick={handleUndo}
                    className="w-full sm:w-auto h-12 px-5 border-red-800/80 bg-red-950/40 hover:bg-red-900/60 text-red-200 text-xs font-bold rounded-xl"
                  >
                    {isUndoing ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <RotateCcw className="w-4 h-4 mr-2" />
                    )}
                    <span>Undo Sale ({undoSecondsLeft}s left)</span>
                  </Button>
                )}

                {undoMessage && (
                  <div className="text-xs font-semibold text-red-400">
                    {undoMessage}
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-slate-800">
                <Button
                  type="button"
                  onClick={handleResetForm}
                  className="h-11 px-6 bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold rounded-xl"
                >
                  Sell Another Pass
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: PENDING PAYMENTS (matches Image 3) */}
      {activeTab === 'pending' && (
        <div className="space-y-6">
          <div className="bg-[#102030] border border-slate-800 rounded-2xl p-5 sm:p-7 space-y-5 shadow-xl">
            <div>
              <h2 className="text-xl font-black text-white">Pending Payments</h2>
              <p className="text-sm text-slate-400 mt-0.5">
                {currentUser.role === 'super_admin' || currentUser.role === 'system_admin'
                  ? 'All teams pending sales.'
                  : `Your ${currentUser.groupName || 'Team 1'} pending sales only.`}
              </p>
            </div>

            {/* Top Pending Banner */}
            <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-amber-300">
                  Pending Payments ({pendingSales.length} total — ₹{totalPendingAmount.toLocaleString('en-IN')} to be collected)
                </span>
              </div>
              <p className="text-xs text-slate-300">
                These passes have been issued with physical serials, but payment is not yet confirmed. Once money is in hand/bank, click <strong>"Mark received"</strong> to credit your group's competition total.
              </p>
            </div>

            {/* Pending Sales Cards List */}
            {pendingSales.length === 0 ? (
              <div className="p-12 text-center border border-dashed border-slate-800 rounded-xl text-slate-400 text-sm">
                No pending payments found. All issued passes have confirmed payments!
              </div>
            ) : (
              <div className="space-y-4">
                {pendingSales.map((sale) => {
                  const isExpanded = expandedPaymentSaleId === sale.id;
                  return (
                    <div
                      key={sale.id}
                      className="border-2 border-amber-500/40 bg-[#0B1724] rounded-xl p-5 space-y-4 transition-all"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                        <div className="space-y-1">
                          <h3 className="text-base sm:text-lg font-black text-white">
                            {sale.donor_name}
                          </h3>
                          <p className="text-xs text-slate-400">
                            {sale.band_label} · {sale.quantity} pass{sale.quantity > 1 ? 'es' : ''} · Serial{sale.serials.length > 1 ? 's' : ''} {sale.serials.join(', ')} · Seller: {sale.seller_name} [{sale.seller_group_name || 'Team'}]
                          </p>
                          <div className="pt-1">
                            <span className="inline-block px-2.5 py-0.5 rounded bg-amber-950/80 border border-amber-700/60 text-amber-400 font-bold text-[11px] uppercase tracking-wider">
                              PENDING · seat{sale.quantity > 1 ? 's' : ''} held
                            </span>
                          </div>
                        </div>

                        <span className="text-2xl font-black text-amber-400 tracking-tight shrink-0">
                          ₹{sale.total_amount.toLocaleString('en-IN')}
                        </span>
                      </div>

                      {/* Card Action Buttons */}
                      {!isExpanded && (
                        <div className="flex items-center gap-3 pt-1">
                          <Button
                            type="button"
                            onClick={() => {
                              setExpandedPaymentSaleId(sale.id);
                              setInlineRefNo(sale.reference_no || '');
                              setInlineMode(sale.mode as PaymentMode || 'upi');
                            }}
                            className="h-10 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-950/30"
                          >
                            Mark received
                          </Button>

                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              setEditingSale(sale);
                              setEditDonorName(sale.donor_name);
                              setEditDonorPhone(sale.donor_phone);
                            }}
                            className="h-10 px-4 border-slate-800 bg-[#102030] hover:bg-slate-800 text-slate-300 text-xs font-semibold rounded-xl"
                          >
                            <Edit3 className="w-3.5 h-3.5 mr-1.5" />
                            <span>Edit details</span>
                          </Button>
                        </div>
                      )}

                      {/* Inline Expanded Mark Received Form (matches Image 3) */}
                      {isExpanded && (
                        <div className="pt-3 border-t border-slate-800/80 space-y-3">
                          <div className="space-y-1">
                            <Label className="text-xs font-semibold text-slate-200">
                              Reference number / UTR <span className="text-red-400">*</span>
                            </Label>
                            <Input
                              placeholder="Enter UPI ref / UTR now"
                              value={inlineRefNo}
                              onChange={(e) => setInlineRefNo(e.target.value)}
                              className="h-11 bg-[#102030] border-slate-700 text-white font-mono text-sm rounded-xl"
                            />
                          </div>

                          <div className="space-y-1">
                            <Label className="text-xs font-semibold text-slate-200">
                              Payment mode
                            </Label>
                            <select
                              value={inlineMode}
                              onChange={(e) => setInlineMode(e.target.value as PaymentMode)}
                              className="w-full h-11 px-3 bg-[#102030] border border-slate-700 rounded-xl text-white font-medium text-sm"
                            >
                              <option value="upi">UPI</option>
                              <option value="cash">Cash</option>
                              <option value="bank_transfer">Bank Transfer / Cheque</option>
                            </select>
                          </div>

                          <div className="flex items-center gap-3 pt-1">
                            <Button
                              type="button"
                              disabled={isMarkingReceived || !inlineRefNo.trim()}
                              onClick={() => handleSaveReceived(sale)}
                              className="h-10 px-5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-950/30"
                            >
                              {isMarkingReceived ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                              ) : (
                                <Check className="w-3.5 h-3.5 mr-1.5" />
                              )}
                              <span>✓ Save as received</span>
                            </Button>

                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() => setExpandedPaymentSaleId(null)}
                              className="h-10 text-xs text-slate-400 hover:text-white"
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Explanatory Bottom Note (matches Image 3) */}
            <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl text-xs text-slate-400 leading-relaxed">
              A pending sale still <strong>holds its seats</strong> — pending means "booked, money awaited", not available. Marking received only updates the payment; it does not re-book the seat. Group Admins see only their group's pending sales; Super Admin sees all.
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog on Issue */}
      <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
        <DialogContent className="bg-[#102030] border border-slate-800 text-white max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-white">
              Confirm Pass Issuance
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs mt-1">
              Please double check details before issuing physical passes.
            </DialogDescription>
          </DialogHeader>

          <div className="py-3 space-y-2 text-xs sm:text-sm text-slate-200">
            <p>
              You are about to issue <strong>{quantity} physical pass{quantity > 1 ? 'es' : ''}</strong> for <strong>{currentBand?.label}</strong> to <strong>{donorName}</strong> ({donorPhone}).
            </p>
            <p>
              Reference / UTR: <span className="font-mono text-amber-400">{paymentReferenceNo}</span>
            </p>
            <p>
              Serial numbers: <span className="font-mono text-emerald-400">{physicalSerials.filter(Boolean).join(', ')}</span>
            </p>
            <p>
              Total Amount: <strong className="text-white">₹{totalAmount.toLocaleString('en-IN')}</strong> ({paymentStatus === 'received' ? 'Received' : 'Pending'})
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowConfirmModal(false)}
              className="border-slate-800 bg-[#0B1724] text-slate-300 hover:bg-slate-800 rounded-xl text-xs"
            >
              Back & Edit
            </Button>
            <Button
              type="button"
              onClick={handleConfirmIssue}
              className="bg-[#E58327] hover:bg-amber-600 text-slate-950 font-black rounded-xl text-xs"
            >
              Yes, Issue Passes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Donor Details Dialog */}
      <Dialog open={!!editingSale} onOpenChange={(open) => !open && setEditingSale(null)}>
        <DialogContent className="bg-[#102030] border border-slate-800 text-white max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-white">
              Edit Donor Details
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs mt-1">
              Update name and mobile number for this pending sale.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-200">Donor Name</Label>
              <Input
                value={editDonorName}
                onChange={(e) => setEditDonorName(e.target.value)}
                className="h-11 bg-[#0B1724] border-slate-800 text-white rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-200">Donor WhatsApp Mobile</Label>
              <Input
                value={editDonorPhone}
                onChange={(e) => setEditDonorPhone(e.target.value)}
                className="h-11 bg-[#0B1724] border-slate-800 text-white rounded-xl"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditingSale(null)}
              className="border-slate-800 bg-[#0B1724] text-slate-300 hover:bg-slate-800 rounded-xl text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={isSavingEdit}
              onClick={handleSaveDonorEdit}
              className="bg-[#E58327] hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs"
            >
              {isSavingEdit ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Demo Switch Role Modal */}
      <Dialog open={showDemoModal} onOpenChange={setShowDemoModal}>
        <DialogContent className="bg-[#102030] border border-slate-800 text-white max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-white flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-amber-500" />
              Demo: Switch User Role
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs mt-1">
              Select a persona to test role scoping, competition credit, and permissions.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2.5 py-3">
            <button
              type="button"
              disabled={isSwitchingRole}
              onClick={() => handleDemoSwitch('super_admin')}
              className="w-full text-left p-3.5 rounded-xl border border-slate-800 bg-[#0B1724] hover:border-amber-500/50 hover:bg-[#122436] transition-all flex items-center justify-between"
            >
              <div>
                <span className="font-bold text-sm text-white block">Kiru / Admin (Super Admin)</span>
                <span className="text-xs text-slate-400">All 8 teams · all 88 members · full planning & sales</span>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400">
                SUPER ADMIN
              </span>
            </button>

            <button
              type="button"
              disabled={isSwitchingRole}
              onClick={() => handleDemoSwitch('group_admin')}
              className="w-full text-left p-3.5 rounded-xl border border-slate-800 bg-[#0B1724] hover:border-amber-500/50 hover:bg-[#122436] transition-all flex items-center justify-between"
            >
              <div>
                <span className="font-bold text-sm text-white block">Buvana (Group Admin — Team 1)</span>
                <span className="text-xs text-slate-400">Team 1 only · credits to Team 1 sellers</span>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400">
                GROUP ADMIN
              </span>
            </button>

            <button
              type="button"
              disabled={isSwitchingRole}
              onClick={() => handleDemoSwitch('tech_coordinator')}
              className="w-full text-left p-3.5 rounded-xl border border-slate-800 bg-[#0B1724] hover:border-teal-500/50 hover:bg-[#122436] transition-all flex items-center justify-between"
            >
              <div>
                <span className="font-bold text-sm text-white block">Ganesh R (Tech Coordinator — Team 1)</span>
                <span className="text-xs text-slate-400">Enters sales on behalf of Team 1 members</span>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-500/20 text-teal-400">
                TECH COORD
              </span>
            </button>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowDemoModal(false)}
              className="border-slate-800 bg-[#0B1724] text-slate-300 hover:bg-slate-800 rounded-xl text-xs"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
