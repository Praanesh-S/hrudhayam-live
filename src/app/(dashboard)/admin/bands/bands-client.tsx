'use client';

import { useState } from 'react';
import { Band, ProtectedBlock } from '@/lib/types';
import { AuthUser } from '@/lib/auth/session';
import { updateBandAllocation, createProtectedBlock, releaseProtectedBlock } from '../actions';
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
  ArrowRight
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface BandsClientProps {
  bands: Band[];
  protectedBlocks: ProtectedBlock[];
  currentUser: AuthUser;
}

export function BandsClient({ bands, protectedBlocks }: BandsClientProps) {
  // Editing band allocation
  const [editingBandId, setEditingBandId] = useState<string | null>(null);
  const [newAllocation, setNewAllocation] = useState<number>(0);
  const [newPrice, setNewPrice] = useState<number>(0);

  // New protected block
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [blockLabel, setBlockLabel] = useState('');
  const [blockCount, setBlockCount] = useState(10);

  // Releasing block
  const [releasingBlockId, setReleasingBlockId] = useState<string | null>(null);
  const [targetBandId, setTargetBandId] = useState<string>(bands[0]?.id || '');

  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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

  return (
    <div className="space-y-8">
      {statusMessage && (
        <Alert className={statusMessage.type === 'success' ? 'bg-emerald-950/70 border-emerald-800 text-emerald-100' : 'bg-red-950/70 border-red-800 text-red-100'}>
          {statusMessage.type === 'success' ? <CheckCircle2 className="h-5 w-5 text-emerald-400" /> : <AlertCircle className="h-5 w-5 text-red-400" />}
          <AlertTitle className="text-base font-bold">{statusMessage.type === 'success' ? 'Success' : 'Error'}</AlertTitle>
          <AlertDescription className="text-sm">{statusMessage.text}</AlertDescription>
        </Alert>
      )}

      {/* SECTION 1: BANDS CAPACITY */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-[#E8913A]" /> Price Bands Inventory
            </h2>
            <p className="text-xs text-slate-400">
              Remaining capacity is derived live: Total Allocated - Active Passes - Active Holds.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {bands.map((b) => {
            const isEditing = editingBandId === b.id;
            const issuedCount = b.sold_count ?? 0;

            return (
              <Card key={b.id} className="bg-[#131F2E] border border-slate-800 rounded-2xl overflow-hidden">
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
                        className="bg-[#1A2839] border-slate-700 text-white hover:bg-slate-800 rounded-xl"
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
                          className="text-slate-400 hover:text-white"
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          disabled={isLoading || newAllocation < issuedCount}
                          onClick={() => handleSaveBand(b.id)}
                          className="bg-[#E8913A] hover:bg-[#D97706] text-slate-950 font-bold rounded-lg"
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

      {/* SECTION 2: PROTECTED SEATS (§10) */}
      <div className="space-y-4 pt-4 border-t border-slate-800">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Shield className="w-5 h-5 text-amber-500" /> Protected / Earmarked Blocks
            </h2>
            <p className="text-xs text-slate-400">
              Reserved blocks for VIPs, Sponsor rows, Police & Officials. Can be released into a band anytime.
            </p>
          </div>
          <Button
            onClick={() => setShowBlockModal(!showBlockModal)}
            className="bg-[#1A2839] hover:bg-[#223345] border border-slate-700 text-white font-bold h-10 px-4 rounded-xl"
          >
            <Plus className="w-4 h-4 mr-1 text-[#E8913A]" /> Earmark Block
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
                  min={1}
                  value={blockCount}
                  onChange={(e) => setBlockCount(Number(e.target.value))}
                  className="h-10 bg-[#1A2839] border-slate-700 text-white rounded-lg font-mono"
                  required
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setShowBlockModal(false)} className="text-slate-400">
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading || !blockLabel.trim()} className="bg-[#E8913A] hover:bg-[#D97706] text-slate-950 font-bold rounded-lg">
                Create Block
              </Button>
            </div>
          </form>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {protectedBlocks.length === 0 ? (
            <div className="p-8 text-center bg-[#131F2E] border border-slate-800 rounded-2xl text-slate-500 col-span-2 text-sm">
              No protected seat blocks currently earmarked.
            </div>
          ) : (
            protectedBlocks.map((block) => {
              const isReleased = !!block.released_to_band_id;
              const isReleasing = releasingBlockId === block.id;

              return (
                <div
                  key={block.id}
                  className={`p-4 rounded-xl border flex flex-col justify-between gap-3 ${
                    isReleased
                      ? 'bg-slate-900/40 border-slate-800 opacity-60'
                      : 'bg-[#131F2E] border-slate-800'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-white text-base">{block.label}</h4>
                      <span className="text-xs text-slate-400 font-mono">
                        {block.seat_count} seats {isReleased ? '• Released' : '• Reserved'}
                      </span>
                    </div>
                    {isReleased ? (
                      <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-slate-800 text-slate-400">
                        Released
                      </span>
                    ) : (
                      !isReleasing && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setReleasingBlockId(block.id)}
                          className="bg-[#1A2839] border-slate-700 text-amber-400 hover:text-white rounded-lg text-xs"
                        >
                          Release to Band
                        </Button>
                      )
                    )}
                  </div>

                  {isReleasing && (
                    <div className="p-3 bg-slate-900 border border-amber-500/30 rounded-xl space-y-2">
                      <Label className="text-xs text-slate-300">Select Band to Receive Seats</Label>
                      <select
                        value={targetBandId}
                        onChange={(e) => setTargetBandId(e.target.value)}
                        className="w-full h-9 bg-[#1A2839] border border-slate-700 text-white rounded px-2 text-xs"
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
                          className="text-xs text-slate-400 h-7"
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          disabled={isLoading}
                          onClick={() => handleReleaseBlock(block.id)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-7 text-xs rounded"
                        >
                          {isLoading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                          Confirm Release
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
