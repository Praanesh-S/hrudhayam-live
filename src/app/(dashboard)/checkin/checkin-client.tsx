'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { AuthUser } from '@/lib/auth/session';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
  CheckCircle2, 
  XCircle, 
  ScanLine, 
  Search, 
  Loader2, 
  RotateCcw, 
  ShieldAlert,
  QrCode,
  Ticket
} from 'lucide-react';

const QrScannerModal = dynamic(
  () => import('@/components/scanner/QrScannerModal').then((mod) => mod.QrScannerModal),
  {
    ssr: false,
    loading: () => (
      <div className="h-64 w-full bg-[#1A2839] flex items-center justify-center rounded-2xl animate-pulse">
        <QrCode className="h-8 w-8 text-slate-500" />
      </div>
    ),
  }
);

type ScanResult = {
  success: boolean;
  duplicate?: boolean;
  donorName?: string;
  bandLabel?: string;
  passCode?: string;
  ticketType?: string;
  physicalSerial?: string | null;
  usedAt?: string;
  isPaid?: boolean;
  overridden?: boolean;
  message?: string;
  error?: string;
};

export function CheckinClient({
  currentUser,
  isSuperOrSystemAdmin,
}: {
  currentUser: AuthUser;
  isSuperOrSystemAdmin: boolean;
}) {
  const [activeTab, setActiveTab] = useState<'camera' | 'manual'>('camera');
  const [manualInput, setManualInput] = useState('');
  const [searchMode, setSearchMode] = useState<'pass_code' | 'serial'>('pass_code');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);

  const handleVerify = async (data: { token?: string; passCode?: string; physicalSerial?: string; action?: string }) => {
    setIsLoading(true);

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
          bandLabel: resData.bandLabel,
          passCode: resData.passCode,
          ticketType: resData.ticketType,
          physicalSerial: resData.physicalSerial,
          isPaid: resData.isPaid,
          usedAt: resData.usedAt,
          overridden: resData.overridden,
        });
      } else {
        setResult({
          success: false,
          duplicate: !!resData.duplicate,
          donorName: resData.donorName,
          bandLabel: resData.bandLabel,
          passCode: resData.passCode,
          usedAt: resData.usedAt,
          error: resData.error || 'Gate check-in failed.',
        });
      }
    } catch (err: any) {
      setResult({
        success: false,
        error: 'Offline / Network Error: Cannot verify pass without internet connection. Refer to the printed gate manifest.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;

    if (searchMode === 'serial') {
      handleVerify({ physicalSerial: manualInput.trim() });
    } else {
      handleVerify({ passCode: manualInput.trim() });
    }
  };

  const handleOverride = () => {
    if (!result?.passCode) return;
    handleVerify({ passCode: result.passCode, action: 'override' });
  };

  const handleReset = () => {
    setResult(null);
    setManualInput('');
  };

  return (
    <div className="space-y-6">
      {/* Result Display Screen */}
      {result ? (
        <div className="space-y-6">
          {result.success ? (
            /* GREEN SCREEN: ADMIT */
            <div className="p-8 rounded-3xl bg-emerald-950/80 border-4 border-emerald-500 text-center space-y-4 shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="w-24 h-24 mx-auto rounded-full bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-950/50">
                <CheckCircle2 className="w-16 h-16 text-slate-950" />
              </div>

              <div>
                <span className="inline-block px-4 py-1 rounded-full bg-emerald-500/30 text-emerald-300 font-bold text-sm uppercase tracking-wider mb-2">
                  Gate Admission Confirmed
                </span>
                <h2 className="text-4xl sm:text-5xl font-black text-white tracking-tight">
                  ADMIT GUEST
                </h2>
              </div>

              <div className="p-5 bg-slate-900/80 border border-emerald-500/30 rounded-2xl text-left space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-400">Donor Name:</span>
                  <span className="text-xl font-bold text-white">{result.donorName}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-400">Price Band:</span>
                  <span className="text-xl font-black text-amber-400">{result.bandLabel}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-400">Pass Code:</span>
                  <span className="font-mono font-bold text-white">{result.passCode}</span>
                </div>
                {result.physicalSerial && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-400">Ticket Serial:</span>
                    <span className="font-mono font-bold text-emerald-400">{result.physicalSerial}</span>
                  </div>
                )}
                {result.overridden && (
                  <div className="p-2 bg-amber-500/20 rounded text-xs text-amber-300 font-semibold text-center">
                    Admitted via Supervisor Override
                  </div>
                )}
              </div>

              <Button
                size="lg"
                onClick={handleReset}
                className="w-full h-14 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xl rounded-2xl shadow-lg"
              >
                Scan Next Guest
              </Button>
            </div>
          ) : (
            /* RED SCREEN: REJECT */
            <div className="p-8 rounded-3xl bg-red-950/80 border-4 border-red-600 text-center space-y-4 shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="w-24 h-24 mx-auto rounded-full bg-red-600 flex items-center justify-center shadow-lg shadow-red-950/50">
                <XCircle className="w-16 h-16 text-white" />
              </div>

              <div>
                <span className="inline-block px-4 py-1 rounded-full bg-red-500/30 text-red-300 font-bold text-sm uppercase tracking-wider mb-2">
                  Entry Denied
                </span>
                <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                  DO NOT ADMIT
                </h2>
              </div>

              <div className="p-5 bg-slate-900/90 border border-red-500/30 rounded-2xl text-left space-y-2">
                <p className="text-red-200 font-bold text-base leading-relaxed">
                  {result.error}
                </p>
                {result.donorName && (
                  <div className="text-xs text-slate-400 pt-2 border-t border-slate-800">
                    Donor on File: <span className="text-white font-semibold">{result.donorName}</span> ({result.bandLabel})
                  </div>
                )}
              </div>

              <div className="space-y-3 pt-2">
                {isSuperOrSystemAdmin && result.duplicate && (
                  <Button
                    variant="outline"
                    onClick={handleOverride}
                    className="w-full h-12 bg-amber-500/20 border-amber-500/40 text-amber-300 font-bold text-base rounded-xl"
                  >
                    <ShieldAlert className="w-5 h-5 mr-2" /> Supervisor Override Admission
                  </Button>
                )}

                <Button
                  size="lg"
                  onClick={handleReset}
                  className="w-full h-14 bg-red-600 hover:bg-red-700 text-white font-black text-xl rounded-2xl shadow-lg"
                >
                  <RotateCcw className="w-5 h-5 mr-2" /> Try Again / Next
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* SCANNING INTERFACE */
        <Card className="bg-[#131F2E] border border-slate-800 rounded-3xl overflow-hidden">
          <div className="grid grid-cols-2 p-1.5 bg-slate-900/80 border-b border-slate-800 gap-1.5">
            <button
              type="button"
              onClick={() => setActiveTab('camera')}
              className={`flex items-center justify-center gap-2 py-3 px-2 rounded-2xl font-bold text-xs sm:text-base transition-all ${
                activeTab === 'camera' ? 'bg-[#E8913A] text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              <ScanLine className="w-4.5 h-4.5 shrink-0" /> <span className="truncate">Scan QR (Camera)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('manual')}
              className={`flex items-center justify-center gap-2 py-3 px-2 rounded-2xl font-bold text-xs sm:text-base transition-all ${
                activeTab === 'manual' ? 'bg-[#E8913A] text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Search className="w-4.5 h-4.5 shrink-0" /> <span className="truncate">Manual Code / Serial</span>
            </button>
          </div>

          <CardContent className="p-6">
            {activeTab === 'camera' ? (
              <div className="space-y-4">
                <div className="rounded-2xl overflow-hidden border-2 border-slate-700 aspect-square sm:aspect-video flex items-center justify-center bg-black relative">
                  {isLoading ? (
                    <div className="flex flex-col items-center gap-2 text-white">
                      <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
                      <span className="text-sm font-semibold">Verifying pass...</span>
                    </div>
                  ) : (
                    <QrScannerModal
                      onScanSuccess={(scannedText) => {
                        // Check if it's a signed JWT token or URL or raw code
                        if (scannedText.includes('/pass/')) {
                          const code = scannedText.split('/pass/').pop()?.split('?')[0];
                          if (code) handleVerify({ passCode: code });
                        } else if (scannedText.startsWith('ey')) {
                          handleVerify({ token: scannedText });
                        } else {
                          handleVerify({ passCode: scannedText });
                        }
                      }}
                    />
                  )}
                </div>
                <p className="text-xs text-center text-slate-400">
                  Point phone camera at the QR code on the donor&apos;s WhatsApp screen or printed slip.
                </p>
              </div>
            ) : (
              <form onSubmit={handleManualSubmit} className="space-y-5">
                <div className="flex gap-1.5 p-1 bg-slate-900 rounded-xl border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setSearchMode('pass_code')}
                    className={`flex-1 py-2 px-2 rounded-lg text-xs font-bold transition-all ${
                      searchMode === 'pass_code' ? 'bg-[#E8913A] text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Digital Pass Code (HL-XXXX)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSearchMode('serial')}
                    className={`flex-1 py-2 px-2 rounded-lg text-xs font-bold transition-all ${
                      searchMode === 'serial' ? 'bg-[#E8913A] text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Physical Ticket Serial
                  </button>
                </div>

                <div className="space-y-2">
                  <Input
                    placeholder={searchMode === 'serial' ? 'e.g. T-0145 or 42' : 'e.g. HL-9459 or HRU0016'}
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    className="h-14 bg-[#1A2839] border-slate-700 text-white text-xl font-mono text-center rounded-2xl uppercase"
                    autoFocus
                    required
                  />
                </div>

                <Button
                  type="submit"
                  disabled={isLoading || !manualInput.trim()}
                  className="w-full h-14 bg-[#E8913A] hover:bg-[#D97706] text-slate-950 font-black text-lg rounded-2xl shadow-lg"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Verifying...
                    </>
                  ) : (
                    'Verify & Check In'
                  )}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
