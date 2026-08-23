'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  AlertCircle, 
  CheckCircle2, 
  QrCode, 
  Search, 
  XCircle, 
  ScanLine, 
  KeyRound, 
  Users, 
  UserCheck, 
  Plus, 
  Minus, 
  ShieldCheck,
  Clock
} from 'lucide-react';
import { toast } from 'sonner';

const QrScannerModal = dynamic(() => import('@/components/scanner/QrScannerModal').then(mod => mod.QrScannerModal), {
  ssr: false,
  loading: () => (
    <div className="h-64 w-full bg-[#1A2839] flex items-center justify-center rounded-xl animate-pulse">
      <QrCode className="h-8 w-8 text-slate-500" />
    </div>
  )
});

type ScanResult = {
  success: boolean;
  duplicate?: boolean;
  allAdmitted?: boolean;
  requiresBatchSelection?: boolean;
  isGroup?: boolean;
  admittedNow?: number;
  totalSeats?: number;
  checkedInCount?: number;
  remainingCount?: number;
  guestName?: string;
  passCode?: string;
  seatId?: string;
  section?: string;
  row?: string;
  rows?: string[];
  seatNo?: string;
  seatNumbers?: string;
  originalScanTime?: string;
  previouslyAdmittedAt?: string | null;
  seatsList?: Array<{
    id: string;
    row_label: string;
    seat_no: number;
    checked_in: boolean;
    checked_in_at: string | null;
  }>;
  error?: string;
};

