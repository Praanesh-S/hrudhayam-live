'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle2, QrCode, Search, XCircle, ScanLine, KeyRound } from 'lucide-react';
import { toast } from 'sonner';

const QrScannerModal = dynamic(() => import('@/components/scanner/QrScannerModal').then(mod => mod.QrScannerModal), {
  ssr: false,
  loading: () => <div className="h-64 w-full bg-[#1A2839] flex items-center justify-center rounded-xl animate-pulse"><QrCode className="h-8 w-8 text-slate-500" /></div>
});

type ScanResult = {
  success: boolean;
  duplicate?: boolean;
  guestName?: string;
  seatId?: string;
  section?: string;
  row?: string;
  seatNo?: string;
  originalScanTime?: string;
  error?: string;
};

export function CheckinClient({ isSuperAdmin, hasDoorDuty }: { isSuperAdmin: boolean, hasDoorDuty: boolean }) {
  const [passCode, setPassCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [isScannerPaused, setIsScannerPaused] = useState(false);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(c => c - 1), 1000);
    } else if (countdown === 0 && result) {
      setResult(null);
      setIsScannerPaused(false);
    }
    return () => clearTimeout(timer);
  }, [countdown, result]);

  const handleVerify = async (data: { token?: string, passCode?: string }) => {
    setIsLoading(true);
    setIsScannerPaused(true);
    
    try {
      const res = await fetch('/api/checkin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      
      const json = await res.json();
      setResult(json);
      setCountdown(5);
      
      if (!json.success && !json.duplicate) {
        toast.error(json.error || 'Check-in failed');
      }
    } catch (err) {
      console.error(err);
      toast.error('An error occurred during verification');
      setResult({ success: false, error: 'Network error' });
      setCountdown(3);
    } finally {
      setIsLoading(false);
      setPassCode('');
    }
  };

  const onManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!passCode.trim()) return;
    handleVerify({ passCode: passCode.trim() });
  };

  return (
    <div className="grid gap-6 md:grid-cols-2 max-w-5xl mx-auto pb-12">
      {/* 1. Camera QR Scanner Card */}
      <Card className="bg-[#131F2E] border-[#223345] rounded-2xl shadow-xl overflow-hidden">
        <CardHeader className="bg-[#0E1724] pb-3 border-b border-[#223345]">
          <div className="flex items-center gap-2 text-sky-400 text-xs font-bold uppercase tracking-wider">
            <ScanLine className="w-4 h-4" />
            <span>Camera Scanner</span>
          </div>
          <CardTitle className="text-base font-bold text-white mt-1">Live Door QR Scanner</CardTitle>
          <CardDescription className="text-xs text-slate-400">
            Align attendee's mobile screen or printed ticket pass with the camera frame.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-5">
          <div className="rounded-xl overflow-hidden bg-black aspect-square relative border border-[#24364A]">
            {!isScannerPaused ? (
              <QrScannerModal onScanSuccess={(token) => handleVerify({ token })} />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 text-white z-10 p-6 text-center">
                {result?.success ? (
                  <>
                    <CheckCircle2 className="h-16 w-16 text-emerald-400 mb-3 animate-bounce" />
                    <h3 className="text-2xl font-extrabold text-white">Welcome!</h3>
                    <p className="text-lg font-bold text-[#E8913A] mt-1">{result.guestName}</p>
                    <div className="flex gap-2 mt-3 flex-wrap justify-center">
                      <span className="px-2.5 py-1 bg-emerald-950 text-emerald-300 border border-emerald-800 rounded-lg text-xs font-semibold">{result.section}</span>
                      <span className="px-2.5 py-1 bg-emerald-950 text-emerald-300 border border-emerald-800 rounded-lg text-xs font-semibold">Row {result.row}</span>
                      <span className="px-2.5 py-1 bg-emerald-950 text-emerald-300 border border-emerald-800 rounded-lg text-xs font-semibold">Seat {result.seatNo}</span>
                    </div>
                  </>
                ) : result?.duplicate ? (
                  <>
                    <AlertCircle className="h-16 w-16 text-amber-400 mb-3" />
                    <h3 className="text-2xl font-extrabold text-amber-400">Already Checked In</h3>
                    <p className="text-lg font-bold text-white mt-1">{result.guestName}</p>
                    <p className="text-xs text-slate-400 mt-2">
                      Scanned at: {result.originalScanTime ? new Date(result.originalScanTime).toLocaleTimeString() : 'Earlier'}
                    </p>
                  </>
                ) : (
                  <>
                    <XCircle className="h-16 w-16 text-red-400 mb-3" />
                    <h3 className="text-2xl font-extrabold text-red-400">Invalid Pass</h3>
                    <p className="text-xs text-slate-300 mt-2">{result?.error || 'Pass token could not be verified.'}</p>
                  </>
                )}
                
                <div className="mt-6">
                  <Button 
                    className="bg-[#E8913A] hover:bg-[#D97706] text-slate-950 font-bold text-xs" 
                    onClick={() => {
                      setResult(null);
                      setCountdown(0);
                      setIsScannerPaused(false);
                    }}
                  >
                    Ready for Next Guest ({countdown}s)
                  </Button>
                </div>
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
            Type the pass code (e.g. HL-1234 or HRU1234) printed on the pass.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-5">
          <form onSubmit={onManualSubmit} className="flex gap-2">
            <Input
              placeholder="e.g. HL-1024"
              value={passCode}
              onChange={(e) => setPassCode(e.target.value.toUpperCase())}
              maxLength={12}
              className="font-mono text-base uppercase bg-[#1A2839] border-[#2A3F55] text-white h-11"
              disabled={isLoading || isScannerPaused}
            />
            <Button type="submit" className="bg-[#E8913A] hover:bg-[#D97706] text-slate-950 font-bold h-11 px-5 text-xs shrink-0" disabled={!passCode || isLoading || isScannerPaused}>
              <Search className="h-4 w-4 mr-1.5" />
              Verify Pass
            </Button>
          </form>

          {result && (
            <div className={`mt-5 p-4 rounded-xl border ${
              result.success ? 'bg-emerald-950/60 border-emerald-800 text-emerald-200' : 
              result.duplicate ? 'bg-amber-950/60 border-amber-800 text-amber-200' : 
              'bg-red-950/60 border-red-800 text-red-200'
            }`}>
              {result.success ? (
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-6 w-6 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-base text-emerald-300">Admission Verified</h4>
                    <p className="mt-0.5 text-sm font-semibold text-white">{result.guestName}</p>
                    <div className="mt-2 flex gap-1.5 flex-wrap">
                      <span className="px-2 py-0.5 bg-emerald-900/80 rounded text-xs font-semibold">{result.section}</span>
                      <span className="px-2 py-0.5 bg-emerald-900/80 rounded text-xs font-semibold">Row {result.row}</span>
                      <span className="px-2 py-0.5 bg-emerald-900/80 rounded text-xs font-semibold">Seat {result.seatNo}</span>
                    </div>
                  </div>
                </div>
              ) : result.duplicate ? (
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-6 w-6 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-base text-amber-300">Already Used</h4>
                    <p className="mt-0.5 text-sm font-semibold text-white">{result.guestName}</p>
                    <p className="mt-1 text-xs text-amber-400">
                      Scanned at {result.originalScanTime ? new Date(result.originalScanTime).toLocaleTimeString() : 'earlier time'}.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <XCircle className="h-6 w-6 text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-base text-red-300">Invalid Pass</h4>
                    <p className="mt-1 text-xs text-red-400">{result.error}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
