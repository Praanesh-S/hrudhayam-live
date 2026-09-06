'use client';

import { useState } from 'react';
import { Band, ProtectedBlock, SeatData, VenueRow, SeatSection } from '@/lib/types';
import { AuthUser } from '@/lib/auth/session';
import { 
  updateBandAllocation, 
  updateBandPrice,
  createProtectedBlock, 
  releaseProtectedBlock,
  deleteProtectedBlock,
  bulkSetRowTier,
  assignRowToBand,
  blockExactSeats,
  unblockExactSeats,
  blockRow,
  unblockRow,
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
  MapPin,
  RefreshCw,
  Sliders,
  Pencil,
  Trash2,
  Download,
  X
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import SeatMap from '@/components/dashboard/SeatMap';

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

  // Edit band price state
  const [editingPriceBand, setEditingPriceBand] = useState<Band | null>(null);
  const [editPriceInput, setEditPriceInput] = useState<number>(0);

  // New protected block modal state
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [blockLabel, setBlockLabel] = useState('');
  const [blockCount, setBlockCount] = useState(10);
  const [blockBandId, setBlockBandId] = useState<string>(bands[0]?.id || 'band_5000');

  // Releasing block modal state
  const [releasingBlockId, setReleasingBlockId] = useState<string | null>(null);
  const [targetBandId, setTargetBandId] = useState<string>(bands[0]?.id || '');

  // Bulk Tier Assigner state
  const [showRowAssigner, setShowRowAssigner] = useState(false);
  const [assignSection, setAssignSection] = useState<SeatSection>('Ground Floor');
  const [assignFromRow, setAssignFromRow] = useState<string>('A');
  const [assignToRow, setAssignToRow] = useState<string>('F');
  const [assignTier, setAssignTier] = useState<number>(5000);
  const [matrixSection, setMatrixSection] = useState<SeatSection>('Ground Floor');

  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Capacity calculations
  const totalAllocated = bands.reduce((acc, b) => acc + (b.total_allocated || 0), 0);
  const totalSold = bands.reduce((acc, b) => acc + (b.sold_count || 0), 0);
  const totalRemaining = bands.reduce((acc, b) => acc + (b.remaining_count || 0), 0);

  const handleStartEditPrice = (band: Band) => {
    setEditingPriceBand(band);
    setEditPriceInput(band.price);
  };

  const handleSaveBandPrice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPriceBand) return;
    if (editPriceInput <= 0) {
      setStatusMessage({ type: 'error', text: 'Price must be greater than 0.' });
      return;
    }

    setIsLoading(true);
    setStatusMessage(null);

    const res = await updateBandPrice(editingPriceBand.id, editPriceInput);
    setIsLoading(false);

    if (res.success) {
      const bandName = editingPriceBand.label.split('(')[0].trim();
      setStatusMessage({ 
        type: 'success', 
        text: `Price for ${bandName} updated to ₹${editPriceInput.toLocaleString('en-IN')}. Row and seat tiers updated!` 
      });
      setEditingPriceBand(null);
    } else {
      setStatusMessage({ type: 'error', text: res.error || 'Failed to update band price.' });
    }
  };

  const handleCreateBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setStatusMessage(null);

    const res = await createProtectedBlock(blockLabel, blockCount, blockBandId);
    setIsLoading(false);

    if (res.success) {
      const bandName = bands.find(b => b.id === blockBandId)?.label || blockBandId;
      setStatusMessage({ 
        type: 'success', 
        text: `Protected block "${blockLabel}" (${blockCount} seats) reserved from ${bandName}.` 
      });
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
      setStatusMessage({ type: 'success', text: 'Protected block released into sellable inventory!' });
      setReleasingBlockId(null);
    } else {
      setStatusMessage({ type: 'error', text: res.error || 'Failed to release block.' });
    }
  };

  const handleDeleteBlock = async (blockId: string) => {
    if (!confirm('Are you sure you want to remove this protected block? Any unreleased seats will be restored to their original price band.')) {
      return;
    }

    setIsLoading(true);
    setStatusMessage(null);

    const res = await deleteProtectedBlock(blockId);
    setIsLoading(false);

    if (res.success) {
      setStatusMessage({ type: 'success', text: 'Protected block deleted and quota restored to price band.' });
    } else {
      setStatusMessage({ type: 'error', text: res.error || 'Failed to delete block.' });
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
        text: `Successfully updated ${res.count} row(s) in ${assignSection} (${assignFromRow} to ${assignToRow}) to ₹${assignTier.toLocaleString('en-IN')}.`,
      });
      setShowRowAssigner(false);
    } else {
      setStatusMessage({ type: 'error', text: res.error || 'Failed to update row tiers.' });
    }
  };

  const handleAssignRowToBand = async (rowId: string, tier: number) => {
    setIsLoading(true);
    setStatusMessage(null);
    const res = await assignRowToBand(rowId, tier);
    setIsLoading(false);
    if (res.success) {
      setStatusMessage({ 
        type: 'success', 
        text: `Row assigned to ₹${tier.toLocaleString('en-IN')}. Band quotas updated!` 
      });
    } else {
      setStatusMessage({ type: 'error', text: res.error || 'Failed to assign row.' });
    }
  };

  const handleToggleRowBlock = async (section: SeatSection, rowLabel: string, currentlyBlocked: boolean) => {
    setIsLoading(true);
    setStatusMessage(null);
    const res = currentlyBlocked 
      ? await unblockRow(section, rowLabel)
      : await blockRow(section, rowLabel, 'VIP / Reserved');
    setIsLoading(false);
    if (res.success) {
      setStatusMessage({ 
        type: 'success', 
        text: currentlyBlocked 
          ? `Row ${rowLabel} (${section}) unblocked and released to sellable inventory.` 
          : `Row ${rowLabel} (${section}) blocked as Reserved.` 
      });
    } else {
      setStatusMessage({ type: 'error', text: res.error || 'Failed to toggle row block.' });
    }
  };

  const handleRecalibrateCapacity = async () => {
    if (!confirm('Recalibrate band allocations to exact 1,398 venue capacity?')) {
      return;
    }

    setIsLoading(true);
    setStatusMessage(null);

    const res = await recalibrateBandsToVenueCapacity();
    setIsLoading(false);

    if (res.success) {
      setStatusMessage({
        type: 'success',
        text: 'Band capacities recalibrated to exact 1,398 sellable seats.',
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
          1. CLEAN CAPACITY BANNER (Decluttered, Simple, Direct)
      ───────────────────────────────────────────────────────────── */}
      <div className="p-5 bg-gradient-to-r from-[#131F2E] via-[#162538] to-[#131F2E] border border-slate-800 rounded-2xl shadow-lg space-y-4">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                Venue Seating Blueprint
              </span>
              <span className="text-xs text-slate-400">The Music Academy, Madras</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white mt-1">
              Bands & Protected Quotas
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 mt-0.5">
              Sellable Capacity: <strong className="text-white font-mono">1,398 Seats</strong> (GF 648 + Balcony 750) + <strong className="text-purple-300 font-mono">50 VIP Box Seats</strong>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            {totalAllocated !== 1398 && (
              <Button
                onClick={handleRecalibrateCapacity}
                disabled={isLoading}
                className="bg-amber-500 hover:bg-[#D97706] text-slate-950 font-bold rounded-xl h-9 px-3 text-xs flex items-center gap-1.5 shadow-md"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Align to 1,398
              </Button>
            )}

            <Button
              onClick={() => setShowRowAssigner(!showRowAssigner)}
              className="bg-[#1A2839] hover:bg-[#223345] border border-slate-700 text-slate-200 font-bold rounded-xl h-9 px-3 text-xs flex items-center gap-1.5"
            >
              <Sliders className="w-3.5 h-3.5 text-amber-400" />
              Assign Row Tiers
            </Button>

            <Button
              onClick={() => setShowBlockModal(true)}
              className="bg-[#1A2839] hover:bg-[#223345] border border-slate-700 text-white font-bold rounded-xl h-9 px-3 text-xs flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5 text-[#E8913A]" />
              Earmark Block
            </Button>

            <a
              href="/api/admin/backup"
              download
              className="inline-flex items-center gap-1.5 bg-[#1A2839] hover:bg-[#223345] border border-slate-700 text-slate-200 font-bold rounded-xl h-9 px-3 text-xs"
              title="Download full JSON snapshot of database tables"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              Backup Data
            </a>
          </div>
        </div>

        {/* Live Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-800">
          <div className="p-3 bg-[#0E1722] rounded-xl border border-slate-800">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Sellable Capacity</p>
            <p className="text-xl font-black text-white mt-0.5 font-mono">1,398</p>
          </div>

          <div className="p-3 bg-[#0E1722] rounded-xl border border-purple-900/40">
            <p className="text-[11px] font-bold text-purple-300 uppercase tracking-wider flex items-center gap-1">
              <Crown className="w-3 h-3 text-purple-400" /> VIP Box (Fixed)
            </p>
            <p className="text-xl font-black text-purple-300 mt-0.5 font-mono">50</p>
          </div>

          <div className="p-3 bg-[#0E1722] rounded-xl border border-slate-800">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Band Quotas</p>
            <p className={`text-xl font-black mt-0.5 font-mono ${totalAllocated === 1398 ? 'text-emerald-400' : 'text-amber-400'}`}>
              {totalAllocated} <span className="text-xs font-normal text-slate-400">/ 1,398</span>
            </p>
          </div>

          <div className="p-3 bg-[#0E1722] rounded-xl border border-slate-800">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Passes Sold</p>
            <p className="text-xl font-black text-[#E8913A] mt-0.5 font-mono">
              {totalSold} <span className="text-xs font-normal text-slate-400">({totalRemaining} Open)</span>
            </p>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. COLLAPSIBLE FORM: BULK ASSIGN ROW TIERS
      ───────────────────────────────────────────────────────────── */}
      {showRowAssigner && (
        <form onSubmit={handleApplyRowTier} className="p-5 bg-[#131F2E] border border-amber-500/40 rounded-2xl space-y-4 shadow-xl">
          <div className="flex justify-between items-center pb-2 border-b border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Sliders className="w-4 h-4 text-[#E8913A]" /> Assign Pricing Tier to Row Range
              </h3>
              <p className="text-xs text-slate-400">
                Bulk reassign price tiers across a range of rows. Updates blueprint map and band quotas live.
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
              <Label className="text-xs font-bold text-slate-300">Section</Label>
              <select
                value={assignSection}
                onChange={(e) => setAssignSection(e.target.value as SeatSection)}
                className="w-full h-9 bg-[#1A2839] border border-slate-700 text-white rounded-xl px-3 text-xs font-bold"
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
                className="w-full h-9 bg-[#1A2839] border border-slate-700 text-white rounded-xl px-3 text-xs font-mono font-bold"
              >
                {rowLetters.map((r) => (
                  <option key={r} value={r}>Row {r}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-300">To Row</Label>
              <select
                value={assignToRow}
                onChange={(e) => setAssignToRow(e.target.value)}
                className="w-full h-9 bg-[#1A2839] border border-slate-700 text-white rounded-xl px-3 text-xs font-mono font-bold"
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
                className="w-full h-9 bg-[#1A2839] border border-slate-700 text-white rounded-xl px-3 text-xs font-bold"
              >
                {bands.map((b) => (
                  <option key={b.id} value={b.price}>
                    ₹{b.price.toLocaleString('en-IN')} ({b.label})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowRowAssigner(false)}
              className="bg-[#1A2839] border-slate-700 text-white rounded-xl text-xs h-8"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="bg-[#E8913A] hover:bg-[#D97706] text-slate-950 font-bold rounded-xl text-xs h-8"
            >
              {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
              Apply Tier
            </Button>
          </div>
        </form>
      )}

      {/* ─────────────────────────────────────────────────────────────
          3. NAVIGATION TABS (Simple & Accessible)
      ───────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('blueprint')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs sm:text-sm transition-all ${
            activeTab === 'blueprint'
              ? 'bg-[#E8913A] text-slate-950 shadow-md'
              : 'bg-[#131F2E] text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <MapPin className="w-4 h-4" />
          Blueprint Map
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('bands')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs sm:text-sm transition-all ${
            activeTab === 'bands'
              ? 'bg-[#E8913A] text-slate-950 shadow-md'
              : 'bg-[#131F2E] text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          Price Bands ({bands.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('protected')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs sm:text-sm transition-all ${
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
          <SeatMap 
            seats={seats} 
            bands={bands}
            rows={rows} 
            enableSeatBlocking={true}
            onBlockSeats={blockExactSeats}
            onUnblockSeats={unblockExactSeats}
            onBlockRow={blockRow}
            onUnblockRow={unblockRow}
          />
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          5. TAB 2: PRICE BANDS INVENTORY (Editable Prices & Matrix)
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'bands' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {bands.map((b) => {
              return (
                <Card key={b.id} className="bg-[#131F2E] border border-slate-800 rounded-2xl overflow-hidden shadow-md hover:border-slate-700 transition-colors">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-base font-bold text-white">{b.label.split('(')[0].trim()}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xl font-black text-[#E8913A] font-mono">
                            ₹{b.price.toLocaleString('en-IN')}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleStartEditPrice(b)}
                            className="p-1 rounded-md bg-slate-800/80 hover:bg-amber-500/20 text-slate-400 hover:text-amber-300 transition-colors"
                            title="Edit band price"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-800 text-slate-300 font-mono">
                        {b.total_allocated} seats
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-slate-800/80 text-center text-xs">
                      <div className="p-1.5 bg-slate-900/50 rounded-lg">
                        <div className="text-[10px] text-slate-400 uppercase">Allocated</div>
                        <div className="font-bold text-white font-mono mt-0.5">{b.total_allocated}</div>
                      </div>
                      <div className="p-1.5 bg-slate-900/50 rounded-lg">
                        <div className="text-[10px] text-slate-400 uppercase">Sold</div>
                        <div className="font-bold text-[#E8913A] font-mono mt-0.5">{b.sold_count}</div>
                      </div>
                      <div className="p-1.5 bg-slate-900/50 rounded-lg">
                        <div className="text-[10px] text-slate-400 uppercase">Open</div>
                        <div className="font-bold text-emerald-400 font-mono mt-0.5">{b.remaining_count}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Row-to-Band Allocation & Row Blocking Matrix */}
          <div className="bg-[#131F2E] border border-slate-800 rounded-2xl p-5 space-y-4 shadow-lg">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-800">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-amber-400" />
                  Row Pricing & Blocking Matrix
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Change price band per row or block whole rows from being sold.
                </p>
              </div>

              <div className="inline-flex p-1 bg-[#0E1722] rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setMatrixSection('Ground Floor')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    matrixSection === 'Ground Floor'
                      ? 'bg-[#E8913A] text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Ground Floor (648)
                </button>
                <button
                  type="button"
                  onClick={() => setMatrixSection('Balcony')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    matrixSection === 'Balcony'
                      ? 'bg-[#E8913A] text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Balcony (750)
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 bg-slate-900/40">
                    <th className="p-2.5">Row</th>
                    <th className="p-2.5">Seats</th>
                    <th className="p-2.5">Price Tier</th>
                    <th className="p-2.5">Breakdown</th>
                    <th className="p-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-200">
                  {rows
                    .filter((r) => r.section === matrixSection && r.row_label !== 'SPL VIP')
                    .sort((a, b) => a.display_order - b.display_order)
                    .map((r) => {
                      const rowSeats = seats.filter(
                        (s) => s.section === r.section && s.row_label === r.row_label && s.row_label !== 'SPL VIP'
                      );
                      const blockedCount = rowSeats.filter((s) => s.is_blocked).length;
                      const soldCount = rowSeats.filter((s) => (s.payment_status || '').toLowerCase() === 'received' || s.guest_name).length;
                      const availableCount = rowSeats.length - blockedCount - soldCount;
                      const isRowFullyBlocked = rowSeats.length > 0 && blockedCount === rowSeats.length;

                      return (
                        <tr key={r.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="p-2.5 font-mono font-bold text-amber-400">
                            Row {r.row_label}
                          </td>
                          <td className="p-2.5 font-mono text-slate-300">
                            {r.seat_count || rowSeats.length}
                          </td>
                          <td className="p-2.5">
                            <select
                              value={r.tier || 5000}
                              disabled={isLoading}
                              onChange={(e) => handleAssignRowToBand(r.id, Number(e.target.value))}
                              className="bg-[#1A2839] border border-slate-700 text-white rounded-lg px-2 py-1 text-xs font-bold cursor-pointer"
                            >
                              {bands.map((b) => (
                                <option key={b.id} value={b.price}>
                                  ₹{b.price.toLocaleString('en-IN')} ({b.label.split('(')[0].trim()})
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="p-2.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 font-mono">
                                {availableCount} Open
                              </span>
                              {blockedCount > 0 && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-850 font-mono">
                                  {blockedCount} Blocked
                                </span>
                              )}
                              {soldCount > 0 && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-850 font-mono">
                                  {soldCount} Sold
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-2.5 text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={isLoading || (soldCount > 0 && !isRowFullyBlocked)}
                              onClick={() => handleToggleRowBlock(r.section, r.row_label, isRowFullyBlocked)}
                              className={`h-7 px-2 text-xs font-bold rounded-lg ${
                                isRowFullyBlocked
                                  ? 'bg-emerald-950 text-emerald-300 border-emerald-800 hover:bg-emerald-900'
                                  : 'bg-rose-950/60 text-rose-300 border-rose-800 hover:bg-rose-900'
                              }`}
                              title={soldCount > 0 && !isRowFullyBlocked ? 'Cannot block row with sold passes' : undefined}
                            >
                              {isRowFullyBlocked ? '🔓 Unblock' : '🔒 Block'}
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          6. TAB 3: PROTECTED & EARMARKED BLOCKS (Clean & Concise)
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'protected' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Shield className="w-5 h-5 text-amber-500" /> Protected & Reserved Blocks
              </h3>
              <p className="text-xs text-slate-400">
                Earmarked blocks for VIPs, Sponsors, and Officials. Deducts from price band quotas and can be released anytime.
              </p>
            </div>
            <Button
              onClick={() => setShowBlockModal(true)}
              className="bg-[#1A2839] hover:bg-[#223345] border border-slate-700 text-white font-bold h-9 px-3 rounded-xl text-xs flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5 text-[#E8913A]" /> Earmark Block
            </Button>
          </div>

          {/* List of Protected Blocks */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {protectedBlocks.length === 0 ? (
              <div className="col-span-2 p-8 text-center bg-[#131F2E] border border-slate-800 rounded-2xl text-slate-400 text-xs">
                No earmarked protected blocks. Click &quot;Earmark Block&quot; to reserve seats for VIPs, Sponsors, or Dignitaries.
              </div>
            ) : (
              protectedBlocks.map((block) => {
                const assignedBand = bands.find((b) => b.id === (block.band_id || block.released_to_band_id));
                const isReleased = Boolean(block.released_to_band_id);

                return (
                  <Card key={block.id} className="bg-[#131F2E] border border-slate-800 rounded-2xl shadow-md">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-base font-bold text-white">{block.label}</h4>
                            {assignedBand && (
                              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                {assignedBand.label}
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-slate-400 font-mono mt-1 block">
                            {block.seat_count} seats reserved
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          {isReleased ? (
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-950 text-emerald-400 border border-emerald-800">
                              Released
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-950 text-amber-300 border border-amber-800">
                              Locked
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteBlock(block.id)}
                            className="p-1 rounded-md text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition-colors"
                            title="Delete block (restores seats to band)"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {!isReleased ? (
                        <div className="pt-2 border-t border-slate-800 space-y-2">
                          {releasingBlockId === block.id ? (
                            <div className="space-y-2 p-3 bg-slate-900 rounded-xl border border-amber-500/30">
                              <Label className="text-xs text-slate-300">Release into Sellable Band:</Label>
                              <select
                                value={targetBandId}
                                onChange={(e) => setTargetBandId(e.target.value)}
                                className="w-full h-8 bg-[#1A2839] border border-slate-700 text-white rounded-lg px-2 text-xs"
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
                                setTargetBandId(block.band_id || bands[0]?.id || '');
                              }}
                              className="w-full bg-[#1A2839] border-slate-700 text-slate-300 hover:text-white rounded-xl text-xs h-8"
                            >
                              <ArrowRight className="w-3 h-3 mr-1" /> Release to Public Band
                            </Button>
                          )}
                        </div>
                      ) : (
                        <p className="text-[11px] text-slate-400 italic pt-1">
                          Released into sellable inventory on {new Date(block.updated_at || block.created_at || '').toLocaleDateString('en-IN')}.
                        </p>
                      )}
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          7. MODAL: EDIT PRICE FOR A BAND
      ───────────────────────────────────────────────────────────── */}
      {editingPriceBand && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <form onSubmit={handleSaveBandPrice} className="w-full max-w-md p-6 bg-[#131F2E] border border-slate-700 rounded-2xl space-y-4 shadow-2xl">
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Pencil className="w-4 h-4 text-[#E8913A]" />
                Edit Price: {editingPriceBand.label.split('(')[0].trim()}
              </h3>
              <button
                type="button"
                onClick={() => setEditingPriceBand(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-300">Ticket Price (₹)</Label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-slate-400 text-sm font-bold">₹</span>
                <Input
                  type="number"
                  min="1"
                  step="50"
                  value={editPriceInput}
                  onChange={(e) => setEditPriceInput(Number(e.target.value))}
                  className="pl-8 h-10 bg-[#1A2839] border-slate-700 text-white rounded-xl font-mono text-base font-bold"
                  required
                />
              </div>
              <p className="text-[11px] text-slate-400">
                Updating this price will update the band name, associated row pricing, and seat tiers automatically.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setEditingPriceBand(null)}
                className="text-slate-400 hover:text-white text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading || editPriceInput <= 0}
                className="bg-[#E8913A] hover:bg-[#D97706] text-slate-950 font-bold rounded-xl text-xs"
              >
                {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                Save New Price
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          8. MODAL: EARMARK NEW PROTECTED BLOCK
      ───────────────────────────────────────────────────────────── */}
      {showBlockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <form onSubmit={handleCreateBlock} className="w-full max-w-md p-6 bg-[#131F2E] border border-slate-700 rounded-2xl space-y-4 shadow-2xl">
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Shield className="w-4 h-4 text-amber-400" />
                Earmark Protected Block
              </h3>
              <button
                type="button"
                onClick={() => setShowBlockModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-300">Category / Label *</Label>
                <Input
                  placeholder="e.g. VIP Dignitaries / Police Officers"
                  value={blockLabel}
                  onChange={(e) => setBlockLabel(e.target.value)}
                  className="h-10 bg-[#1A2839] border-slate-700 text-white rounded-xl text-xs"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-300">Deduct from Price Band *</Label>
                <select
                  value={blockBandId}
                  onChange={(e) => setBlockBandId(e.target.value)}
                  className="w-full h-10 bg-[#1A2839] border border-slate-700 text-white rounded-xl px-3 text-xs font-bold cursor-pointer"
                >
                  {bands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.label} — {b.remaining_count ?? b.total_allocated} seats available
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-300">Number of Seats *</Label>
                <Input
                  type="number"
                  min="1"
                  max={bands.find((b) => b.id === blockBandId)?.total_allocated || 500}
                  value={blockCount}
                  onChange={(e) => setBlockCount(Number(e.target.value))}
                  className="h-10 bg-[#1A2839] border-slate-700 text-white rounded-xl font-mono text-sm"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowBlockModal(false)}
                className="text-slate-400 hover:text-white text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading || !blockLabel.trim() || blockCount < 1}
                className="bg-[#E8913A] hover:bg-[#D97706] text-slate-950 font-bold rounded-xl text-xs"
              >
                {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                Create Block
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