export function CheckinClient({ isSuperAdmin, hasDoorDuty }: { isSuperAdmin: boolean, hasDoorDuty: boolean }) {
  const [passCodeInput, setPassCodeInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [isScannerPaused, setIsScannerPaused] = useState(false);

  // Group batch selection state
  const [batchCount, setBatchCount] = useState<number>(1);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(c => c - 1), 1000);
    } else if (countdown === 0 && result && !result.requiresBatchSelection) {
      setResult(null);
      setIsScannerPaused(false);
    }
    return () => clearTimeout(timer);
  }, [countdown, result]);

  // Initial Scan / Token Verification
  const handleVerify = async (data: { token?: string, passCode?: string }) => {
    setIsLoading(true);
    setIsScannerPaused(true);
    
    try {
      const res = await fetch('/api/checkin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      
      const json: ScanResult = await res.json();
      setResult(json);

      if (json.requiresBatchSelection && json.remainingCount) {
        // Group pass waiting for batch count selection - default to remaining count
        setBatchCount(json.remainingCount);
      } else if (json.success) {
        setCountdown(5);
        toast.success(`Check-in verified: ${json.guestName}`);
      } else {
        setCountdown(6);
        if (!json.duplicate) {
          toast.error(json.error || 'Check-in verification failed');
        }
      }
    } catch (err) {
      console.error(err);
      toast.error('An error occurred during verification');
      setResult({ success: false, error: 'Network communication error' });
      setCountdown(4);
    } finally {
      setIsLoading(false);
      setPassCodeInput('');
    }
  };

  // Confirm Batch Admission for Group Pass
  const handleConfirmBatchAdmission = async (countToAdmit: number) => {
    if (!result?.passCode) return;
    setIsLoading(true);

    try {
      const res = await fetch('/api/checkin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          passCode: result.passCode,
          action: 'admit',
          count: countToAdmit
        }),
      });

      const json: ScanResult = await res.json();
      setResult(json);
      setCountdown(5);

      if (json.success) {
        toast.success(`Admitted ${countToAdmit} guest(s) for ${json.guestName}!`);
      } else {
        toast.error(json.error || 'Batch admission failed');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to process batch admission');
      setResult({ success: false, error: 'Failed to process check-in' });
      setCountdown(4);
    } finally {
      setIsLoading(false);
    }
  };

  const onManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!passCodeInput.trim()) return;
    handleVerify({ passCode: passCodeInput.trim().toUpperCase() });
  };

  const resetScanner = () => {
    setResult(null);
    setCountdown(0);
    setIsScannerPaused(false);
  };

  return (
    <div className="grid gap-6 md:grid-cols-2 max-w-5xl mx-auto pb-12">
      {/* 1. Camera QR Scanner Card */}
      <Card className="bg-[#131F2E] border-[#223345] rounded-2xl shadow-xl overflow-hidden">
        <CardHeader className="bg-[#0E1724] pb-3 border-b border-[#223345]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sky-400 text-xs font-bold uppercase tracking-wider">
              <ScanLine className="w-4 h-4" />
              <span>Camera QR Scanner</span>
            </div>
            <Badge variant="outline" className="bg-emerald-950/60 text-emerald-300 border-emerald-800 text-[10px] gap-1">
              <ShieldCheck className="w-3 h-3" />
              Anti-Fraud Verified
            </Badge>
          </div>
          <CardTitle className="text-base font-bold text-white mt-1">Live Door Access Scanner</CardTitle>
          <CardDescription className="text-xs text-slate-400">
            Supports single tickets and multi-guest partial batch arrivals.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-5">
          <div className="rounded-xl overflow-hidden bg-black aspect-square relative border border-[#24364A]">
            {!isScannerPaused ? (
              <QrScannerModal onScanSuccess={(token) => handleVerify({ token })} />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/95 text-white z-10 p-5 text-center overflow-y-auto">
                
                {/* 1. GROUP BATCH SELECTION SCREEN */}
                {result?.requiresBatchSelection ? (
                  <div className="space-y-4 w-full max-w-xs animate-in fade-in zoom-in duration-200">
                    <div className="flex items-center justify-center gap-2 text-amber-400">
                      <Users className="h-8 w-8" />
                    </div>

                    <div>
                      <Badge className="bg-purple-950/80 text-purple-300 border border-purple-700 text-[11px] font-mono">
                        GROUP PASS: {result.passCode}
                      </Badge>
                      <h3 className="text-lg font-bold text-white mt-1.5">{result.guestName}</h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {result.section} • Row {result.rows?.join(', ')} • Seats {result.seatNumbers}
                      </p>
                    </div>

                    {/* Progress Bar of admissions */}
                    <div className="p-3 bg-[#0F1A26] rounded-xl border border-[#24364A] text-xs space-y-2">
                      <div className="flex justify-between text-[11px] font-semibold">
                        <span className="text-emerald-400">{result.checkedInCount} Admitted</span>
                        <span className="text-amber-400 font-bold">{result.remainingCount} Remaining</span>
                      </div>
                      <div className="w-full bg-[#1A2839] rounded-full h-2 overflow-hidden">
                        <div 
                          className="bg-emerald-500 h-2 rounded-full transition-all"
                          style={{ width: `${((result.checkedInCount || 0) / (result.totalSeats || 1)) * 100}%` }}
                        />
                      </div>
                      {result.previouslyAdmittedAt && (
                        <p className="text-[10px] text-slate-400 flex items-center justify-center gap-1">
                          <Clock className="w-3 h-3 text-slate-500" />
                          First entry at {new Date(result.previouslyAdmittedAt).toLocaleTimeString()}
                        </p>
                      )}
                    </div>

                    {/* Step Batch Selector */}
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-slate-300">How many guests entering now?</p>
                      <div className="flex items-center justify-center gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-10 w-10 rounded-xl bg-[#1A2839] border-[#2A3F55] text-white"
                          disabled={batchCount <= 1 || isLoading}
                          onClick={() => setBatchCount(c => Math.max(1, c - 1))}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <div className="w-16 text-center font-mono font-black text-2xl text-amber-400">
                          {batchCount}
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-10 w-10 rounded-xl bg-[#1A2839] border-[#2A3F55] text-white"
                          disabled={batchCount >= (result.remainingCount || 1) || isLoading}
                          onClick={() => setBatchCount(c => Math.min(result.remainingCount || 1, c + 1))}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Quick & Confirm Buttons */}
                    <div className="space-y-2 pt-1">
                      <Button
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-10 shadow-lg shadow-emerald-950/40 gap-1.5"
                        disabled={isLoading}
                        onClick={() => handleConfirmBatchAdmission(batchCount)}
                      >
                        <UserCheck className="w-4 h-4" />
                        <span>Confirm Entry ({batchCount} of {result.remainingCount} Guests)</span>
                      </Button>

                      {result.remainingCount && result.remainingCount > 1 && batchCount !== result.remainingCount && (
                        <Button
                          variant="outline"
                          className="w-full bg-[#1A2839] hover:bg-[#24364A] text-slate-300 text-[11px] h-8 border-[#2A3F55]"
                          disabled={isLoading}
                          onClick={() => handleConfirmBatchAdmission(result.remainingCount!)}
                        >
                          Admit All {result.remainingCount} Remaining
                        </Button>
                      )}

                      <Button
                        variant="ghost"
                        className="text-slate-400 hover:text-white text-[11px] h-7"
                        onClick={resetScanner}
                      >
                        Cancel Scan
                      </Button>
                    </div>
                  </div>
                ) : result?.success ? (
                  /* 2. SUCCESSFUL CHECK-IN SCREEN */
                  <div className="space-y-3 animate-in fade-in zoom-in duration-200">
                    <CheckCircle2 className="h-14 w-14 text-emerald-400 mx-auto animate-bounce" />
                    <div>
                      <h3 className="text-2xl font-black text-white">Welcome!</h3>
                      <p className="text-base font-bold text-[#E8913A] mt-1">{result.guestName}</p>
                    </div>

                    {result.isGroup && (
                      <Badge className="bg-purple-950/80 text-purple-300 border border-purple-700 text-xs">
                        Admitted {result.admittedNow} Guest(s) • Total: {result.checkedInCount} / {result.totalSeats}
                      </Badge>
                    )}

                    <div className="flex gap-1.5 justify-center flex-wrap">
                      <span className="px-2.5 py-1 bg-emerald-950 text-emerald-300 border border-emerald-800 rounded-lg text-xs font-semibold">
                        {result.section}
                      </span>
                      <span className="px-2.5 py-1 bg-emerald-950 text-emerald-300 border border-emerald-800 rounded-lg text-xs font-semibold">
                        Row {result.row}
                      </span>
                      <span className="px-2.5 py-1 bg-emerald-950 text-emerald-300 border border-emerald-800 rounded-lg text-xs font-semibold">
                        Seat {result.seatNo}
                      </span>
                    </div>

                    {result.remainingCount && result.remainingCount > 0 ? (
                      <p className="text-xs text-amber-300 font-medium">
                        ℹ️ {result.remainingCount} remaining guests can scan this QR later.
                      </p>
                    ) : (
                      <p className="text-xs text-emerald-300 font-medium">
                        ✓ All passes on this ticket admitted.
                      </p>
                    )}

                    <div className="pt-2">
                      <Button 
                        className="bg-[#E8913A] hover:bg-[#D97706] text-slate-950 font-bold text-xs" 
                        onClick={resetScanner}
                      >
                        Ready for Next Guest ({countdown}s)
                      </Button>
                    </div>
                  </div>
                ) : result?.duplicate ? (
                  /* 3. DUPLICATE / FULLY ADMITTED WARNING */
                  <div className="space-y-3 animate-in fade-in zoom-in duration-200">
                    <AlertCircle className="h-14 w-14 text-amber-400 mx-auto" />
                    <div>
                      <h3 className="text-xl font-extrabold text-amber-400">All Passes Checked In</h3>
                      <p className="text-base font-bold text-white mt-1">{result.guestName}</p>
                    </div>

                    <div className="p-3 bg-amber-950/40 border border-amber-800/60 rounded-xl text-xs text-amber-200 space-y-1">
                      <p>
                        <strong>{result.checkedInCount} of {result.totalSeats}</strong> guests already admitted.
                      </p>
                      <p className="text-[11px] text-slate-400">
                        First entry: {result.originalScanTime ? new Date(result.originalScanTime).toLocaleTimeString() : 'Earlier'}
                      </p>
                    </div>

                    <div className="pt-2">
                      <Button 
                        className="bg-[#E8913A] hover:bg-[#D97706] text-slate-950 font-bold text-xs" 
                        onClick={resetScanner}
                      >
                        Scan Next Pass ({countdown}s)
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* 4. INVALID / REVOKED PASS SCREEN */
                  <div className="space-y-3 animate-in fade-in zoom-in duration-200">
                    <XCircle className="h-14 w-14 text-red-400 mx-auto" />
                    <h3 className="text-xl font-extrabold text-red-400">Entry Rejected</h3>
                    <p className="text-xs text-slate-200 max-w-xs leading-relaxed">{result?.error || 'Invalid or revoked pass.'}</p>
                    <div className="pt-3">
                      <Button 
                        className="bg-red-700 hover:bg-red-800 text-white font-bold text-xs" 
                        onClick={resetScanner}
                      >
                        Reset Scanner ({countdown}s)
                      </Button>
                    </div>
                  </div>
                )}
                
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 2. Manual Entry Fallback Card */}
      <Card className="bg-[#131F2E] border-[#223345] rounded-2xl shadow-xl overflow-hidden">
        <CardHeader className="bg-[#0E1724] pb-3 border-b border-[#223345]">
          <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider">
            <KeyRound className="w-4 h-4" />
            <span>Manual Entry Fallback</span>
          </div>
          <CardTitle className="text-base font-bold text-white mt-1">Verify Pass Code</CardTitle>
          <CardDescription className="text-xs text-slate-400">
            Type the pass code (e.g. HL-1024 or GF-A01) printed on the ticket.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-5 space-y-4">
          <form onSubmit={onManualSubmit} className="flex gap-2">
            <Input
              placeholder="e.g. HL-1024"
              value={passCodeInput}
              onChange={(e) => setPassCodeInput(e.target.value.toUpperCase())}
              maxLength={15}
              className="font-mono text-base uppercase bg-[#1A2839] border-[#2A3F55] text-white h-11"
              disabled={isLoading || isScannerPaused}
            />
            <Button 
              type="submit" 
              className="bg-[#E8913A] hover:bg-[#D97706] text-slate-950 font-bold h-11 px-5 text-xs shrink-0" 
              disabled={!passCodeInput || isLoading || isScannerPaused}
            >
              <Search className="h-4 w-4 mr-1.5" />
              Verify Pass
            </Button>
          </form>

          {/* Guidelines & Safeguards */}
          <div className="p-4 bg-[#0E1724] rounded-xl border border-[#223345] space-y-2 text-xs text-slate-400">
            <p className="font-bold text-slate-200 uppercase tracking-wider text-[10px]">
              🔒 Anti-Malpractice & Batch Rules
            </p>
            <ul className="space-y-1.5 list-disc pl-4 text-[11px] leading-relaxed">
              <li>
                <strong>Single Tickets (1 seat):</strong> 1 successful scan marks entry. Any subsequent attempt is blocked as duplicate.
              </li>
              <li>
                <strong>Group Tickets (X seats):</strong> When a group arrives in separate batches, select how many are entering. The QR code stays active for the remaining guests until all X seats are admitted.
              </li>
              <li>
                <strong>Revoked Tickets:</strong> Revoked passes are instantly rejected with a red security notice.
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
