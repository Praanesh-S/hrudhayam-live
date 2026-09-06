'use client';

import { useState } from 'react';
import { Band } from '@/lib/types';
import { AuthUser } from '@/lib/auth/session';
import { cancelPassBySystemAdmin, movePassToBandBySystemAdmin } from '../actions';
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
  ShieldAlert
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
  const [passes] = useState(initialPasses);

  // Modal states
  const [cancellingPass, setCancellingPass] = useState<any | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const [movingPass, setMovingPass] = useState<any | null>(null);
  const [targetBandId, setTargetBandId] = useState<string>(bands[0]?.id || '');
  const [moveReason, setMoveReason] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleCancelPass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancellingPass || !cancelReason.trim()) return;

    setIsLoading(true);
    setStatusMessage(null);

    const res = await cancelPassBySystemAdmin(cancellingPass.id, cancelReason);
    setIsLoading(false);

    if (res.success) {
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
      setStatusMessage({ type: 'success', text: `Pass ${movingPass.pass_code} successfully moved to target band.` });
      setMovingPass(null);
      setMoveReason('');
    } else {
      setStatusMessage({ type: 'error', text: res.error || 'Failed to move pass.' });
    }
  };

  const filteredPasses = passes.filter((p) => {
    const q = searchQuery.toLowerCase();
    return (
      p.pass_code.toLowerCase().includes(q) ||
      p.donor_name.toLowerCase().includes(q) ||
      (p.donor_phone && p.donor_phone.includes(q)) ||
      (p.physical_serial && p.physical_serial.toLowerCase().includes(q))
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
                  <div className="flex items-center gap-2">
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
                        Serial: {p.physical_serial}
                      </span>
                    )}
                  </div>

                  <div className="text-sm font-semibold text-white mt-1">
                    {p.donor_name} • <span className="font-mono text-slate-400">{p.donor_phone}</span>
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
                      onClick={() => {
                        setMovingPass(p);
                        const otherBand = bands.find((b) => b.id !== p.band_id);
                        if (otherBand) setTargetBandId(otherBand.id);
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
