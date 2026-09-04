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
  UserCheck, 
  ShieldCheck,
  Clock,
  RotateCcw,
  Sparkles
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
  donorName?: string;
  bandName?: string;
  passCode?: string;
  paymentStatus?: string;
  checkedInAt?: string;
  originalScanTime?: string;
  checkedInByName?: string;
  overridden?: boolean;
  message?: string;
  error?: string;
};

export function CheckinClient({ 
  isSuperAdmin, 
  isSystemAdmin, 
  hasDoorDuty 
}: { 
  isSuperAdmin: boolean; 
  isSystemAdmin: boolean; 
  hasDoorDuty: boolean; 
}) {
  const [passCodeInput, setPassCodeInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [isScannerPaused, setIsScannerPaused] = useState(false);

  const canOverride = isSuperAdmin || isSystemAdmin;

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(c => c - 1), 1000);
    } else if (countdown === 0 && result && result.success) {
      setResult(null);
      setIsScannerPaused(false);
    }
    return () => clearTimeout(timer);
  }, [countdown, result]);

  // Handle Scan / Verification
  const handleVerify = async (data: { token?: string; passCode?: string; action?: string }) => {
    setIsLoading(true);
    setIsScannerPaused(true);
    
    try {
      const res = await fetch('/api/checkin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      
      const resData = await res.json();
      
      if (res.ok && resData.success) {
        setResult({
          success: true,
          duplicate: false,
          donorName: resData.donorName,
          bandName: resData.bandName,
          passCode: resData.passCode,
          paymentStatus: resData.paymentStatus,
          checkedInAt: resData.checkedInAt,
          overridden: resData.overridden,
          message: resData.message,
        });
        toast.success(`✓ Admitted: ${resData.donorName} (${resData.bandName})`);
        setCountdown(5);
      } else if (resData.duplicate) {
        setResult({
          success: false,
          duplicate: true,
          donorName: resData.donorName,
          bandName: resData.bandName,
          passCode: resData.passCode,
          originalScanTime: resData.originalScanTime,
          checkedInByName: resData.checkedInByName,
          paymentStatus: resData.paymentStatus,
          error: resData.error,
        });
        toast.warning('Duplicate barcode scan detected!');
      } else {
        setResult({
          success: false,
          error: resData.error || 'Invalid or expired pass',
        });
        toast.error(resData.error || 'Check-in failed');
      }
    } catch (err: any) {
      setResult({ success: false, error: 'Connection failure verifying pass' });
      toast.error('Network connection error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
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
              <span>Camera Barcode Scanner</span>
            </div>
            <Badge variant="outline" className="bg-emerald-950/60 text-emerald-300 border-emerald-800 text-[10px] gap-1">
              <ShieldCheck className="w-3 h-3" />
              Gate Access Control
            </Badge>
          </div>
          <CardTitle className="text-base font-bold text-white mt-1">Live Door Access Scanner</CardTitle>
          <CardDescription className="text-xs text-slate-400">
            Scan donor WhatsApp E-Pass QR code or physical printed ticket.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-5">
          <div className="rounded-xl overflow-hidden bg-black aspect-square relative border border-[#24364A]">
            {!isScannerPaused ? (
              <QrScannerModal onScanSuccess={(token) => handleVerify({ token })} />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/95 text-white z-10 p-5 text-center overflow-y-auto">
                {result?.success ? (
                  /* 1. SUCCESSFUL CHECK-IN SCREEN */
                  <div className="space-y-4 animate-in fade-in zoom-in duration-200">
                    <CheckCircle2 className="h-14 w-14 text-emerald-400 mx-auto animate-bounce" />
                    <div>
                      <h3 className="text-2xl font-black text-white">Welcome!</h3>
                      <p className="text-lg font-bold text-amber-400 mt-1">{result.donorName}</p>
                    </div>

                    <div className="p-3.5 bg-[#0F2031] rounded-2xl border border-[#243D56] space-y-1.5">
                      <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 block">
                        Assigned Seating Band
                      </span>
                      <span className="text-base font-black text-white block">
                        {result.bandName}
                      </span>
                      <p className="text-[11px] text-slate-400">
                        Direct guest to the {result.bandName} general seating area.
                      </p>
                    </div>

                    <div className="flex gap-2 justify-center items-center">
                      <span className="px-2.5 py-1 bg-emerald-950 text-emerald-300 border border-emerald-800 rounded-lg text-xs font-mono font-bold">
                        {result.passCode}
                      </span>
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                        result.paymentStatus === 'paid' 
                          ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-700' 
                          : 'bg-amber-950/80 text-amber-300 border border-amber-700'
                      }`}>
                        {result.paymentStatus === 'paid' ? '✓ Paid' : 'Pending Payment'}
                      </span>
                    </div>

                    <div className="pt-2">
                      <Button
                        size="sm"
                        className="bg-[#E8913A] hover:bg-[#D97706] text-slate-950 font-bold text-xs rounded-xl w-full"
                        onClick={resetScanner}
                      >
                        Scan Next Pass ({countdown}s)
                      </Button>
                    </div>
                  </div>
                ) : result?.duplicate ? (
                  /* 2. DUPLICATE SCAN SCREEN */
                  <div className="space-y-4 animate-in fade-in zoom-in duration-200 max-w-xs">
                    <AlertCircle className="h-14 w-14 text-red-500 mx-auto" />
                    <div>
                      <h3 className="text-xl font-bold text-red-400">Already Admitted</h3>
                      <p className="text-base font-bold text-white mt-0.5">{result.donorName}</p>
                      <p className="text-xs text-slate-400">{result.bandName} • {result.passCode}</p>
                    </div>

                    <div className="p-3 bg-red-950/40 rounded-xl border border-red-800/60 text-xs text-red-200 text-left space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-red-400">
                        <Clock className="w-3.5 h-3.5" />
                        <span>First Admitted:</span>
                      </div>
                      <p className="text-[11px] font-mono">
                        {result.originalScanTime ? new Date(result.originalScanTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Earlier'}
                      </p>
                      {result.checkedInByName && (
                        <p className="text-[10px] text-slate-300">
                          Scanned by: <span className="font-semibold">{result.checkedInByName}</span>
                        </p>
                      )}
                    </div>

                    {/* Supervisor Override */}
                    {canOverride && (
                      <div className="pt-1">
                        <Button
                          variant="destructive"
                          size="sm"
                          className="w-full bg-red-700 hover:bg-red-800 text-white font-bold text-xs gap-1.5"
                          disabled={isLoading}
                          onClick={() => handleVerify({ passCode: result.passCode, action: 'override' })}
                        >
                          <ShieldCheck className="w-4 h-4" />
                          <span>Admin Override Admission</span>
                        </Button>
                      </div>
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full bg-[#1A2839] hover:bg-[#24364A] text-slate-300 text-xs border-[#2A3F55]"
                      onClick={resetScanner}
                    >
                      Dismiss & Scan Next
                    </Button>
                  </div>
                ) : (
                  /* 3. INVALID PASS SCREEN */
                  <div className="space-y-4 animate-in fade-in zoom-in duration-200 max-w-xs">
                    <XCircle className="h-14 w-14 text-red-400 mx-auto" />
                    <div>
                      <h3 className="text-xl font-bold text-white">Invalid Pass</h3>
                      <p className="text-xs text-red-400 mt-1">{result?.error || 'Pass code not found or cancelled'}</p>
                    </div>

                    <Button
                      size="sm"
                      className="w-full bg-[#E8913A] hover:bg-[#D97706] text-slate-950 font-bold text-xs rounded-xl"
                      onClick={resetScanner}
                    >
                      Scan Again
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 2. Manual Entry Fallback Card */}
      <div className="space-y-6">
        <Card className="bg-[#131F2E] border-[#223345] rounded-2xl shadow-xl">
          <CardHeader className="bg-[#0E1724] pb-3 border-b border-[#223345]">
            <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider">
              <KeyRound className="w-4 h-4" />
              <span>Manual Pass Lookup</span>
            </div>
            <CardTitle className="text-base font-bold text-white mt-1">Manual Pass Verification</CardTitle>
            <CardDescription className="text-xs text-slate-400">
              Type the 4-digit pass code (e.g., HL-1042) if the phone screen is broken or unscannable.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            <form onSubmit={handleManualSubmit} className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Enter Pass Code (e.g. HL-1042)"
                  value={passCodeInput}
                  onChange={(e) => setPassCodeInput(e.target.value)}
                  className="pl-10 h-11 bg-[#1A2839] border-[#2A3F55] text-white font-mono text-sm tracking-wider uppercase"
                />
              </div>
              <Button
                type="submit"
                disabled={isLoading || !passCodeInput.trim()}
                className="w-full h-11 bg-[#E8913A] hover:bg-[#D97706] text-slate-950 font-bold text-sm rounded-xl shadow-md"
              >
                {isLoading ? 'Verifying Pass...' : 'Verify Pass Code'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Gate Instructions Card */}
        <Card className="bg-[#131F2E] border-[#223345] rounded-2xl shadow-xl p-5 text-xs text-slate-300 space-y-3">
          <h4 className="font-bold text-white flex items-center gap-2 text-sm">
            <UserCheck className="w-4 h-4 text-emerald-400" />
            <span>Gate Seating Protocol</span>
          </h4>
          <ul className="space-y-2 text-slate-400 leading-relaxed list-disc list-inside">
            <li><strong className="text-slate-200">Band Seating:</strong> Donors choose their seats within their band area on arrival.</li>
            <li><strong className="text-slate-200">One Scan per Pass:</strong> Each QR barcode admits 1 guest. Duplicate scans are flagged with the original scanner&apos;s name.</li>
            <li><strong className="text-slate-200">Supervisor Override:</strong> Super Admins and System Admins can re-admit verified duplicate passes in exceptional cases.</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
