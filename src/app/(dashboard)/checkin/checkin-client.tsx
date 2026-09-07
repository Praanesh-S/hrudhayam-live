'use client';

import { useState } from 'react';
import { AuthUser } from '@/lib/auth/session';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
  CheckCircle2, 
  XCircle, 
  Search, 
  Loader2, 
  RotateCcw, 
  ShieldAlert,
  Ticket,
  AlertTriangle
} from 'lucide-react';

type CheckinResult = {
  success: boolean;
  duplicate?: boolean;
  donorName?: string;
  bandLabel?: string;
  rowLabel?: string;
  serialNo?: string;
  usedAt?: string;
  isPaid?: boolean;
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
  const [serialInput, setSerialInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<CheckinResult | null>(null);
  const [recentAdmissions, setRecentAdmissions] = useState<Array<{ serial: string; name: string; band: string; time: string }>>([]);

  const handleCheckin = async (e?: React.FormEvent, override = false) => {
    if (e) e.preventDefault();
    const query = serialInput.trim();
    if (!query) return;

    setIsLoading(true);

    try {
      const res = await fetch('/api/checkin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serialNo: query,
          action: override ? 'override' : 'checkin',
        }),
      });

      const resData = await res.json();

      if (res.ok && resData.success) {
        setResult({
          success: true,
          duplicate: false,
          donorName: resData.donorName,
          bandLabel: resData.bandLabel,
          rowLabel: resData.rowLabel,
          serialNo: resData.serialNo,
          isPaid: resData.isPaid,
          usedAt: resData.usedAt,
        });

        // Add to local recent list
        setRecentAdmissions((prev) => [
          {
            serial: resData.serialNo,
            name: resData.donorName,
            band: resData.bandLabel,
            time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
          },
          ...prev.slice(0, 9),
        ]);

        setSerialInput('');
      } else {
        setResult({
          success: false,
          duplicate: !!resData.duplicate,
          donorName: resData.donorName,
          bandLabel: resData.bandLabel,
          rowLabel: resData.rowLabel,
          serialNo: resData.serialNo || query,
          usedAt: resData.usedAt,
          error: resData.error || 'Gate admission check failed.',
        });
      }
    } catch (err: any) {
      setResult({
        success: false,
        error: 'Network connection error. Check WiFi or verify physical serial on paper manifest.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Search / Serial Entry Card */}
      <Card className="bg-[#131F2E] border-2 border-amber-500/40 rounded-2xl shadow-xl overflow-hidden">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Ticket className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-bold text-white">Physical Serial Gate Admission</h2>
          </div>
          <p className="text-xs text-slate-400">
            Type the physical pass serial number (e.g. <span className="font-mono text-amber-300">HL-A-0421</span> or numeric serial). Passes can only be entered once.
          </p>

          <form onSubmit={(e) => handleCheckin(e)} className="space-y-3">
            <div className="relative">
              <Input
                type="text"
                autoFocus
                placeholder="Enter Physical Serial No..."
                value={serialInput}
                onChange={(e) => setSerialInput(e.target.value)}
                className="h-14 pl-4 pr-12 bg-[#1A2839] border-2 border-slate-700 text-white font-mono text-lg font-bold rounded-xl focus:border-amber-400 focus:outline-hidden"
              />
              {serialInput && (
                <button
                  type="button"
                  onClick={() => setSerialInput('')}
                  className="absolute right-3 top-4 text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              )}
            </div>

            <Button
              type="submit"
              disabled={isLoading || !serialInput.trim()}
              className="w-full h-12 bg-amber-500 hover:bg-[#D97706] text-slate-950 font-black text-base rounded-xl transition-all shadow-md"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
              ) : (
                <Search className="w-5 h-5 mr-2" />
              )}
              Admit & Record Entry
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Result Display */}
      {result && (
        <Card
          className={`border-2 rounded-2xl overflow-hidden shadow-2xl transition-all ${
            result.success
              ? 'bg-emerald-950/60 border-emerald-500'
              : result.duplicate
              ? 'bg-rose-950/80 border-rose-500 animate-shake'
              : 'bg-red-950/70 border-red-500'
          }`}
        >
          <CardContent className="p-6 space-y-4">
            {result.success ? (
              <div className="space-y-3 text-center sm:text-left">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-10 h-10 text-emerald-400 shrink-0" />
                  <div>
                    <span className="px-3 py-0.5 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                      ✓ Pass Admitted · Entry Granted
                    </span>
                    <h3 className="text-2xl font-black text-white mt-1">
                      {result.donorName || 'Guest / Donor'}
                    </h3>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-emerald-900/50">
                  <div className="p-2.5 bg-slate-900/60 rounded-xl border border-emerald-900/40">
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Price Band</p>
                    <p className="text-sm font-bold text-white mt-0.5">{result.bandLabel}</p>
                  </div>
                  <div className="p-2.5 bg-slate-900/60 rounded-xl border border-emerald-900/40">
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Assigned Row</p>
                    <p className="text-sm font-bold text-amber-300 font-mono mt-0.5">{result.rowLabel}</p>
                  </div>
                  <div className="p-2.5 bg-slate-900/60 rounded-xl border border-emerald-900/40">
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Serial No</p>
                    <p className="text-sm font-bold text-emerald-300 font-mono mt-0.5">{result.serialNo}</p>
                  </div>
                  <div className="p-2.5 bg-slate-900/60 rounded-xl border border-emerald-900/40">
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Payment</p>
                    <p className={`text-sm font-bold mt-0.5 ${result.isPaid ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {result.isPaid ? 'Paid & Cleared' : 'Pending Payment'}
                    </p>
                  </div>
                </div>
              </div>
            ) : result.duplicate ? (
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <ShieldAlert className="w-10 h-10 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="px-3 py-0.5 rounded-full text-xs font-black uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/40">
                      ⛔ REJECTED: ALREADY ENTERED
                    </span>
                    <h3 className="text-xl font-black text-rose-200 mt-1">
                      Duplicate Pass / Possible Photocopy
                    </h3>
                    <p className="text-xs text-rose-300/90 mt-1">
                      {result.error}
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-black/40 rounded-xl border border-rose-900/60 text-xs space-y-1 text-slate-300">
                  <p><strong className="text-white">Donor on Record:</strong> {result.donorName || 'Unknown'}</p>
                  <p><strong className="text-white">Serial:</strong> <span className="font-mono text-rose-300">{result.serialNo}</span></p>
                  <p><strong className="text-white">Band & Row:</strong> {result.bandLabel} — {result.rowLabel}</p>
                </div>

                {isSuperOrSystemAdmin && (
                  <div className="pt-2 border-t border-rose-900/60 flex justify-end">
                    <Button
                      size="sm"
                      onClick={() => handleCheckin(undefined, true)}
                      className="bg-rose-800 hover:bg-rose-700 text-white text-xs font-bold rounded-lg"
                    >
                      Supervisor Override Entry
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-start gap-3">
                <XCircle className="w-8 h-8 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-base font-bold text-red-200">Admission Denied</h3>
                  <p className="text-xs text-red-300 mt-0.5">{result.error}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Recent Admissions Audit */}
      {recentAdmissions.length > 0 && (
        <Card className="bg-[#131F2E] border border-slate-800 rounded-2xl shadow-lg">
          <CardContent className="p-4 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Recent Admitted Passes (This Session)
            </h3>
            <div className="divide-y divide-slate-800/60">
              {recentAdmissions.map((item, idx) => (
                <div key={idx} className="py-2 flex justify-between items-center text-xs">
                  <div>
                    <span className="font-bold text-white">{item.name}</span>
                    <span className="text-slate-400 ml-2">({item.band})</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-amber-300">{item.serial}</span>
                    <span className="text-slate-500 font-mono">{item.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
