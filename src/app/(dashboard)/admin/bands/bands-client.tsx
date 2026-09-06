'use client';

import { useState } from 'react';
import { Band, ProtectedBlock, SeatData, VenueRow, SeatSection } from '@/lib/types';
import { AuthUser } from '@/lib/auth/session';
import { 
  updateBandAllocation, 
  createProtectedBlock, 
  releaseProtectedBlock,
  bulkSetRowTier,
  recalibrateBandsToVenueCapacity
} from '../actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Layers, 
  Shield, 
  Plus, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  ArrowRight,
  Crown,
  Lock,
  Sparkles,
  MapPin,
  RefreshCw,
  Sliders,
  Check
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import SeatMap from '@/components/dashboard/SeatMap';
import { formatINR } from '@/lib/constants';

interface BandsClientProps {
  bands: Band[];
  protectedBlocks: ProtectedBlock[];
  seats: SeatData[];
  rows: VenueRow[];
  currentUser: AuthUser;
}

export function BandsClient({
  bands,
  protectedBlocks,
  seats,
  rows,
  currentUser,
}: BandsClientProps) {
  // Navigation tabs: 'blueprint' | 'bands' | 'protected'
  const [activeTab, setActiveTab] = useState<'blueprint' | 'bands' | 'protected'>('blueprint');

  // Editing band allocation
  const [editingBandId, setEditingBandId] = useState<string | null>(null);
  const [newAllocation, setNewAllocation] = useState<number>(0);
  const [newPrice, setNewPrice] = useState<number>(0);

  // New protected block modal
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [blockLabel, setBlockLabel] = useState('');
  const [blockCount, setBlockCount] = useState(10);

  // Releasing block modal
  const [releasingBlockId, setReleasingBlockId] = useState<string | null>(null);
  const [targetBandId, setTargetBandId] = useState<string>(bands[0]?.id || '');

  // Bulk Tier Assigner state
  const [showRowAssigner, setShowRowAssigner] = useState(false);
  const [assignSection, setAssignSection] = useState<SeatSection>('Ground Floor');
  const [assignFromRow, setAssignFromRow] = useState<string>('A');
  const [assignToRow, setAssignToRow] = useState<string>('F');
  const [assignTier, setAssignTier] = useState<number>(5000);

  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Capacity calculations
  const totalAllocated = bands.reduce((acc, b) => acc + (b.total_allocated || 0), 0);
  const totalSold = bands.reduce((acc, b) => acc + (b.sold_count || 0), 0);
  const totalRemaining = bands.reduce((acc, b) => acc + (b.remaining_count || 0), 0);

  const startEditBand = (band: Band) => {
    setEditingBandId(band.id);
    setNewAllocation(band.total_allocated);
    setNewPrice(band.price);
  };

  const handleSaveBand = async (bandId: string) => {
    setIsLoading(true);
    setStatusMessage(null);

    const res = await updateBandAllocation(bandId, newAllocation, newPrice);
    setIsLoading(false);

    if (res.success) {
      setStatusMessage({ type: 'success', text: 'Band allocation updated successfully.' });
      setEditingBandId(null);
    } else {
      setStatusMessage({ type: 'error', text: res.error || 'Failed to update band.' });
    }
  };

  const handleCreateBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setStatusMessage(null);

    const res = await createProtectedBlock(blockLabel, blockCount);
    setIsLoading(false);

    if (res.success) {
      setStatusMessage({ type: 'success', text: `Protected block "${blockLabel}" created with ${blockCount} seats.` });
      setBlockLabel('');
      setBlockCount(10);
      setShowBlockModal(false);
    } else {
      setStatusMessage({ type: 'error', text: res.error || 'Failed to create block.' });
    }
  };

  const handleReleaseBlock = async (blockId: string) => {
    if (!targetBandId) return;
    setIsLoading(true);
    setStatusMessage(null);

    const res = await releaseProtectedBlock(blockId, targetBandId);
    setIsLoading(false);

    if (res.success) {
      setStatusMessage({ type: 'success', text: 'Protected block released into sellable band inventory!' });
      setReleasingBlockId(null);
    } else {
      setStatusMessage({ type: 'error', text: res.error || 'Failed to release block.' });
    }
  };

  const handleApplyRowTier = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setStatusMessage(null);

    const res = await bulkSetRowTier(assignSection, assignFromRow, assignToRow, assignTier);
    setIsLoading(false);

    if (res.success) {
      setStatusMessage({
        type: 'success',
        text: `Successfully updated ${res.count} row(s) in ${assignSection} (${assignFromRow} to ${assignToRow}) to ₹${assignTier.toLocaleString('en-IN')}. The seat blueprint has updated live!`,
      });
      setShowRowAssigner(false);
    } else {
      setStatusMessage({ type: 'error', text: res.error || 'Failed to update row tiers.' });
    }
  };

  const handleRecalibrateCapacity = async () => {
    if (!confirm('Recalibrate band allocations to the exact 1,398 venue capacity blueprint (467 at ₹5,000, 474 at ₹3,500, 0 at ₹2,500, 457 at ₹1,500)?')) {
      return;
    }

    setIsLoading(true);
    setStatusMessage(null);

    const res = await recalibrateBandsToVenueCapacity();
    setIsLoading(false);

    if (res.success) {
      setStatusMessage({
        type: 'success',
        text: 'Band capacities successfully recalibrated to exact 1,398 regular seats + 50 VIP box seats.',
      });
    } else {
      setStatusMessage({ type: 'error', text: res.error || 'Failed to recalibrate.' });
    }
  };

  const rowLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N'];

  return (
    <div className="space-y-6">
      {statusMessage && (
        <Alert className={statusMessage.type === 'success' ? 'bg-emerald-950/70 border-emerald-800 text-emerald-100' : 'bg-red-950/70 border-red-800 text-red-100'}>
          {statusMessage.type === 'success' ? <CheckCircle2 className="h-5 w-5 text-emerald-400" /> : <AlertCircle className="h-5 w-5 text-red-400" />}
          <AlertTitle className="text-base font-bold">{statusMessage.type === 'success' ? 'Success' : 'Error'}</AlertTitle>
          <AlertDescription className="text-sm">{statusMessage.text}</AlertDescription>
        </Alert>
      )}

      {/* ─────────────────────────────────────────────────────────────
          1. VENUE CAPACITY & BLUEPRINT BANNER (Exact 1,398 Seats)
      ───────────────────────────────────────────────────────────── */}
      <div className="p-5 bg-gradient-to-r from-[#131F2E] via-[#162538] to-[#131F2E] border-2 border-amber-500/30 rounded-3xl shadow-xl space-y-4">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/30">
                Architectural Capacity Blueprint
              </span>
              <span className="text-xs text-slate-400 font-mono">The Music Academy, Madras</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white mt-1 flex items-center gap-2">
              The Music Academy Seating Plan
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 mt-0.5 max-w-2xl">
              Capacity is defined by the architectural seating layout:{' '}
              <strong className="text-white font-mono">648 Ground Floor + 750 Balcony = 1,398 Regular Seats</strong>{' '}
              plus <strong className="text-purple-300 font-mono">50 SPL VIP Box Seats</strong> (visible & non-editable).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            {totalAllocated !== 1398 && (
              <Button
                onClick={handleRecalibrateCapacity}
                disabled={isLoading}
                className="bg-amber-500 hover:bg-[#D97706] text-slate-950 font-bold rounded-xl h-10 px-3 text-xs flex items-center gap-1.5 shadow-md"
                title="Align total allocated bands to exactly 1,398 seats"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                ⚡ Align Quotas to 1,398
              </Button>
            )}

            <Button
              onClick={() => setShowRowAssigner(!showRowAssigner)}
              className="bg-[#1A2839] hover:bg-[#223345] border border-amber-500/40 text-amber-300 font-bold rounded-xl h-10 px-3.5 text-xs flex items-center gap-1.5"
            >
              <Sliders className="w-3.5 h-3.5" />
              Assign Row Tiers
            </Button>

            <Button
              onClick={() => setShowBlockModal(true)}
              className="bg-[#1A2839] hover:bg-[#223345] border border-slate-700 text-white font-bold rounded-xl h-10 px-3.5 text-xs flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5 text-[#E8913A]" />
              Earmark Protected Block
            </Button>
          </div>
        </div>

        {/* Live Venue Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-800/80">
          <div className="p-3 bg-[#0E1722] rounded-2xl border border-slate-800">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Sellable Capacity</p>
            <p className="text-xl sm:text-2xl font-black text-white mt-0.5 font-mono">
              1,398{' '}
              <span className="text-xs font-normal text-slate-400">Seats (GF 648 + Bal 750)</span>
            </p>
          </div>

          <div className="p-3 bg-[#0E1722] rounded-2xl border border-purple-800/40">
            <p className="text-[11px] font-bold text-purple-300 uppercase tracking-wider flex items-center gap-1">
              <Crown className="w-3 h-3 text-purple-400" /> VIP Box (Non-editable)
            </p>
            <p className="text-xl sm:text-2xl font-black text-purple-300 mt-0.5 font-mono">
              50{' '}
              <span className="text-xs font-normal text-slate-400">Chief Guests</span>
            </p>
          </div>

          <div className="p-3 bg-[#0E1722] rounded-2xl border border-slate-800">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Band Quotas</p>
            <p className={`text-xl sm:text-2xl font-black mt-0.5 font-mono ${totalAllocated === 1398 ? 'text-emerald-400' : 'text-amber-400'}`}>
              {totalAllocated}{' '}
              <span className="text-xs font-normal text-slate-400">/ 1,398</span>
            </p>
          </div>

          <div className="p-3 bg-[#0E1722] rounded-2xl border border-slate-800">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Passes Sold</p>
            <p className="text-xl sm:text-2xl font-black text-[#E8913A] mt-0.5 font-mono">
              {totalSold}{' '}
              <span className="text-xs font-normal text-slate-400">({totalRemaining} Remaining)</span>
            </p>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. COLLAPSIBLE FORM: BULK ASSIGN ROW TIERS (Reflects on Map)
      ───────────────────────────────────────────────────────────── */}
      {showRowAssigner && (
        <form onSubmit={handleApplyRowTier} className="p-5 bg-[#131F2E] border-2 border-amber-500/50 rounded-2xl space-y-4 shadow-xl">
          <div className="flex justify-between items-center pb-2 border-b border-slate-800">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Sliders className="w-4 h-4 text-[#E8913A]" /> Assign Pricing Tier to Row Range
              </h3>
              <p className="text-xs text-slate-400">
                Updates row tiers and all individual seat records in real time. The changes immediately reflect on the blueprint map below.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowRowAssigner(false)}
              className="text-slate-400 hover:text-white text-sm"
            >
              ✕
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-300">Floor / Section</Label>
              <select
                value={assignSection}
                onChange={(e) => setAssignSection(e.target.value as SeatSection)}
                className="w-full h-10 bg-[#1A2839] border border-slate-700 text-white rounded-xl px-3 text-xs font-bold"
              >
                <option value="Ground Floor">Ground Floor (648 Seats)</option>
                <option value="Balcony">Balcony (750 Seats)</option>
              </select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-300">From Row</Label>
              <select
                value={assignFromRow}
                onChange={(e) => setAssignFromRow(e.target.value)}
                className="w-full h-10 bg-[#1A2839] border border-slate-700 text-white rounded-xl px-3 text-xs font-mono font-bold"
              >
                {rowLetters.map((r) => (
                  <option key={r} value={r}>Row {r}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-300">To Row (Inclusive)</Label>
              <select
                value={assignToRow}
                onChange={(e) => setAssignToRow(e.target.value)}
                className="w-full h-10 bg-[#1A2839] border border-slate-700 text-white rounded-xl px-3 text-xs font-mono font-bold"
              >
                {rowLetters.map((r) => (
                  <option key={r} value={r}>Row {r}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-300">Price Tier</Label>
              <select
                value={assignTier}
                onChange={(e) => setAssignTier(Number(e.target.value))}
                className="w-full h-10 bg-[#1A2839] border border-slate-700 text-white rounded-xl px-3 text-xs font-bold"
              >
                <option value={5000}>₹5,000 (Band A - Gold)</option>
                <option value={3500}>₹3,500 (Band B - Purple)</option>
                <option value={2500}>₹2,500 (Band C - Teal)</option>
                <option value={1500}>₹1,500 (Band D - Slate)</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowRowAssigner(false)}
              className="bg-[#1A2839] border-slate-700 text-white rounded-xl text-xs h-9"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="bg-[#E8913A] hover:bg-[#D97706] text-slate-950 font-bold rounded-xl text-xs h-9"
            >
              {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
              Apply Tier to Rows & Update Map
            </Button>
          </div>
        </form>
      )}

      {/* ─────────────────────────────────────────────────────────────
          3. NAVIGATION TABS (Blueprint Map vs Bands vs Protected)
      ───────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('blueprint')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
            activeTab === 'blueprint'
              ? 'bg-[#E8913A] text-slate-950 shadow-md'
              : 'bg-[#131F2E] text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <MapPin className="w-4 h-4" />
          Seating Blueprint Map (1,398 Seats)
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('bands')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
            activeTab === 'bands'
              ? 'bg-[#E8913A] text-slate-950 shadow-md'
              : 'bg-[#131F2E] text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          Price Bands Inventory ({bands.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('protected')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
            activeTab === 'protected'
              ? 'bg-[#E8913A] text-slate-950 shadow-md'
              : 'bg-[#131F2E] text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Shield className="w-4 h-4" />
          Protected Blocks ({protectedBlocks.length})
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          4. TAB 1: SEATING BLUEPRINT MAP
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'blueprint' && (
        <div className="space-y-4">
          <SeatMap seats={seats} rows={rows} />
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          5. TAB 2: PRICE BANDS INVENTORY
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'bands' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-[#E8913A]" /> Price Bands Inventory Quotas
              </h3>
              <p className="text-xs text-slate-400">
                Derived remaining capacity: Total Allocated - Active Passes - Active Holds.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {bands.map((b) => {
              const isEditing = editingBandId === b.id;
              const issuedCount = b.sold_count ?? 0;

              return (
                <Card key={b.id} className="bg-[#131F2E] border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
                  <CardContent className="p-6 space-y-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-xl font-black text-white">{b.label}</h3>
                        <div className="text-2xl font-black text-[#E8913A] font-mono mt-0.5">
                          ₹{b.price.toLocaleString('en-IN')}
                        </div>
                      </div>
                      {!isEditing && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => startEditBand(b)}
                          className="bg-[#1A2839] border-slate-700 text-white hover:bg-slate-800 rounded-xl text-xs h-8"
                        >
                          Edit
                        </Button>
                      )}
                    </div>

                    {isEditing ? (
                      <div className="space-y-3 p-4 bg-slate-900/80 border border-amber-500/30 rounded-xl">
                        <div className="space-y-1">
                          <Label className="text-xs font-bold text-slate-300">Total Allocated Seats</Label>
                          <Input
                            type="number"
                            value={newAllocation}
                            onChange={(e) => setNewAllocation(Number(e.target.value))}
                            className="h-10 bg-[#1A2839] border-slate-700 text-white rounded-lg font-mono text-base"
                          />
                          <span className="text-[11px] text-slate-500">
                            Must be &ge; {issuedCount} (already issued passes).
                          </span>
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs font-bold text-slate-300">Price (₹)</Label>
                          <Input
                            type="number"
                            value={newPrice}
                            onChange={(e) => setNewPrice(Number(e.target.value))}
                            className="h-10 bg-[#1A2839] border-slate-700 text-white rounded-lg font-mono text-base"
                          />
                        </div>

                        <div className="flex justify-end gap-2 pt-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingBandId(null)}
                            className="text-slate-400 hover:text-white text-xs h-8"
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            disabled={isLoading || newAllocation < issuedCount}
                            onClick={() => handleSaveBand(b.id)}
                            className="bg-[#E8913A] hover:bg-[#D97706] text-slate-950 font-bold rounded-lg text-xs h-8"
                          >
                            {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                            Save
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800 text-center">
                        <div className="p-2 bg-slate-900/40 rounded-xl">
                          <div className="text-xs text-slate-400">Allocated</div>
                          <div className="text-lg font-bold text-white font-mono">{b.total_allocated}</div>
                        </div>
                        <div className="p-2 bg-slate-900/40 rounded-xl">
                          <div className="text-xs text-slate-400">Sold</div>
                          <div className="text-lg font-bold text-[#E8913A] font-mono">{b.sold_count}</div>
                        </div>
                        <div className="p-2 bg-slate-900/40 rounded-xl">
                          <div className="text-xs text-slate-400">Remaining</div>
                          <div className="text-lg font-bold text-emerald-400 font-mono">{b.remaining_count}</div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          6. TAB 3: PROTECTED & EARMARKED BLOCKS
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'protected' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Shield className="w-5 h-5 text-amber-500" /> Protected / Earmarked Blocks
              </h3>
              <p className="text-xs text-slate-400">
                Reserved blocks for VIPs, Sponsor rows, Police & Officials. Can be released into a sellable band anytime.
              </p>
            </div>
            <Button
              onClick={() => setShowBlockModal(true)}
              className="bg-[#1A2839] hover:bg-[#223345] border border-slate-700 text-white font-bold h-9 px-3.5 rounded-xl text-xs flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5 text-[#E8913A]" /> Earmark Block
            </Button>
          </div>

          {/* Modal / Form to create block */}
          {showBlockModal && (
            <form onSubmit={handleCreateBlock} className="p-5 bg-[#131F2E] border-2 border-amber-500/40 rounded-2xl space-y-4">
              <h3 className="text-base font-bold text-white">Earmark New Protected Block</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs text-slate-300">Label / Category *</Label>
                  <Input
                    placeholder="e.g. VIP Front Row / Police Dignitaries"
                    value={blockLabel}
                    onChange={(e) => setBlockLabel(e.target.value)}
                    className="h-10 bg-[#1A2839] border-slate-700 text-white rounded-lg"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-slate-300">Number of Seats *</Label>
                  <Input
                    type="number"
                    min="1"
                    value={blockCount}
                    onChange={(e) => setBlockCount(Number(e.target.value))}
                    className="h-10 bg-[#1A2839] border-slate-700 text-white rounded-lg font-mono"
                    required
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowBlockModal(false)}
                  className="text-slate-400 hover:text-white text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isLoading || !blockLabel.trim() || blockCount < 1}
                  className="bg-[#E8913A] hover:bg-[#D97706] text-slate-950 font-bold rounded-lg text-xs"
                >
                  {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                  Create Block
                </Button>
              </div>
            </form>
          )}

          {/* List of Protected Blocks */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {protectedBlocks.length === 0 ? (
              <div className="col-span-2 p-8 text-center bg-[#131F2E] border border-slate-800 rounded-2xl text-slate-400 text-xs">
                No earmarked protected blocks yet. Click &quot;Earmark Block&quot; to reserve seats for Police, VIPs, or Sponsors.
              </div>
            ) : (
              protectedBlocks.map((block) => (
                <Card key={block.id} className="bg-[#131F2E] border border-slate-800 rounded-2xl shadow-lg">
                  <CardContent className="p-5 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="text-base font-bold text-white">{block.label}</h4>
                        <span className="text-xs text-slate-400">
                          {block.seat_count} seats earmarked
                        </span>
                      </div>
                      {block.released_to_band_id ? (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-950 text-emerald-400 border border-emerald-800">
                          Released
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-950 text-amber-300 border border-amber-800">
                          Locked
                        </span>
                      )}
                    </div>

                    {!block.released_to_band_id ? (
                      <div className="pt-2 border-t border-slate-800 space-y-2">
                        {releasingBlockId === block.id ? (
                          <div className="space-y-2 p-3 bg-slate-900 rounded-xl border border-amber-500/30">
                            <Label className="text-xs text-slate-300">Release into Sellable Band:</Label>
                            <select
                              value={targetBandId}
                              onChange={(e) => setTargetBandId(e.target.value)}
                              className="w-full h-9 bg-[#1A2839] border border-slate-700 text-white rounded-lg px-2 text-xs"
                            >
                              {bands.map((b) => (
                                <option key={b.id} value={b.id}>
                                  {b.label} (Current: {b.total_allocated})
                                </option>
                              ))}
                            </select>
                            <div className="flex justify-end gap-2 pt-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setReleasingBlockId(null)}
                                className="text-slate-400 text-xs h-7"
                              >
                                Cancel
                              </Button>
                              <Button
                                size="sm"
                                disabled={isLoading}
                                onClick={() => handleReleaseBlock(block.id)}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-7 font-bold rounded-lg"
                              >
                                Confirm Release
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setReleasingBlockId(block.id);
                              setTargetBandId(bands[0]?.id || '');
                            }}
                            className="w-full bg-[#1A2839] border-slate-700 text-slate-300 hover:text-white rounded-xl text-xs h-8"
                          >
                            <ArrowRight className="w-3 h-3 mr-1" /> Release to Public Band
                          </Button>
                        )}
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-500 italic pt-1">
                        Released into sellable inventory on {new Date(block.updated_at || block.created_at || '').toLocaleDateString('en-IN')}.
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
