'use client';

import { useState, useEffect } from 'react';
import { Band, TicketType, PaymentMode, PaymentStatus } from '@/lib/types';
import { AuthUser } from '@/lib/auth/session';
import { issuePass, undoSale, checkDonorPassCount } from './actions';
import { getWhatsAppUrl } from '@/lib/whatsapp';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Ticket, 
  Smartphone, 
  CheckCircle2, 
  AlertCircle, 
  ArrowLeft, 
  ArrowRight, 
  Loader2, 
  RotateCcw, 
  Send, 
  Upload, 
  ShieldAlert,
  UserCheck,
  CreditCard
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface SellClientProps {
  bands: Band[];
  sellers: any[];
  currentUser: AuthUser;
  initialHolds?: any[];
}

export function SellClient({ bands, sellers, currentUser }: SellClientProps) {
  // Step in wizard: 1 (Band) -> 2 (Type) -> 3 (Seller) -> 4 (Donor) -> 5 (Payment) -> 6 (Success)
  const [step, setStep] = useState<number>(1);

  // Form states
  const [selectedBandId, setSelectedBandId] = useState<string>('');
  const [ticketType, setTicketType] = useState<TicketType>('digital');
  const [physicalSerial, setPhysicalSerial] = useState<string>('');
  
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
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentReferenceNo, setPaymentReferenceNo] = useState<string>('');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('received');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [preferredLanguage, setPreferredLanguage] = useState<'en' | 'ta'>('en');

  // Loading & Submission states
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Success state
  const [successResult, setSuccessResult] = useState<{
    passCode: string;
    undoToken: string;
    donorMessage: string;
    donorPhone: string;
    sellerMessage: string;
    sellerPhone: string;
    sellerName: string;
    bandLabel: string;
    passId: string;
  } | null>(null);

  // 60-Second Undo Timer State (§19.2)
  const [undoSecondsLeft, setUndoSecondsLeft] = useState<number>(60);
  const [isUndoing, setIsUndoing] = useState<boolean>(false);
  const [undoMessage, setUndoMessage] = useState<string | null>(null);

  const selectedBand = bands.find((b) => b.id === selectedBandId);

  // Automatically sync amount when band changes
  useEffect(() => {
    if (selectedBand) {
      setPaymentAmount(selectedBand.price);
    }
  }, [selectedBand]);

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

  // Handle Form Submission
  const handleSubmit = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      let uploadedFileKey: string | null = null;

      // Upload payment screenshot if attached
      if (proofFile) {
        const supabase = createClient();
        const fileExt = proofFile.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
        const filePath = `receipts/${fileName}`;

        const { error: uploadErr } = await supabase.storage
          .from('payment-proofs')
          .upload(filePath, proofFile);

        if (!uploadErr) {
          uploadedFileKey = filePath;
        } else {
          console.warn('Screenshot upload failed, continuing without screenshot:', uploadErr);
        }
      }

      const res = await issuePass({
        bandId: selectedBandId,
        ticketType,
        physicalSerial: ticketType === 'physical' ? physicalSerial : null,
        sellerMemberId: Number(sellerMemberId),
        donorName,
        donorPhone,
        donorEmail: donorEmail || null,
        donorIsSellerFallback: donorIsFallback,
        paymentMode,
        paymentAmount,
        paymentReferenceNo,
        paymentStatus,
        proofFileKey: uploadedFileKey,
        preferredLanguage,
      });

      if (!res.success) {
        setErrorMessage(res.error || 'Failed to issue pass.');
        setIsSubmitting(false);
        return;
      }

      // Success
      setSuccessResult({
        passCode: res.passCode!,
        undoToken: res.undoToken!,
        donorMessage: res.donorMessage!,
        donorPhone: res.donorPhone!,
        sellerMessage: res.sellerMessage!,
        sellerPhone: res.sellerPhone!,
        sellerName: res.sellerName!,
        bandLabel: res.bandLabel!,
        passId: res.pass.id,
      });

      setUndoSecondsLeft(60);
      setStep(6);
    } catch (err: any) {
      setErrorMessage(err.message || 'An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Undo Sale
  const handleUndo = async () => {
    if (!successResult) return;
    setIsUndoing(true);
    setUndoMessage(null);

    const res = await undoSale(successResult.passId, successResult.undoToken);
    setIsUndoing(false);

    if (res.success) {
      setUndoMessage(res.message || 'Pass cancelled successfully.');
      setSuccessResult(null);
    } else {
      setErrorMessage(res.error || 'Failed to undo pass.');
    }
  };

  // Reset form for next sale
  const handleResetForNext = () => {
    setStep(1);
    setSelectedBandId('');
    setTicketType('digital');
    setPhysicalSerial('');
    setDonorName('');
    setDonorPhone('');
    setDonorEmail('');
    setDonorIsFallback(false);
    setPaymentReferenceNo('');
    setPaymentStatus('received');
    setProofFile(null);
    setSuccessResult(null);
    setErrorMessage(null);
    setUndoMessage(null);
  };

  return (
    <div className="bg-[#131F2E] border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl">
      {/* Error / Undo Alert Banner */}
      {errorMessage && (
        <Alert variant="destructive" className="mb-6 bg-red-950/70 border-red-800 text-red-100">
          <AlertCircle className="h-5 w-5 text-red-400" />
          <AlertTitle className="text-base font-bold">Error</AlertTitle>
          <AlertDescription className="text-sm">{errorMessage}</AlertDescription>
        </Alert>
      )}

      {undoMessage && (
        <Alert className="mb-6 bg-emerald-950/70 border-emerald-800 text-emerald-100">
          <CheckCircle2 className="h-5 w-5 text-emerald-400" />
          <AlertTitle className="text-base font-bold">Pass Undone</AlertTitle>
          <AlertDescription className="text-sm">{undoMessage}</AlertDescription>
        </Alert>
      )}

      {/* Progress Indicator */}
      {step < 6 && (
        <div className="mb-8">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400 mb-2">
            <span>STEP {step} OF 5</span>
            <span>
              {step === 1 && 'Select Price Band'}
              {step === 2 && 'Ticket Type'}
              {step === 3 && 'Seller Attribution'}
              {step === 4 && 'Donor Information'}
              {step === 5 && 'Payment Verification'}
            </span>
          </div>
          <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
            <div 
              className="bg-[#E8913A] h-full transition-all duration-300 ease-out" 
              style={{ width: `${(step / 5) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────── */}
      {/* STEP 1: CHOOSE BAND (§6.1, §17)                */}
      {/* ────────────────────────────────────────────── */}
      {step === 1 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-black text-white">1. Select Price Band</h2>
            <p className="text-slate-400 text-sm mt-1">
              Choose the seating tier. Sold-out bands cannot be selected (Rule R5).
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {bands.map((band) => {
              const remaining = band.remaining_count ?? 0;
              const isSoldOut = remaining <= 0;
              const isSelected = selectedBandId === band.id;

              return (
                <button
                  key={band.id}
                  type="button"
                  disabled={isSoldOut}
                  onClick={() => setSelectedBandId(band.id)}
                  className={`relative text-left p-6 rounded-2xl border-2 transition-all flex flex-col justify-between min-h-[140px] ${
                    isSoldOut
                      ? 'bg-slate-900/40 border-slate-800/80 opacity-50 cursor-not-allowed'
                      : isSelected
                      ? 'bg-amber-500/15 border-amber-500 shadow-lg shadow-amber-950/30'
                      : 'bg-[#1A2839] border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <span className="font-bold text-lg text-white">
                      {band.label}
                    </span>
                    <span className="text-2xl font-black text-[#E8913A]">
                      ₹{band.price.toLocaleString('en-IN')}
                    </span>
                  </div>

                  <div className="mt-4 flex justify-between items-end text-sm">
                    <span className={`font-semibold ${isSoldOut ? 'text-red-400' : 'text-emerald-400'}`}>
                      {isSoldOut ? 'Sold Out' : `${remaining} Seats Available`}
                    </span>
                    <span className="text-xs text-slate-400">
                      Capacity: {band.total_allocated}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex justify-end pt-4">
            <Button
              size="lg"
              className="h-14 px-8 bg-[#E8913A] hover:bg-[#D97706] text-slate-950 font-black text-lg rounded-xl shadow-lg"
              disabled={!selectedBandId}
              onClick={() => setStep(2)}
            >
              Continue to Ticket Type <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────── */}
      {/* STEP 2: TICKET TYPE (§6.2, Rule R4)             */}
      {/* ────────────────────────────────────────────── */}
      {step === 2 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-black text-white">2. Choose Ticket Type</h2>
            <p className="text-slate-400 text-sm mt-1">
              Golden Rule (R4): A seat is issued once only — Digital QR or Physical serial, never both.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setTicketType('digital')}
              className={`p-6 rounded-2xl border-2 text-left transition-all ${
                ticketType === 'digital'
                  ? 'bg-amber-500/15 border-amber-500 shadow-lg'
                  : 'bg-[#1A2839] border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center gap-3">
                <Smartphone className="w-8 h-8 text-[#E8913A]" />
                <div>
                  <h3 className="text-xl font-black text-white">Digital Pass</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Instant WhatsApp delivery with QR barcode</p>
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setTicketType('physical')}
              className={`p-6 rounded-2xl border-2 text-left transition-all ${
                ticketType === 'physical'
                  ? 'bg-amber-500/15 border-amber-500 shadow-lg'
                  : 'bg-[#1A2839] border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center gap-3">
                <Ticket className="w-8 h-8 text-[#E8913A]" />
                <div>
                  <h3 className="text-xl font-black text-white">Physical Ticket</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Pre-printed ticket with serial number</p>
                </div>
              </div>
            </button>
          </div>

          {ticketType === 'physical' && (
            <div className="space-y-2 p-5 bg-[#1A2839] border border-amber-500/30 rounded-2xl">
              <Label htmlFor="physicalSerial" className="text-base font-bold text-white">
                Physical Ticket Serial Number <span className="text-red-400">*</span>
              </Label>
              <p className="text-xs text-slate-400">
                Enter the exact serial number printed on the physical slip. Must be unique.
              </p>
              <Input
                id="physicalSerial"
                type="text"
                placeholder="e.g. T-0452 or 104"
                value={physicalSerial}
                onChange={(e) => setPhysicalSerial(e.target.value)}
                className="h-12 bg-slate-900 border-slate-700 text-white text-lg font-mono rounded-xl mt-1"
                required
              />
            </div>
          )}

          <div className="flex justify-between pt-4">
            <Button
              variant="outline"
              size="lg"
              className="h-14 px-6 bg-[#1A2839] border-slate-800 text-white text-base rounded-xl"
              onClick={() => setStep(1)}
            >
              <ArrowLeft className="mr-2 w-5 h-5" /> Back
            </Button>
            <Button
              size="lg"
              className="h-14 px-8 bg-[#E8913A] hover:bg-[#D97706] text-slate-950 font-black text-lg rounded-xl shadow-lg"
              disabled={ticketType === 'physical' && !physicalSerial.trim()}
              onClick={() => setStep(3)}
            >
              Continue to Seller <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────── */}
      {/* STEP 3: WHO SOLD IT (§6.4, Rule R2)            */}
      {/* ────────────────────────────────────────────── */}
      {step === 3 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-black text-white">3. Who Sold This Pass?</h2>
            <p className="text-slate-400 text-sm mt-1">
              Select the member to receive competition credit.
              {currentUser.role === 'group_admin' && ' (Scoped to your team members only, Rule R2)'}
            </p>
          </div>

          <div className="space-y-3">
            <Label htmlFor="sellerSelect" className="text-base font-bold text-white">
              Seller Name (for Friendly Competition Credit)
            </Label>
            <select
              id="sellerSelect"
              value={sellerMemberId}
              onChange={(e) => setSellerMemberId(Number(e.target.value))}
              className="w-full h-14 bg-[#1A2839] border-2 border-slate-700 text-white text-lg rounded-2xl px-4 font-medium focus:border-amber-500 focus:outline-none"
            >
              {sellers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name} {s.is_group_admin ? '★ (Coordinator)' : ''} {s.groups?.name ? `[${s.groups.name}]` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-between pt-4">
            <Button
              variant="outline"
              size="lg"
              className="h-14 px-6 bg-[#1A2839] border-slate-800 text-white text-base rounded-xl"
              onClick={() => setStep(2)}
            >
              <ArrowLeft className="mr-2 w-5 h-5" /> Back
            </Button>
            <Button
              size="lg"
              className="h-14 px-8 bg-[#E8913A] hover:bg-[#D97706] text-slate-950 font-black text-lg rounded-xl shadow-lg"
              disabled={!sellerMemberId}
              onClick={() => setStep(4)}
            >
              Continue to Donor Details <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────── */}
      {/* STEP 4: DONOR DETAILS (§6.5, Rule R6, §19.3)   */}
      {/* ────────────────────────────────────────────── */}
      {step === 4 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-black text-white">4. Donor Details</h2>
            <p className="text-slate-400 text-sm mt-1">
              Who is attending or contributing? WhatsApp pass will be sent to this number.
            </p>
          </div>

          {/* Rule R6: Seller fallback toggle */}
          <div className="p-4 bg-[#1A2839] border border-slate-700 rounded-2xl flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-base font-bold text-white flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-[#E8913A]" />
                Donor details not available — send to seller
              </span>
              <p className="text-xs text-slate-400">
                Copies seller's contact and flags record for audit transparency (Rule R6).
              </p>
            </div>
            <input
              type="checkbox"
              id="fallbackToggle"
              checked={donorIsFallback}
              onChange={(e) => {
                setDonorIsFallback(e.target.checked);
                if (e.target.checked) setDuplicateWarning(null);
              }}
              className="w-6 h-6 rounded text-amber-500 focus:ring-amber-500 bg-slate-900 border-slate-700"
            />
          </div>

          {!donorIsFallback ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="donorName" className="text-base font-bold text-white">
                  Donor Full Name <span className="text-red-400">*</span>
                </Label>
                <Input
                  id="donorName"
                  type="text"
                  placeholder="e.g. Mr. S. Ramanathan"
                  value={donorName}
                  onChange={(e) => setDonorName(e.target.value)}
                  className="h-12 bg-[#1A2839] border-slate-700 text-white text-lg rounded-xl"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="donorPhone" className="text-base font-bold text-white">
                  Donor WhatsApp Mobile Number <span className="text-red-400">*</span>
                </Label>
                <Input
                  id="donorPhone"
                  type="tel"
                  placeholder="10-digit mobile (e.g. 9841012345)"
                  value={donorPhone}
                  onChange={(e) => setDonorPhone(e.target.value)}
                  onBlur={handleDonorPhoneBlur}
                  className="h-12 bg-[#1A2839] border-slate-700 text-white text-lg rounded-xl font-mono"
                  required
                />
              </div>

              {duplicateWarning && (
                <div className="p-3 bg-amber-500/15 border border-amber-500/30 rounded-xl text-amber-300 text-xs flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                  <span>{duplicateWarning} (Multiple passes per family are welcome)</span>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="donorEmail" className="text-sm font-medium text-slate-300">
                  Donor Email (Optional)
                </Label>
                <Input
                  id="donorEmail"
                  type="email"
                  placeholder="name@example.com"
                  value={donorEmail}
                  onChange={(e) => setDonorEmail(e.target.value)}
                  className="h-11 bg-[#1A2839] border-slate-700 text-white text-base rounded-xl"
                />
              </div>
            </div>
          ) : (
            <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-2xl text-slate-300 text-sm">
              Pass will be delivered to the selected seller's registered phone number.
            </div>
          )}

          <div className="flex justify-between pt-4">
            <Button
              variant="outline"
              size="lg"
              className="h-14 px-6 bg-[#1A2839] border-slate-800 text-white text-base rounded-xl"
              onClick={() => setStep(3)}
            >
              <ArrowLeft className="mr-2 w-5 h-5" /> Back
            </Button>
            <Button
              size="lg"
              className="h-14 px-8 bg-[#E8913A] hover:bg-[#D97706] text-slate-950 font-black text-lg rounded-xl shadow-lg"
              disabled={!donorIsFallback && (!donorName.trim() || donorPhone.length < 10)}
              onClick={() => setStep(5)}
            >
              Continue to Payment <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────── */}
      {/* STEP 5: PAYMENT (§6.6, §12)                    */}
      {/* ────────────────────────────────────────────── */}
      {step === 5 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-black text-white">5. Payment Details</h2>
            <p className="text-slate-400 text-sm mt-1">
              Record the payment mode, amount, and mandatory reference number.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-base font-bold text-white">Payment Mode</Label>
              <select
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value as PaymentMode)}
                className="w-full h-12 bg-[#1A2839] border border-slate-700 text-white text-base rounded-xl px-3"
              >
                <option value="upi">UPI (GPay, PhonePe, Paytm)</option>
                <option value="bank_transfer">Bank Transfer (IMPS / NEFT)</option>
                <option value="cash">Cash</option>
                <option value="cheque">Cheque</option>
                <option value="card">Debit / Credit Card</option>
                <option value="complimentary">Complimentary / Trust Approved</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label className="text-base font-bold text-white">Payment Status</Label>
              <select
                value={paymentStatus}
                onChange={(e) => setPaymentStatus(e.target.value as PaymentStatus)}
                className="w-full h-12 bg-[#1A2839] border border-slate-700 text-white text-base rounded-xl px-3"
              >
                <option value="received">✓ Payment Received</option>
                <option value="pending">⏳ Payment Pending</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-base font-bold text-white">Amount (₹)</Label>
              <Input
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(Number(e.target.value))}
                className="h-12 bg-[#1A2839] border-slate-700 text-white text-xl font-bold font-mono rounded-xl"
                required
              />
            </div>

            <div className="space-y-2">
              <Label className="text-base font-bold text-white">
                Reference Number / UTR <span className="text-red-400">*</span>
              </Label>
              <Input
                type="text"
                placeholder='e.g. UPI Ref / UTR / "CASH"'
                value={paymentReferenceNo}
                onChange={(e) => setPaymentReferenceNo(e.target.value)}
                className="h-12 bg-[#1A2839] border-slate-700 text-white text-base rounded-xl font-mono"
                required
              />
            </div>
          </div>

          {/* Screenshot upload */}
          <div className="space-y-2 p-4 bg-[#1A2839] border border-slate-700 rounded-2xl">
            <Label className="text-sm font-bold text-white flex items-center gap-2">
              <Upload className="w-4 h-4 text-amber-500" />
              Upload Payment Screenshot / Voucher (Optional)
            </Label>
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  setProofFile(e.target.files[0]);
                }
              }}
              className="text-xs text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-amber-500/20 file:text-amber-400 hover:file:bg-amber-500/30"
            />
          </div>

          {/* Language Selection (§19.10) */}
          <div className="space-y-2">
            <Label className="text-sm font-bold text-white">WhatsApp Message Language</Label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                <input
                  type="radio"
                  name="lang"
                  checked={preferredLanguage === 'en'}
                  onChange={() => setPreferredLanguage('en')}
                  className="text-amber-500 focus:ring-amber-500"
                />
                English
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                <input
                  type="radio"
                  name="lang"
                  checked={preferredLanguage === 'ta'}
                  onChange={() => setPreferredLanguage('ta')}
                  className="text-amber-500 focus:ring-amber-500"
                />
                தமிழ் (Tamil)
              </label>
            </div>
          </div>

          {/* Summary Box */}
          <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl space-y-1.5 text-sm">
            <div className="flex justify-between text-slate-300">
              <span>Band:</span>
              <span className="font-bold text-white">{selectedBand?.label}</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Type:</span>
              <span className="font-bold text-white">
                {ticketType === 'digital' ? 'Digital QR' : `Physical Serial (${physicalSerial})`}
              </span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Amount:</span>
              <span className="font-bold text-[#E8913A]">₹{paymentAmount.toLocaleString('en-IN')}</span>
            </div>
          </div>

          <div className="flex justify-between pt-4">
            <Button
              variant="outline"
              size="lg"
              className="h-14 px-6 bg-[#1A2839] border-slate-800 text-white text-base rounded-xl"
              onClick={() => setStep(4)}
              disabled={isSubmitting}
            >
              <ArrowLeft className="mr-2 w-5 h-5" /> Back
            </Button>
            <Button
              size="lg"
              className="h-14 px-8 bg-[#E8913A] hover:bg-[#D97706] text-slate-950 font-black text-lg rounded-xl shadow-lg"
              disabled={isSubmitting || !paymentReferenceNo.trim()}
              onClick={handleSubmit}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 w-5 h-5 animate-spin" /> Issuing Pass...
                </>
              ) : (
                'Confirm & Issue Pass'
              )}
            </Button>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────── */}
      {/* STEP 6: SUCCESS & WHATSAPP DELIVERY (§6.7)     */}
      {/* ────────────────────────────────────────────── */}
      {step === 6 && successResult && (
        <div className="space-y-6 text-center py-4">
          <div className="w-20 h-20 mx-auto bg-emerald-500/15 border-2 border-emerald-500 rounded-full flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10 text-emerald-400" />
          </div>

          <div>
            <h2 className="text-3xl font-black text-white">Pass Issued Successfully!</h2>
            <p className="text-lg font-mono font-bold text-[#E8913A] mt-1">
              Code: {successResult.passCode}
            </p>
            <p className="text-slate-400 text-sm mt-0.5">
              {successResult.bandLabel}
            </p>
          </div>

          {/* 60-Second Undo Window Card (§19.2) */}
          {undoSecondsLeft > 0 ? (
            <div className="p-4 bg-amber-500/10 border-2 border-amber-500/40 rounded-2xl max-w-md mx-auto space-y-2">
              <div className="flex items-center justify-between text-amber-300 font-bold text-sm">
                <span>Mistake? 60-Second Undo Active:</span>
                <span className="font-mono text-base">{undoSecondsLeft}s left</span>
              </div>
              <Button
                variant="destructive"
                className="w-full h-11 bg-red-600 hover:bg-red-700 text-white font-bold text-sm rounded-xl"
                onClick={handleUndo}
                disabled={isUndoing}
              >
                {isUndoing ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RotateCcw className="w-4 h-4 mr-2" />
                )}
                Undo This Sale & Return Seat
              </Button>
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              The 60-second undo window has closed. Any corrections now require System Admin approval.
            </p>
          )}

          {/* Action Buttons: WhatsApp to Donor & Seller */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl mx-auto pt-2">
            <a
              href={getWhatsAppUrl(successResult.donorPhone, successResult.donorMessage)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 h-14 bg-[#25D366] hover:bg-[#20bd5a] text-slate-950 font-black text-base rounded-2xl shadow-lg transition-all"
            >
              <Send className="w-5 h-5" />
              Send to Donor WhatsApp
            </a>

            <a
              href={getWhatsAppUrl(successResult.sellerPhone, successResult.sellerMessage)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 h-14 bg-[#1A2839] hover:bg-[#223345] border-2 border-slate-700 text-white font-bold text-base rounded-2xl transition-all"
            >
              <Send className="w-5 h-5 text-amber-400" />
              Send Seller Credit
            </a>
          </div>

          <div className="pt-4">
            <Button
              variant="outline"
              size="lg"
              className="h-12 px-8 bg-slate-900 border-slate-700 text-white font-bold text-base rounded-xl"
              onClick={handleResetForNext}
            >
              Sell Another Pass
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
