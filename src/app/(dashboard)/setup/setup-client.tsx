'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Band, ReservedPool, ReservedEntry } from '@/lib/types';
import { formatINR, BANDS_CONFIG } from '@/lib/constants';
import { 
  updateBandCapacity, 
  updateBandPrice, 
  updateReservedPool, 
  saveReservedEntry, 
  deleteReservedEntry 
} from './actions';
import { toast } from 'sonner';
import { 
  Layers, 
  Users, 
  ShieldCheck, 
  DollarSign, 
  Edit3, 
  Save, 
  Plus, 
  Trash2, 
  ChevronDown, 
  ChevronUp,
  AlertCircle,
  Sparkles,
  Ticket,
  CheckCircle2
} from 'lucide-react';

interface SetupClientProps {
  initialBands: Band[];
  initialPools: (ReservedPool & { entries: ReservedEntry[] })[];
  userRole: string;
}

export function SetupClient({ initialBands, initialPools, userRole }: SetupClientProps) {
  const [bands, setBands] = useState<Band[]>(initialBands);
  const [pools, setPools] = useState(initialPools);
  
  // Band editing state
  const [editingBandId, setEditingBandId] = useState<string | null>(null);
  const [editCapacity, setEditCapacity] = useState<number>(0);
  const [editPrice, setEditPrice] = useState<number>(0);
  const [isSavingBand, setIsSavingBand] = useState(false);

  // Pool editing state
  const [editingPoolId, setEditingPoolId] = useState<string | null>(null);
  const [editPoolCount, setEditPoolCount] = useState<number>(0);
  const [expandedPoolId, setExpandedPoolId] = useState<string | null>(null);
  const [newEntryName, setNewEntryName] = useState('');
  const [newEntryNotes, setNewEntryNotes] = useState('');
  const [isSavingPool, setIsSavingPool] = useState(false);

  // Calculate live overall stats
  const totalCapacity = bands.reduce((acc, b) => acc + (b.total_capacity || 0), 0);
  const totalSold = bands.reduce((acc, b) => acc + (b.sold_count || 0), 0);
  const totalRemaining = Math.max(0, totalCapacity - totalSold);
  const totalPotential = bands.reduce((acc, b) => acc + (b.total_capacity * b.standard_price), 0);
  const totalCollected = bands.reduce((acc, b) => acc + (b.collected_amount || 0), 0);
  const totalPending = bands.reduce((acc, b) => acc + (b.pending_amount || 0), 0);
  const totalReserved = pools.reduce((acc, p) => acc + (p.total_count || 0), 0);

  const startEditBand = (band: Band) => {
    setEditingBandId(band.id);
    setEditCapacity(band.total_capacity);
    setEditPrice(band.standard_price);
  };

  const handleSaveBand = async (bandId: string) => {
    setIsSavingBand(true);
    try {
      const band = bands.find(b => b.id === bandId);
      if (!band) return;

      if (editCapacity !== band.total_capacity) {
        const res = await updateBandCapacity(bandId, Number(editCapacity));
        if (!res.success) {
          toast.error(res.error || 'Failed to update capacity');
          setIsSavingBand(false);
          return;
        }
      }

      if (editPrice !== band.standard_price) {
        const res = await updateBandPrice(bandId, Number(editPrice));
        if (!res.success) {
          toast.error(res.error || 'Failed to update price');
          setIsSavingBand(false);
          return;
        }
      }

      // Update local state
      setBands(prev => prev.map(b => {
        if (b.id === bandId) {
          const newSold = b.sold_count || 0;
          return {
            ...b,
            total_capacity: Number(editCapacity),
            standard_price: Number(editPrice),
            remaining_count: Math.max(0, Number(editCapacity) - newSold)
          };
        }
        return b;
      }));

      toast.success('Band capacity & pricing updated successfully');
      setEditingBandId(null);
    } catch (err: any) {
      toast.error(err.message || 'Error saving band');
    } finally {
      setIsSavingBand(false);
    }
  };

  const handleSavePool = async (poolId: string) => {
    setIsSavingPool(true);
    try {
      const res = await updateReservedPool(poolId, Number(editPoolCount));
      if (!res.success) {
        toast.error(res.error || 'Failed to update pool count');
        return;
      }

      setPools(prev => prev.map(p => p.id === poolId ? { ...p, total_count: Number(editPoolCount) } : p));
      toast.success('Reserved pool count updated');
      setEditingPoolId(null);
    } catch (err: any) {
      toast.error(err.message || 'Error saving pool');
    } finally {
      setIsSavingPool(false);
    }
  };

  const handleAddEntry = async (poolId: string) => {
    if (!newEntryName.trim()) {
      toast.error('Please enter a guest name');
      return;
    }

    try {
      const res = await saveReservedEntry(poolId, null, newEntryName, newEntryNotes);
      if (!res.success) {
        toast.error(res.error || 'Failed to add reserved entry');
        return;
      }

      setPools(prev => prev.map(p => {
        if (p.id === poolId) {
          const newEntry: ReservedEntry = {
            id: `temp-${Date.now()}`,
            pool_id: poolId,
            name: newEntryName.trim(),
            notes: newEntryNotes.trim() || null,
          };
          return { ...p, entries: [...(p.entries || []), newEntry] };
        }
        return p;
      }));

      setNewEntryName('');
      setNewEntryNotes('');
      toast.success('Reserved guest name saved');
    } catch (err: any) {
      toast.error(err.message || 'Error adding entry');
    }
  };

  const handleDeleteEntry = async (poolId: string, entryId: string) => {
    try {
      const res = await deleteReservedEntry(entryId);
      if (!res.success) {
        toast.error(res.error || 'Failed to delete entry');
        return;
      }

      setPools(prev => prev.map(p => {
        if (p.id === poolId) {
          return { ...p, entries: (p.entries || []).filter(e => e.id !== entryId) };
        }
        return p;
      }));

      toast.success('Entry removed');
    } catch (err: any) {
      toast.error('Error removing entry');
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-16">
      {/* 1. Top Summary Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-[#131F2E] p-4 rounded-2xl border border-[#223345] shadow-md">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Band Capacity</span>
          <span className="text-xl font-extrabold text-white mt-1 block font-mono">{totalCapacity.toLocaleString()}</span>
          <span className="text-[10px] text-slate-500 block mt-0.5">Commercial seats</span>
        </div>

        <div className="bg-[#131F2E] p-4 rounded-2xl border border-[#223345] shadow-md">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Sold</span>
          <span className="text-xl font-extrabold text-[#E8913A] mt-1 block font-mono">{totalSold.toLocaleString()}</span>
          <span className="text-[10px] text-slate-500 block mt-0.5">{totalCapacity > 0 ? `${Math.round((totalSold / totalCapacity) * 100)}% sold` : '0%'}</span>
        </div>

        <div className="bg-[#131F2E] p-4 rounded-2xl border border-[#223345] shadow-md">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Remaining Available</span>
          <span className="text-xl font-extrabold text-sky-400 mt-1 block font-mono">{totalRemaining.toLocaleString()}</span>
          <span className="text-[10px] text-slate-500 block mt-0.5">Available for sale</span>
        </div>

        <div className="bg-[#131F2E] p-4 rounded-2xl border border-[#223345] shadow-md">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Collected</span>
          <span className="text-xl font-extrabold text-emerald-400 mt-1 block font-mono">{formatINR(totalCollected)}</span>
          <span className="text-[10px] text-emerald-500/80 block mt-0.5">Confirmed revenue</span>
        </div>

        <div className="bg-[#131F2E] p-4 rounded-2xl border border-[#223345] shadow-md">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Pending Payment</span>
          <span className="text-xl font-extrabold text-amber-400 mt-1 block font-mono">{formatINR(totalPending)}</span>
          <span className="text-[10px] text-amber-500/80 block mt-0.5">To be collected</span>
        </div>

        <div className="bg-[#131F2E] p-4 rounded-2xl border border-[#223345] shadow-md">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Reserved Pools</span>
          <span className="text-xl font-extrabold text-purple-400 mt-1 block font-mono">{totalReserved.toLocaleString()}</span>
          <span className="text-[10px] text-purple-400/80 block mt-0.5">VIP & staff set-aside</span>
        </div>
      </div>

      {/* 2. SECTION: 4 PRICE BANDS */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-[#E8913A]" />
              <span>4 Price Bands Configuration</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Set total capacity and standard pricing per band. Hard limits block sales when remaining count reaches 0.
            </p>
          </div>
          <Badge variant="outline" className="text-xs border-[#223345] bg-[#131F2E] text-slate-300">
            Authorized: {userRole === 'system_admin' ? 'System Admin' : 'Super Admin'}
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {bands.map((band) => {
            const isEditing = editingBandId === band.id;
            const sold = band.sold_count || 0;
            const cap = band.total_capacity || 0;
            const rem = band.remaining_count || Math.max(0, cap - sold);
            const occupancy = cap > 0 ? Math.min(100, Math.round((sold / cap) * 100)) : 0;
            const config = BANDS_CONFIG.find(c => c.id === band.id);

            return (
              <Card key={band.id} className="bg-[#131F2E] border-[#223345] rounded-2xl shadow-xl overflow-hidden">
                <CardHeader className="bg-[#0E1724] pb-3 border-b border-[#223345]">
                  <div className="flex items-center justify-between">
                    <Badge className={`${config?.bgColor || 'bg-amber-500/10'} ${config?.textColor || 'text-amber-400'} border ${config?.borderColor || 'border-amber-500/30'} text-xs font-bold font-mono`}>
                      {band.name}
                    </Badge>
                    <span className="text-sm font-black font-mono text-white">
                      {formatINR(band.standard_price)} / seat
                    </span>
                  </div>
                </CardHeader>

                <CardContent className="p-5 space-y-4">
                  {isEditing ? (
                    /* Edit Mode */
                    <div className="space-y-4 animate-in fade-in duration-150">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold uppercase text-slate-400">Total Capacity</label>
                          <Input
                            type="number"
                            min={sold}
                            value={editCapacity}
                            onChange={(e) => setEditCapacity(parseInt(e.target.value) || 0)}
                            className="bg-[#1A2839] border-[#2A3F55] text-white font-mono text-sm h-10"
                          />
                          <span className="text-[10px] text-slate-500">Min: {sold} (already sold)</span>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[11px] font-bold uppercase text-slate-400">Standard Price (₹)</label>
                          <Input
                            type="number"
                            min={1}
                            value={editPrice}
                            onChange={(e) => setEditPrice(parseInt(e.target.value) || 0)}
                            className="bg-[#1A2839] border-[#2A3F55] text-white font-mono text-sm h-10"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <Button
                          size="sm"
                          disabled={isSavingBand}
                          onClick={() => handleSaveBand(band.id)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-9 flex-1 gap-1.5"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>{isSavingBand ? 'Saving...' : 'Save Band Settings'}</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isSavingBand}
                          onClick={() => setEditingBandId(null)}
                          className="bg-[#1A2839] border-[#2A3F55] text-slate-300 text-xs h-9"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    /* View Mode */
                    <div className="space-y-3.5">
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="p-2.5 bg-[#0F1A26] rounded-xl border border-[#24364A]">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Capacity</span>
                          <span className="text-base font-extrabold text-white font-mono">{cap}</span>
                        </div>
                        <div className="p-2.5 bg-[#0F1A26] rounded-xl border border-[#24364A]">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Sold</span>
                          <span className="text-base font-extrabold text-[#E8913A] font-mono">{sold}</span>
                        </div>
                        <div className="p-2.5 bg-[#0F1A26] rounded-xl border border-[#24364A]">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Remaining</span>
                          <span className="text-base font-extrabold text-sky-400 font-mono">{rem}</span>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-400 font-medium">Occupancy</span>
                          <span className="font-bold text-white">{occupancy}%</span>
                        </div>
                        <div className="w-full bg-[#1A2839] rounded-full h-2.5 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{ 
                              width: `${occupancy}%`,
                              backgroundColor: config?.color || '#F59E0B'
                            }}
                          />
                        </div>
                      </div>

                      {/* Financials breakdown */}
                      <div className="flex items-center justify-between text-xs pt-1 border-t border-[#223345] text-slate-400">
                        <span>Collected: <strong className="text-emerald-400">{formatINR(band.collected_amount || 0)}</strong></span>
                        <span>Pending: <strong className="text-amber-400">{formatINR(band.pending_amount || 0)}</strong></span>
                      </div>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => startEditBand(band)}
                        className="w-full bg-[#1A2839] hover:bg-[#24364A] text-slate-200 text-xs border-[#2A3F55] h-8 gap-1.5"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-slate-400" />
                        <span>Edit Capacity & Standard Price</span>
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* 3. SECTION: RESERVED POOLS */}
      <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-400" />
            <span>Reserved Pools (VIP, PP, Staff & Other)</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Set aside complimentary quotas for dignitaries and event guests. Fill in guest names anytime once confirmed.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {pools.map((pool) => {
            const isEditing = editingPoolId === pool.id;
            const isExpanded = expandedPoolId === pool.id;
            const entriesCount = pool.entries?.length || 0;

            return (
              <Card key={pool.id} className="bg-[#131F2E] border-[#223345] rounded-2xl shadow-xl overflow-hidden">
                <CardHeader className="bg-[#0E1724] pb-3 border-b border-[#223345]">
                  <div className="flex items-center justify-between">
                    <Badge className="bg-purple-950/80 text-purple-300 border border-purple-700 text-xs font-bold">
                      {pool.name}
                    </Badge>
                    <span className="text-xs text-slate-400 font-mono font-bold">
                      {entriesCount} / {pool.total_count} Named
                    </span>
                  </div>
                </CardHeader>

                <CardContent className="p-5 space-y-4">
                  {isEditing ? (
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold uppercase text-slate-400">Total Quota Count</label>
                        <Input
                          type="number"
                          min={0}
                          value={editPoolCount}
                          onChange={(e) => setEditPoolCount(parseInt(e.target.value) || 0)}
                          className="bg-[#1A2839] border-[#2A3F55] text-white font-mono text-sm h-10"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          disabled={isSavingPool}
                          onClick={() => handleSavePool(pool.id)}
                          className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs h-9 flex-1"
                        >
                          {isSavingPool ? 'Saving...' : 'Save Quota'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingPoolId(null)}
                          className="bg-[#1A2839] border-[#2A3F55] text-slate-300 text-xs h-9"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <span className="text-2xl font-black font-mono text-white">{pool.total_count}</span>
                        <span className="text-xs text-slate-400 block">Total set-aside seats</span>
                      </div>
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={() => {
                          setEditingPoolId(pool.id);
                          setEditPoolCount(pool.total_count);
                        }}
                        className="bg-[#1A2839] border-[#2A3F55] text-slate-300 text-xs"
                      >
                        Edit Quota
                      </Button>
                    </div>
                  )}

                  {/* Expand/Collapse Entries */}
                  <div className="pt-2 border-t border-[#223345]">
                    <button
                      type="button"
                      onClick={() => setExpandedPoolId(isExpanded ? null : pool.id)}
                      className="w-full flex items-center justify-between text-xs font-bold text-slate-300 hover:text-white py-1 transition-colors"
                    >
                      <span>Manage Guest Names ({entriesCount})</span>
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>

                    {isExpanded && (
                      <div className="mt-3 space-y-3 pt-2">
                        {/* Add Name Input */}
                        <div className="space-y-2 bg-[#0E1724] p-3 rounded-xl border border-[#24364A]">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Add Reserved Guest</span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <Input
                              placeholder="Dignitary / Guest Name"
                              value={newEntryName}
                              onChange={(e) => setNewEntryName(e.target.value)}
                              className="bg-[#1A2839] border-[#2A3F55] text-white text-xs h-8"
                            />
                            <Input
                              placeholder="Notes (e.g. Chief Guest)"
                              value={newEntryNotes}
                              onChange={(e) => setNewEntryNotes(e.target.value)}
                              className="bg-[#1A2839] border-[#2A3F55] text-white text-xs h-8"
                            />
                          </div>
                          <Button
                            size="xs"
                            onClick={() => handleAddEntry(pool.id)}
                            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs h-8 gap-1 mt-1"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Save Guest Name</span>
                          </Button>
                        </div>

                        {/* List of Entries */}
                        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                          {(pool.entries || []).length === 0 ? (
                            <p className="text-[11px] text-slate-500 text-center py-2">
                              No guest names recorded yet. Blank quota preserved.
                            </p>
                          ) : (
                            pool.entries.map((entry) => (
                              <div 
                                key={entry.id} 
                                className="flex items-center justify-between p-2 rounded-lg bg-[#0F1A26] border border-[#24364A] text-xs"
                              >
                                <div>
                                  <span className="font-bold text-white block">{entry.name}</span>
                                  {entry.notes && <span className="text-[10px] text-slate-400 block">{entry.notes}</span>}
                                </div>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => handleDeleteEntry(pool.id, entry.id)}
                                  className="h-6 w-6 text-slate-500 hover:text-red-400"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
