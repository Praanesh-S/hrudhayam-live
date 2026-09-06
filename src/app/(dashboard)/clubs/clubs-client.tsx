'use client';

import { useState } from 'react';
import { Band, PaymentMode } from '@/lib/types';
import { AuthUser } from '@/lib/auth/session';
import { addParticipatingClub } from './actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Building2, 
  Plus, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  CreditCard,
  Phone,
  User,
  Ticket
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface ClubsClientProps {
  clubs: any[];
  bands: Band[];
  members: any[];
  currentUser: AuthUser;
}

export function ClubsClient({ clubs, bands, members }: ClubsClientProps) {
  const [showAddForm, setShowAddForm] = useState(false);

  // Form fields
  const [clubName, setClubName] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [broughtByMemberId, setBroughtByMemberId] = useState<number | ''>('');
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('bank_transfer');
  const [paymentReferenceNo, setPaymentReferenceNo] = useState('');

  // Pass quantities map: { [bandId]: count }
  const [passCounts, setPassCounts] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    bands.forEach((b) => (initial[b.id] = 0));
    return initial;
  });

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Calculate total pass value
  const totalPassValue = bands.reduce((sum, b) => {
    const count = passCounts[b.id] || 0;
    return sum + b.price * count;
  }, 0);

  const isValidValue = totalPassValue === 15000;

  const handleCountChange = (bandId: string, delta: number) => {
    setPassCounts((prev) => {
      const current = prev[bandId] || 0;
      const next = Math.max(0, current + delta);
      return { ...prev, [bandId]: next };
    });
  };

  const handleAddClub = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidValue) {
      setErrorMessage(`Passes must total ₹15,000. Currently: ₹${totalPassValue.toLocaleString('en-IN')}`);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const passesMix = Object.entries(passCounts)
      .filter(([_, count]) => count > 0)
      .map(([bandId, count]) => ({ bandId, count }));

    const res = await addParticipatingClub({
      clubName,
      contactName,
      contactPhone,
      broughtByMemberId: broughtByMemberId ? Number(broughtByMemberId) : null,
      passesMix,
      paymentMode,
      paymentReferenceNo,
    });

    setIsLoading(false);

    if (!res.success) {
      setErrorMessage(res.error || 'Failed to add participating club.');
    } else {
      setSuccessMessage(`Club "${clubName}" added successfully with ${res.passesCount} passes issued!`);
      // Reset form
      setClubName('');
      setContactName('');
      setContactPhone('');
      setBroughtByMemberId('');
      setPaymentReferenceNo('');
      const resetCounts: Record<string, number> = {};
      bands.forEach((b) => (resetCounts[b.id] = 0));
      setPassCounts(resetCounts);
      setShowAddForm(false);
    }
  };

  // Metrics summary
  const totalClubs = clubs.length;
  const totalFees = totalClubs * 25000;
  const totalNet = totalClubs * 10000;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#131F2E] border border-slate-800 p-5 rounded-2xl">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Participating Clubs
          </span>
          <div className="text-3xl font-black text-white mt-1">{totalClubs}</div>
          <span className="text-xs text-slate-500">₹25,000 Entry Fee per Club</span>
        </div>

        <div className="bg-[#131F2E] border border-slate-800 p-5 rounded-2xl">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Total Entry Fees Received
          </span>
          <div className="text-3xl font-black text-[#E8913A] mt-1">
            ₹{totalFees.toLocaleString('en-IN')}
          </div>
          <span className="text-xs text-slate-500">Books ₹15k in passes each</span>
        </div>

        <div className="bg-[#131F2E] border border-slate-800 p-5 rounded-2xl">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Indicative Net Contribution
          </span>
          <div className="text-3xl font-black text-emerald-400 mt-1">
            ₹{totalNet.toLocaleString('en-IN')}
          </div>
          <span className="text-xs text-slate-500">Excluded from competition</span>
        </div>
      </div>

      {/* Messages */}
      {errorMessage && (
        <Alert variant="destructive" className="bg-red-950/70 border-red-800 text-red-100">
          <AlertCircle className="h-5 w-5 text-red-400" />
          <AlertTitle className="text-base font-bold">Error</AlertTitle>
          <AlertDescription className="text-sm">{errorMessage}</AlertDescription>
        </Alert>
      )}

      {successMessage && (
        <Alert className="bg-emerald-950/70 border-emerald-800 text-emerald-100">
          <CheckCircle2 className="h-5 w-5 text-emerald-400" />
          <AlertTitle className="text-base font-bold">Success</AlertTitle>
          <AlertDescription className="text-sm">{successMessage}</AlertDescription>
        </Alert>
      )}

      {/* Header action button */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-white">Registered Clubs</h2>
        <Button
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-[#E8913A] hover:bg-[#D97706] text-slate-950 font-bold h-11 px-5 rounded-xl"
        >
          {showAddForm ? 'Cancel' : <><Plus className="w-5 h-5 mr-1" /> Add Participating Club</>}
        </Button>
      </div>

      {/* Add Club Form Modal / Drawer */}
      {showAddForm && (
        <form onSubmit={handleAddClub} className="bg-[#131F2E] border-2 border-amber-500/40 p-6 sm:p-8 rounded-3xl space-y-6 shadow-2xl">
          <div>
            <h3 className="text-2xl font-black text-white flex items-center gap-2">
              <Building2 className="w-6 h-6 text-[#E8913A]" />
              New Participating Rotary Club
            </h3>
            <p className="text-slate-400 text-sm mt-1">
              ₹25,000 fee includes ₹15,000 in donor passes. Compose the passes below to match ₹15,000 exactly.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-bold text-white">Club Name *</Label>
              <Input
                placeholder="e.g. Rotary Club of Madras East"
                value={clubName}
                onChange={(e) => setClubName(e.target.value)}
                className="h-12 bg-[#1A2839] border-slate-700 text-white rounded-xl"
                required
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-bold text-white">Contact Person Name *</Label>
              <Input
                placeholder="e.g. Rtn. President Name"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                className="h-12 bg-[#1A2839] border-slate-700 text-white rounded-xl"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-bold text-white">Contact WhatsApp Number *</Label>
              <Input
                placeholder="10-digit mobile number"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                className="h-12 bg-[#1A2839] border-slate-700 text-white rounded-xl font-mono"
                required
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-bold text-white">Invited By Member (Optional)</Label>
              <select
                value={broughtByMemberId}
                onChange={(e) => setBroughtByMemberId(e.target.value ? Number(e.target.value) : '')}
                className="w-full h-12 bg-[#1A2839] border border-slate-700 text-white rounded-xl px-3 text-sm"
              >
                <option value="">-- None / Direct --</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.full_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* ₹15,000 Pass Composition Builder (§8.2, §8.3) */}
          <div className="space-y-3 p-5 bg-slate-900/80 border border-slate-800 rounded-2xl">
            <div className="flex justify-between items-center">
              <div>
                <Label className="text-base font-bold text-white">
                  Compose ₹15,000 in Passes *
                </Label>
                <p className="text-xs text-slate-400 mt-0.5">
                  Select pass quantities across price bands. Total must equal exactly ₹15,000.
                </p>
              </div>
              <div className={`px-4 py-2 rounded-xl text-base font-black font-mono ${
                isValidValue 
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                  : 'bg-red-500/20 text-red-400 border border-red-500/40'
              }`}>
                Total: ₹{totalPassValue.toLocaleString('en-IN')} / ₹15,000
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              {bands.map((b) => {
                const count = passCounts[b.id] || 0;
                const subtotal = count * b.price;

                return (
                  <div key={b.id} className="p-3 bg-[#1A2839] border border-slate-700 rounded-xl flex items-center justify-between">
                    <div>
                      <div className="font-bold text-white text-sm">{b.label}</div>
                      <div className="text-xs text-amber-400 font-mono">₹{b.price.toLocaleString('en-IN')} each</div>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => handleCountChange(b.id, -1)}
                        disabled={count <= 0}
                        className="w-8 h-8 rounded-lg bg-slate-800 text-white font-bold disabled:opacity-30 hover:bg-slate-700"
                      >
                        -
                      </button>
                      <span className="w-8 text-center font-bold text-base font-mono text-white">
                        {count}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCountChange(b.id, 1)}
                        className="w-8 h-8 rounded-lg bg-[#E8913A] text-slate-950 font-bold hover:bg-[#D97706]"
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {!isValidValue && (
              <p className="text-xs font-semibold text-red-400 pt-1">
                ⚠️ Selection does not equal ₹15,000. Please adjust the pass quantities.
              </p>
            )}
          </div>

          {/* Payment info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-bold text-white">Payment Mode</Label>
              <select
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value as PaymentMode)}
                className="w-full h-12 bg-[#1A2839] border border-slate-700 text-white rounded-xl px-3 text-sm"
              >
                <option value="bank_transfer">Bank Transfer (NEFT / IMPS)</option>
                <option value="cheque">Cheque</option>
                <option value="upi">UPI</option>
                <option value="cash">Cash</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-bold text-white">
                Payment Reference Number / Cheque No *
              </Label>
              <Input
                placeholder="UTR / Cheque No / Reference"
                value={paymentReferenceNo}
                onChange={(e) => setPaymentReferenceNo(e.target.value)}
                className="h-12 bg-[#1A2839] border-slate-700 text-white rounded-xl font-mono"
                required
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowAddForm(false)}
              className="bg-[#1A2839] border-slate-700 text-white h-12 px-6 rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !isValidValue || !paymentReferenceNo.trim()}
              className="bg-[#E8913A] hover:bg-[#D97706] text-slate-950 font-black h-12 px-8 rounded-xl shadow-lg"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Issuing Passes...
                </>
              ) : (
                'Confirm & Issue Club Passes'
              )}
            </Button>
          </div>
        </form>
      )}

      {/* Clubs List */}
      <div className="space-y-3">
        {clubs.length === 0 ? (
          <div className="p-12 text-center bg-[#131F2E] border border-slate-800 rounded-3xl text-slate-400">
            <Building2 className="w-12 h-12 mx-auto mb-3 text-slate-600" />
            <h3 className="text-lg font-bold text-white">No Participating Clubs Yet</h3>
            <p className="text-sm mt-1">
              Click &quot;Add Participating Club&quot; to record a Rotary partner club.
            </p>
          </div>
        ) : (
          clubs.map((c) => (
            <div
              key={c.id}
              className="p-5 sm:p-6 bg-[#131F2E] border border-slate-800 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
            >
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-bold text-white">{c.club_name}</h3>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    Paid ₹25,000
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 mt-2">
                  <span className="flex items-center gap-1">
                    <User className="w-3.5 h-3.5" /> {c.contact_name}
                  </span>
                  <span className="flex items-center gap-1 font-mono">
                    <Phone className="w-3.5 h-3.5" /> {c.contact_phone}
                  </span>
                  <span className="flex items-center gap-1 text-[#E8913A]">
                    <Ticket className="w-3.5 h-3.5" /> {c.passes?.length || 0} Passes Issued
                  </span>
                </div>
              </div>

              <div className="flex sm:flex-col justify-between sm:justify-start items-center sm:items-end text-left sm:text-right w-full sm:w-auto border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-800">
                <div className="text-xs text-slate-500">Net Contribution</div>
                <div className="text-lg font-black text-emerald-400">
                  ₹{c.net_contribution?.toLocaleString('en-IN')}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
