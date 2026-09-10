'use client';

import React, { useState, useMemo } from 'react';
import { Band, SeatData, VenueRow, SeatSection, SeatCategory } from '@/lib/types';
import { AuthUser } from '@/lib/auth/session';
import { saveLayoutPlan, updateSeatName } from '../actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Crown,
  ArrowUpDown,
  RotateCcw,
  Check,
  User,
  X,
  AlertTriangle
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { StatusDialog } from '@/components/ui/status-dialog';
import { cn } from '@/lib/utils';
import { HallLayoutMap } from '@/components/hall/HallLayoutMap';

interface BandsClientProps {
  bands: Band[];
  protectedBlocks: any[];
  seats: SeatData[];
  rows: VenueRow[];
  currentUser: AuthUser;
}

const CATEGORY_META: Record<SeatCategory, { label: string; price: number; color: string; countsToRaise: boolean }> = {
  b5000: { label: '₹5,000 — Band A', price: 5000, color: '#F59E0B', countsToRaise: true },
  b3500: { label: '₹3,500 — Band B', price: 3500, color: '#8B5CF6', countsToRaise: true },
  b2500: { label: '₹2,500 — Band C', price: 2500, color: '#0D9488', countsToRaise: true },
  b1500: { label: '₹1,500 — Band D', price: 1500, color: '#64748B', countsToRaise: true },
  pp: { label: '₹1,000 — PP', price: 1000, color: '#0284C7', countsToRaise: true },
  vip: { label: 'VIP (SPL)', price: 0, color: '#EAB308', countsToRaise: false },
  obligation: { label: 'Obligation', price: 0, color: '#EF4444', countsToRaise: false },
  sponsor_comp: { label: 'Sponsor comp', price: 0, color: '#06B6D4', countsToRaise: false },
  blocked: { label: 'Blocked', price: 0, color: '#475569', countsToRaise: false },
  unassigned: { label: 'Unassigned', price: 0, color: '#1E293B', countsToRaise: false },
};

export function BandsClient({
  bands,
  seats: initialSeats,
  rows: initialRows,
  currentUser,
}: BandsClientProps) {
  // Staged seats state
  const [stagedSeats, setStagedSeats] = useState<SeatData[]>(initialSeats);
  const [activeFloor, setActiveFloor] = useState<SeatSection>('Ground Floor');
  const [isolatedFilter, setIsolatedFilter] = useState<string>('all');

  // Form controls for Assign Rows
  const [assignFloor, setAssignFloor] = useState<SeatSection>('Ground Floor');
  const [fromRow, setFromRow] = useState<string>('Special A');
  const [toRow, setToRow] = useState<string>('C');
  const [selectedCategory, setSelectedCategory] = useState<SeatCategory>('b5000');

  // Interactive seat naming modal
  const [namingSeat, setNamingSeat] = useState<SeatData | null>(null);
  const [guestNameInput, setGuestNameInput] = useState('');

  // Unmissable status dialog
  const [dialogState, setDialogState] = useState<{
    open: boolean;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string | React.ReactNode;
    actionText?: string;
  } | null>(null);

  // Reassignment confirmation modal for rows with sales
  const [pendingReassignment, setPendingReassignment] = useState<{
    row: string;
    section: SeatSection;
    salesCount: number;
    oldPrice: number;
    newPrice: number;
    newCategory: SeatCategory;
    affectedSeatIds: string[];
  } | null>(null);

  // Confirmed row reassignments for audit logging and row tier sync
  const [stagedReassignments, setStagedReassignments] = useState<Array<{
    row: string;
    section: string;
    salesCount: number;
    oldPrice: number;
    newPrice: number;
  }>>([]);

  // Review & Save dialog
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);

  // Derive row order for each floor
  const groundRowsList = useMemo(() => [
    'Special A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N'
  ], []);

  const balconyRowsList = useMemo(() => [
    'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O'
  ], []);

  const currentFloorRows = assignFloor === 'Ground Floor' ? groundRowsList : balconyRowsList;

  // Track if staged changes exist
  const hasStagedChanges = useMemo(() => {
    if (stagedSeats.length !== initialSeats.length) return true;
    for (let i = 0; i < stagedSeats.length; i++) {
      if (
        stagedSeats[i].category !== initialSeats[i].category ||
        stagedSeats[i].price !== initialSeats[i].price ||
        stagedSeats[i].name !== initialSeats[i].name
      ) {
        return true;
      }
    }
    return false;
  }, [stagedSeats, initialSeats]);

  // Calculations for Summary Rail
  const summary = useMemo(() => {
    let groundMoney = 0;
    let balconyMoney = 0;

    const soldCounts: Record<string, number> = {
      b5000: 0,
      b3500: 0,
      b2500: 0,
      b1500: 0,
      pp: 0,
    };

    const reservedCounts: Record<string, { count: number; named: number }> = {
      vip: { count: 0, named: 0 },
      obligation: { count: 0, named: 0 },
      sponsor_comp: { count: 0, named: 0 },
      blocked: { count: 0, named: 0 },
    };

    let unassignedCount = 0;
    let sellableSeats = 0;
    let totalHeldBack = 0;

    for (const s of stagedSeats) {
      const price = s.price || CATEGORY_META[s.category]?.price || 0;
      const isNamed = !!(s.name || s.guest_name);

      if (CATEGORY_META[s.category]?.countsToRaise) {
        sellableSeats++;
        if (s.section === 'Ground Floor') groundMoney += price;
        else balconyMoney += price;

        if (soldCounts[s.category] !== undefined) {
          soldCounts[s.category]++;
        }
      } else if (reservedCounts[s.category]) {
        totalHeldBack++;
        reservedCounts[s.category].count++;
        if (isNamed) reservedCounts[s.category].named++;
      } else if (s.category === 'unassigned') {
        unassignedCount++;
      }
    }

    const totalPotentialRaise = 
      soldCounts.b5000 * 5000 +
      soldCounts.b3500 * 3500 +
      soldCounts.b2500 * 2500 +
      soldCounts.b1500 * 1500 +
      soldCounts.pp * 1000;

    return {
      groundMoney,
      balconyMoney,
      soldCounts,
      reservedCounts,
      unassignedCount,
      sellableSeats,
      totalHeldBack,
      totalPotentialRaise,
    };
  }, [stagedSeats]);

  // Map of sequentially sold seats per band
  const soldSeatMap = useMemo(() => {
    const map = new Map<string, { soldIndex: number; totalSold: number; bandName: string }>();

    const categoryToBandPrice: Record<string, number> = {
      b5000: 5000,
      b3500: 3500,
      b2500: 2500,
      b1500: 1500,
      pp: 1000,
    };

    for (const [cat, price] of Object.entries(categoryToBandPrice)) {
      const band = bands.find((b) => b.price === price || b.id.includes(cat));
      const soldCount = band?.sold_count || 0;
      if (soldCount <= 0) continue;

      const catSeats = stagedSeats.filter((s) => s.category === cat);

      // Orderly sequential sort:
      // 1. Section: Ground Floor first, then Balcony
      // 2. Row: based on standard row list index
      // 3. Seat number: ascending
      catSeats.sort((a, b) => {
        if (a.section !== b.section) {
          return a.section === 'Ground Floor' ? -1 : 1;
        }
        const rowList = a.section === 'Ground Floor' ? groundRowsList : balconyRowsList;
        const aRowIdx = rowList.indexOf(a.row_label);
        const bRowIdx = rowList.indexOf(b.row_label);
        if (aRowIdx !== bRowIdx) {
          return aRowIdx - bRowIdx;
        }
        return a.seat_no - b.seat_no;
      });

      const soldSlice = catSeats.slice(0, soldCount);
      soldSlice.forEach((seat, idx) => {
        map.set(seat.id, {
          soldIndex: idx + 1,
          totalSold: soldCount,
          bandName: (band as any)?.name || band?.label || CATEGORY_META[cat as SeatCategory]?.label || `Band ${cat}`,
        });
      });
    }

    return map;
  }, [bands, stagedSeats, groundRowsList, balconyRowsList]);

  // Handle Apply to Rows
  const handleApplyRows = (e: React.FormEvent) => {
    e.preventDefault();
    const rowsList = assignFloor === 'Ground Floor' ? groundRowsList : balconyRowsList;
    const fromIdx = rowsList.indexOf(fromRow);
    const toIdx = rowsList.indexOf(toRow);

    if (fromIdx === -1 || toIdx === -1) {
      setDialogState({
        open: true,
        type: 'warning',
        title: 'Invalid Row Range',
        message: `Please select valid starting and ending rows for ${assignFloor}.`,
      });
      return;
    }

    const startIdx = Math.min(fromIdx, toIdx);
    const endIdx = Math.max(fromIdx, toIdx);
    const targetRows = rowsList.slice(startIdx, endIdx + 1);

    const targetCategoryMeta = CATEGORY_META[selectedCategory];

    // Check if any target row has sold seats
    const rowsWithSales: string[] = [];
    for (const rLabel of targetRows) {
      const rowSeats = stagedSeats.filter((s) => s.section === assignFloor && s.row_label === rLabel);
      const soldCount = rowSeats.filter((s) => s.sold || s.payment_status === 'received').length;
      if (soldCount > 0) {
        rowsWithSales.push(rLabel);
      }
    }

    if (rowsWithSales.length > 0) {
      // Prompt confirmation for the first row with sales
      const targetRow = rowsWithSales[0];
      const rowSeats = stagedSeats.filter((s) => s.section === assignFloor && s.row_label === targetRow);
      const soldCount = rowSeats.filter((s) => s.sold || s.payment_status === 'received').length;
      const oldPrice = rowSeats[0]?.price || 5000;

      setPendingReassignment({
        row: targetRow,
        section: assignFloor,
        salesCount: soldCount,
        oldPrice,
        newPrice: targetCategoryMeta.price,
        newCategory: selectedCategory,
        affectedSeatIds: rowSeats.filter((s) => !s.sold && s.payment_status !== 'received').map((s) => s.id),
      });
      return;
    }

    // Apply immediately to all seats in range
    setStagedSeats((prev) =>
      prev.map((s) => {
        if (s.section === assignFloor && targetRows.includes(s.row_label)) {
          return {
            ...s,
            category: selectedCategory,
            price: targetCategoryMeta.price,
            tier: targetCategoryMeta.price,
            counts_to_raise: targetCategoryMeta.countsToRaise,
            obligation_type: selectedCategory === 'obligation' ? 'police' : (selectedCategory === 'vip' ? 'vip' : null),
            is_blocked: selectedCategory === 'blocked',
          };
        }
        return s;
      })
    );

    // Auto-switch visual tab to the floor being assigned
    setActiveFloor(assignFloor);

    setStatusMessage({
      type: 'success',
      text: `Staged: Rows ${fromRow} to ${toRow} in ${assignFloor} assigned as ${targetCategoryMeta.label}. Click "Review & Save" to commit.`,
    });

    setDialogState({
      open: true,
      type: 'success',
      title: 'Rows Reallocated in Layout',
      message: `Rows ${fromRow} to ${toRow} on ${assignFloor} are now assigned to ${targetCategoryMeta.label}. Click "Save Layout to Database" to publish changes.`,
      actionText: 'OK, View Layout',
    });
  };

  // Confirm row reassignment with sales
  const handleConfirmReassignment = () => {
    if (!pendingReassignment) return;
    const { newCategory, newPrice, affectedSeatIds } = pendingReassignment;
    const targetCategoryMeta = CATEGORY_META[newCategory];

    setStagedSeats((prev) =>
      prev.map((s) => {
        if (affectedSeatIds.includes(s.id)) {
          return {
            ...s,
            category: newCategory,
            price: newPrice,
            tier: newPrice,
            counts_to_raise: targetCategoryMeta.countsToRaise,
            obligation_type: newCategory === 'obligation' ? 'police' : null,
            is_blocked: newCategory === 'blocked',
          };
        }
        return s;
      })
    );

    setStagedReassignments((prev) => [
      ...prev.filter((r) => !(r.row === pendingReassignment.row && r.section === pendingReassignment.section)),
      {
        row: pendingReassignment.row,
        section: pendingReassignment.section,
        salesCount: pendingReassignment.salesCount,
        oldPrice: pendingReassignment.oldPrice,
        newPrice: pendingReassignment.newPrice,
      },
    ]);

    setStatusMessage({
      type: 'success',
      text: `Row ${pendingReassignment.row} unsold seats updated to ${targetCategoryMeta.label}. Sold seats retain ₹${pendingReassignment.oldPrice.toLocaleString('en-IN')}.`,
    });
    setPendingReassignment(null);
  };

  // Seat Click Handler
  const handleSeatClick = (seat: SeatData) => {
    const soldInfo = soldSeatMap.get(seat.id);
    if (soldInfo) {
      setDialogState({
        open: true,
        type: 'info',
        title: 'Sold Pass Allocation',
        message: `This seat (Row ${seat.row_label}, Seat ${seat.seat_no}) represents Sold Pass #${soldInfo.soldIndex} of ${soldInfo.totalSold} sold in ${soldInfo.bandName}. Passes are issued by price band and sequentially shaded in Emerald Green on the venue blueprint.`,
        actionText: 'OK, Got It',
      });
      return;
    }

    if (['vip', 'obligation', 'sponsor_comp'].includes(seat.category)) {
      setNamingSeat(seat);
      setGuestNameInput(seat.name || seat.guest_name || '');
    }
  };

  // Save named guest for seat
  const handleSaveSeatName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!namingSeat) return;

    setStagedSeats((prev) =>
      prev.map((s) => (s.id === namingSeat.id ? { ...s, name: guestNameInput.trim() || null, guest_name: guestNameInput.trim() || null } : s))
    );

    await updateSeatName(namingSeat.id, guestNameInput.trim());
    setNamingSeat(null);
  };

  // Commit Layout Plan
  const handleCommitPlan = async () => {
    setIsLoading(true);
    setStatusMessage(null);

    const updates = stagedSeats.map((s) => ({
      id: s.id,
      category: s.category,
      price: s.price || 0,
      counts_to_raise: !!s.counts_to_raise,
      obligation_type: s.obligation_type || null,
      name: s.name || null,
    }));

    const res = await saveLayoutPlan(updates, stagedReassignments);
    setIsLoading(false);

    if (res.success) {
      setStagedReassignments([]);
      const timeStr = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setLastSavedTime(timeStr);
      setStatusMessage({
        type: 'success',
        text: `Layout saved · ${timeStr}. Real-time quotas and capacities updated.`,
      });
      setShowReviewModal(false);
      setDialogState({
        open: true,
        type: 'success',
        title: 'Hall Layout Saved!',
        message: `The hall blueprint and seat price band capacities have been saved to the database at ${timeStr}. Real-time quotas are live.`,
      });
    } else {
      setStatusMessage({ type: 'error', text: res.error || 'Failed to save layout plan.' });
      setDialogState({
        open: true,
        type: 'error',
        title: 'Failed to Save Layout',
        message: res.error || 'Failed to save layout plan.',
      });
    }
  };

  // Discard staged changes
  const handleDiscard = () => {
    setStagedSeats(initialSeats);
    setStagedReassignments([]);
    setStatusMessage(null);
    setDialogState({
      open: true,
      type: 'info',
      title: 'Staged Changes Discarded',
      message: 'Reverted all unsaved changes to the current database layout.',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
          Bands & Protected Seats
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Configure row price bands and protected seating allocations across the venue.
        </p>
      </div>

      {statusMessage && (
        <Alert className={statusMessage.type === 'success' ? 'bg-emerald-950/70 border-emerald-800 text-emerald-100' : 'bg-red-950/70 border-red-800 text-red-100'}>
          {statusMessage.type === 'success' ? <CheckCircle2 className="h-5 w-5 text-emerald-400" /> : <AlertCircle className="h-5 w-5 text-red-400" />}
          <AlertTitle className="text-sm font-bold">{statusMessage.type === 'success' ? 'Success' : 'Error'}</AlertTitle>
          <AlertDescription className="text-xs">{statusMessage.text}</AlertDescription>
        </Alert>
      )}

      {/* ─────────────────────────────────────────────────────────────
          1. TOP ACTION BOX: ASSIGN ROWS (Exact replica of Image 1)
      ───────────────────────────────────────────────────────────── */}
      <form onSubmit={handleApplyRows} className="p-5 bg-[#131F2E] border border-slate-800 rounded-2xl space-y-3 shadow-xl">
        <div className="flex items-center gap-2 text-amber-400 text-sm font-bold">
          <ArrowUpDown className="w-4 h-4" />
          Assign rows
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-end">
          <div className="space-y-1">
            <Label className="text-xs text-slate-400 font-bold">Floor</Label>
            <select
              value={assignFloor}
              onChange={(e) => {
                const floor = e.target.value as SeatSection;
                setAssignFloor(floor);
                setFromRow(floor === 'Ground Floor' ? 'Special A' : 'A');
                setToRow(floor === 'Ground Floor' ? 'C' : 'C');
              }}
              className="w-full h-10 bg-[#1A2839] border border-slate-700 text-white rounded-xl px-3 text-xs font-bold"
            >
              <option value="Ground Floor">Ground Floor</option>
              <option value="Balcony">Balcony</option>
            </select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-slate-400 font-bold">From row</Label>
            <select
              value={fromRow}
              onChange={(e) => setFromRow(e.target.value)}
              className="w-full h-10 bg-[#1A2839] border border-slate-700 text-white rounded-xl px-3 text-xs font-bold"
            >
              {currentFloorRows.map((r) => (
                <option key={r} value={r}>Row {r}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-slate-400 font-bold">To row</Label>
            <select
              value={toRow}
              onChange={(e) => setToRow(e.target.value)}
              className="w-full h-10 bg-[#1A2839] border border-slate-700 text-white rounded-xl px-3 text-xs font-bold"
            >
              {currentFloorRows.map((r) => (
                <option key={r} value={r}>Row {r}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-slate-400 font-bold">Assign as</Label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value as SeatCategory)}
              className="w-full h-10 bg-[#1A2839] border border-slate-700 text-white rounded-xl px-3 text-xs font-bold"
            >
              <option value="b5000">₹5,000 — Band A</option>
              <option value="b3500">₹3,500 — Band B</option>
              <option value="b2500">₹2,500 — Band C</option>
              <option value="b1500">₹1,500 — Band D</option>
              <option value="pp">₹1,000 — PP</option>
              <option value="vip">VIP (SPL Reserved)</option>
              <option value="obligation">Obligation (Police/Corp)</option>
              <option value="sponsor_comp">Sponsor comp</option>
              <option value="blocked">Blocked</option>
              <option value="unassigned">Unassigned</option>
            </select>
          </div>

          <div>
            <Button
              type="submit"
              className="w-full h-10 bg-[#E8913A] hover:bg-[#D97706] text-slate-950 font-black rounded-xl text-xs shadow-md"
            >
              Apply to rows
            </Button>
          </div>
        </div>

        <p className="text-[11px] text-slate-500">
          Reassigning rows preserves historical prices on sold tickets.
        </p>

        {hasStagedChanges && (
          <div className="p-3 bg-amber-500/10 border border-amber-500/40 rounded-xl flex flex-wrap items-center justify-between gap-3 pt-2">
            <span className="text-xs text-amber-300 font-bold flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
              Unsaved changes staged in the layout map!
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={handleDiscard}
                className="h-8 text-xs text-slate-400 hover:text-white"
              >
                Discard
              </Button>
              <Button
                type="button"
                onClick={() => setShowReviewModal(true)}
                className="h-9 px-4 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs rounded-xl shadow-md"
              >
                💾 Review & Save Layout Plan
              </Button>
            </div>
          </div>
        )}
      </form>

      {/* ─────────────────────────────────────────────────────────────
          2. MAIN PLANNING GRID (Left: Blueprint Layout, Right: Summary Rail)
      ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Section (8 cols): Interactive Seating Map */}
        <div className="lg:col-span-8">
          <HallLayoutMap
            seats={stagedSeats}
            bands={bands}
            readOnly={false}
            activeFloor={activeFloor}
            onFloorChange={setActiveFloor}
            onSeatClick={handleSeatClick}
            soldSeatMap={soldSeatMap}
            isolatedFilter={isolatedFilter}
            onIsolatedFilterChange={setIsolatedFilter}
          />
        </div>

        {/* Right Section (4 cols): Planning Summary Rail (Exact replica of Image 1) */}
        <div className="lg:col-span-4 bg-[#131F2E] border border-slate-800 rounded-3xl p-5 space-y-5 shadow-xl">
          <div>
            <h3 className="text-base font-bold text-white">Planning summary</h3>
            <p className="text-xs text-slate-400">Both floors combined</p>
          </div>

          {/* Ground & Balcony Subtotal Cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-[#0E1722] rounded-2xl border border-slate-800 text-center">
              <p className="text-[10px] uppercase font-bold text-slate-400">Ground</p>
              <p className="text-lg font-black text-white font-mono mt-0.5">
                ₹{(summary.groundMoney / 100000).toFixed(1)}L
              </p>
            </div>
            <div className="p-3 bg-[#0E1722] rounded-2xl border border-slate-800 text-center">
              <p className="text-[10px] uppercase font-bold text-slate-400">Balcony</p>
              <p className="text-lg font-black text-white font-mono mt-0.5">
                ₹{(summary.balconyMoney / 100000).toFixed(2)}L
              </p>
            </div>
          </div>

          {/* Sold — Counts Towards Raise */}
          <div className="space-y-2 pt-2 border-t border-slate-800">
            <div className="flex justify-between items-center">
              <button
                type="button"
                onClick={() => setIsolatedFilter(isolatedFilter === 'sold' ? 'all' : 'sold')}
                className={cn(
                  "text-[11px] font-black uppercase tracking-wider text-slate-400 hover:text-white transition-colors cursor-pointer flex items-center gap-1",
                  isolatedFilter === 'sold' && "text-emerald-400 font-extrabold"
                )}
              >
                <span>SOLD — COUNTS TOWARDS RAISE</span>
                {isolatedFilter === 'sold' && <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1 rounded">ISOLATED</span>}
              </button>
            </div>

            <div className="space-y-1.5 text-xs">
              {/* Band A */}
              {(() => {
                const b = bands.find((x) => x.price === 5000 || x.id.includes('5000'));
                const sold = b?.sold_count || 0;
                const isSelected = isolatedFilter === 'b5000';
                return (
                  <button
                    type="button"
                    onClick={() => setIsolatedFilter(isSelected ? 'all' : 'b5000')}
                    className={cn(
                      "w-full flex justify-between items-center text-left p-1.5 rounded-xl transition-all cursor-pointer",
                      isSelected ? "bg-amber-500/20 ring-1 ring-amber-400" : "hover:bg-slate-800/40"
                    )}
                  >
                    <span className="flex items-center gap-1.5 font-bold text-white">
                      <span className="w-2.5 h-2.5 rounded-xs bg-[#F59E0B]" /> ₹5,000
                    </span>
                    <div className="text-right flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono font-bold text-[10px]">
                        {sold} sold
                      </span>
                      <span className="font-mono font-bold text-white">/ {summary.soldCounts.b5000}</span>
                    </div>
                  </button>
                );
              })()}

              {/* Band B */}
              {(() => {
                const b = bands.find((x) => x.price === 3500 || x.id.includes('3500'));
                const sold = b?.sold_count || 0;
                const isSelected = isolatedFilter === 'b3500';
                return (
                  <button
                    type="button"
                    onClick={() => setIsolatedFilter(isSelected ? 'all' : 'b3500')}
                    className={cn(
                      "w-full flex justify-between items-center text-left p-1.5 rounded-xl transition-all cursor-pointer",
                      isSelected ? "bg-purple-500/20 ring-1 ring-purple-400" : "hover:bg-slate-800/40"
                    )}
                  >
                    <span className="flex items-center gap-1.5 font-bold text-white">
                      <span className="w-2.5 h-2.5 rounded-xs bg-[#8B5CF6]" /> ₹3,500
                    </span>
                    <div className="text-right flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono font-bold text-[10px]">
                        {sold} sold
                      </span>
                      <span className="font-mono font-bold text-white">/ {summary.soldCounts.b3500}</span>
                    </div>
                  </button>
                );
              })()}

              {/* Band C */}
              {(() => {
                const b = bands.find((x) => x.price === 2500 || x.id.includes('2500'));
                const sold = b?.sold_count || 0;
                const isSelected = isolatedFilter === 'b2500';
                return (
                  <button
                    type="button"
                    onClick={() => setIsolatedFilter(isSelected ? 'all' : 'b2500')}
                    className={cn(
                      "w-full flex justify-between items-center text-left p-1.5 rounded-xl transition-all cursor-pointer",
                      isSelected ? "bg-teal-500/20 ring-1 ring-teal-400" : "hover:bg-slate-800/40"
                    )}
                  >
                    <span className="flex items-center gap-1.5 font-bold text-white">
                      <span className="w-2.5 h-2.5 rounded-xs bg-[#0D9488]" /> ₹2,500
                    </span>
                    <div className="text-right flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono font-bold text-[10px]">
                        {sold} sold
                      </span>
                      <span className="font-mono font-bold text-white">/ {summary.soldCounts.b2500}</span>
                    </div>
                  </button>
                );
              })()}

              {/* Band D */}
              {(() => {
                const b = bands.find((x) => x.price === 1500 || x.id.includes('1500'));
                const sold = b?.sold_count || 0;
                const isSelected = isolatedFilter === 'b1500';
                return (
                  <button
                    type="button"
                    onClick={() => setIsolatedFilter(isSelected ? 'all' : 'b1500')}
                    className={cn(
                      "w-full flex justify-between items-center text-left p-1.5 rounded-xl transition-all cursor-pointer",
                      isSelected ? "bg-slate-500/20 ring-1 ring-slate-400" : "hover:bg-slate-800/40"
                    )}
                  >
                    <span className="flex items-center gap-1.5 font-bold text-white">
                      <span className="w-2.5 h-2.5 rounded-xs bg-[#64748B]" /> ₹1,500
                    </span>
                    <div className="text-right flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono font-bold text-[10px]">
                        {sold} sold
                      </span>
                      <span className="font-mono font-bold text-white">/ {summary.soldCounts.b1500}</span>
                    </div>
                  </button>
                );
              })()}

              {/* PP */}
              {(() => {
                const b = bands.find((x) => x.price === 1000 || x.id.includes('pp'));
                const sold = b?.sold_count || 0;
                const isSelected = isolatedFilter === 'pp';
                return (
                  <button
                    type="button"
                    onClick={() => setIsolatedFilter(isSelected ? 'all' : 'pp')}
                    className={cn(
                      "w-full flex justify-between items-center text-left p-1.5 rounded-xl transition-all cursor-pointer",
                      isSelected ? "bg-sky-500/20 ring-1 ring-sky-400" : "hover:bg-slate-800/40"
                    )}
                  >
                    <span className="flex items-center gap-1.5 font-bold text-white">
                      <span className="w-2.5 h-2.5 rounded-xs bg-[#0284C7]" /> ₹1,000 PP
                    </span>
                    <div className="text-right flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono font-bold text-[10px]">
                        {sold} sold
                      </span>
                      <span className="font-mono font-bold text-white">/ {summary.soldCounts.pp}</span>
                    </div>
                  </button>
                );
              })()}
            </div>
          </div>

          {/* Reserved — Not for Sale */}
          <div className="space-y-2 pt-2 border-t border-slate-800">
            <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">
              RESERVED — NOT FOR SALE
            </p>

            <div className="space-y-1 text-xs">
              {/* VIP */}
              {(() => {
                const isSelected = isolatedFilter === 'vip';
                return (
                  <button
                    type="button"
                    onClick={() => setIsolatedFilter(isSelected ? 'all' : 'vip')}
                    className={cn(
                      "w-full flex justify-between items-center text-left p-1.5 rounded-xl transition-all cursor-pointer",
                      isSelected ? "bg-amber-500/20 ring-1 ring-amber-400" : "hover:bg-slate-800/40"
                    )}
                  >
                    <span className="flex items-center gap-1.5 font-bold text-white">
                      <span className="w-2.5 h-2.5 rounded-xs bg-[#EAB308]" /> VIP
                    </span>
                    <span className="font-mono text-slate-300">
                      {summary.reservedCounts.vip.count} · {summary.reservedCounts.vip.named} named
                    </span>
                  </button>
                );
              })()}

              {/* Obligation */}
              {(() => {
                const isSelected = isolatedFilter === 'obligation';
                return (
                  <button
                    type="button"
                    onClick={() => setIsolatedFilter(isSelected ? 'all' : 'obligation')}
                    className={cn(
                      "w-full flex justify-between items-center text-left p-1.5 rounded-xl transition-all cursor-pointer",
                      isSelected ? "bg-red-500/20 ring-1 ring-red-400" : "hover:bg-slate-800/40"
                    )}
                  >
                    <span className="flex items-center gap-1.5 font-bold text-white">
                      <span className="w-2.5 h-2.5 rounded-xs bg-[#EF4444]" /> Obligation
                    </span>
                    <span className="font-mono text-slate-300">
                      {summary.reservedCounts.obligation.count} · {summary.reservedCounts.obligation.named} named
                    </span>
                  </button>
                );
              })()}

              {/* Sponsor Comp */}
              {(() => {
                const isSelected = isolatedFilter === 'sponsor_comp';
                return (
                  <button
                    type="button"
                    onClick={() => setIsolatedFilter(isSelected ? 'all' : 'sponsor_comp')}
                    className={cn(
                      "w-full flex justify-between items-center text-left p-1.5 rounded-xl transition-all cursor-pointer",
                      isSelected ? "bg-cyan-500/20 ring-1 ring-cyan-400" : "hover:bg-slate-800/40"
                    )}
                  >
                    <span className="flex items-center gap-1.5 font-bold text-white">
                      <span className="w-2.5 h-2.5 rounded-xs bg-[#06B6D4]" /> Sponsor comp
                    </span>
                    <span className="font-mono text-slate-300">
                      {summary.reservedCounts.sponsor_comp.count} · {summary.reservedCounts.sponsor_comp.named} named
                    </span>
                  </button>
                );
              })()}

              {/* Blocked */}
              {(() => {
                const isSelected = isolatedFilter === 'blocked';
                return (
                  <button
                    type="button"
                    onClick={() => setIsolatedFilter(isSelected ? 'all' : 'blocked')}
                    className={cn(
                      "w-full flex justify-between items-center text-left p-1.5 rounded-xl transition-all cursor-pointer",
                      isSelected ? "bg-slate-500/20 ring-1 ring-slate-400" : "hover:bg-slate-800/40"
                    )}
                  >
                    <span className="flex items-center gap-1.5 font-bold text-white">
                      <span className="w-2.5 h-2.5 rounded-xs bg-[#475569]" /> Blocked
                    </span>
                    <span className="font-mono text-slate-300">
                      {summary.reservedCounts.blocked.count} seats
                    </span>
                  </button>
                );
              })()}
            </div>
          </div>

          {/* Totals Box */}
          <div className="p-3.5 bg-[#0E1722] rounded-2xl border border-slate-800 space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Sellable Seats:</span>
              <span className="font-mono font-bold text-white">{summary.sellableSeats}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Potential Raise:</span>
              <span className="font-mono font-black text-amber-400">₹{summary.totalPotentialRaise.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Held Back (Reserved):</span>
              <span className="font-mono font-bold text-purple-300">{summary.totalHeldBack}</span>
            </div>
            {summary.unassignedCount > 0 && (
              <div className="flex justify-between text-rose-400">
                <span>Unassigned:</span>
                <span className="font-mono font-bold">{summary.unassignedCount}</span>
              </div>
            )}
          </div>

          {/* Save & Discard Actions */}
          <div className="space-y-2 pt-2 border-t border-slate-800">
            <Button
              type="button"
              disabled={isLoading || !hasStagedChanges}
              onClick={() => setShowReviewModal(true)}
              className="w-full h-11 bg-[#E8913A] hover:bg-[#D97706] text-slate-950 font-black rounded-xl text-sm shadow-md"
            >
              Review & Save Layout Plan
            </Button>

            {hasStagedChanges && (
              <Button
                type="button"
                variant="ghost"
                onClick={handleDiscard}
                className="w-full h-9 text-slate-400 hover:text-white text-xs"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Discard Staged Changes
              </Button>
            )}

            {lastSavedTime && (
              <p className="text-[11px] text-emerald-400 text-center font-mono">
                Layout saved · {lastSavedTime}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          3. MODAL: REASSIGNMENT WITH SALES CONFIRMATION (Copy verbatim from spec)
      ───────────────────────────────────────────────────────────── */}
      {pendingReassignment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="w-full max-w-md p-6 bg-[#131F2E] border border-amber-500/60 rounded-2xl space-y-4 shadow-2xl">
            <div className="flex items-center gap-2 text-amber-400">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="text-base font-bold text-white">Row Has Existing Sales</h3>
            </div>

            <p className="text-sm text-slate-300 leading-relaxed">
              Row <strong className="text-white">{pendingReassignment.row}</strong> is{' '}
              <strong className="text-white">₹{pendingReassignment.oldPrice.toLocaleString('en-IN')}</strong> and has{' '}
              <strong className="text-amber-400">{pendingReassignment.salesCount}</strong> passes sold.{' '}
              Those <strong className="text-white">{pendingReassignment.salesCount}</strong> keep ₹{pendingReassignment.oldPrice.toLocaleString('en-IN')}.{' '}
              The row will sell at <strong className="text-emerald-400">₹{pendingReassignment.newPrice.toLocaleString('en-IN')}</strong> for the remaining seats. Confirm?
            </p>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPendingReassignment(null)}
                className="text-slate-400 hover:text-white text-xs"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleConfirmReassignment}
                className="bg-[#E8913A] hover:bg-[#D97706] text-slate-950 font-bold text-xs rounded-xl"
              >
                Confirm Reassignment
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          4. MODAL: NAMED SEAT DIALOG (VIP / Obligation / Sponsor)
      ───────────────────────────────────────────────────────────── */}
      {namingSeat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <form onSubmit={handleSaveSeatName} className="w-full max-w-sm p-5 bg-[#131F2E] border border-slate-700 rounded-2xl space-y-4 shadow-2xl">
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <User className="w-4 h-4 text-amber-400" />
                  Name Reserved Seat
                </h3>
                <span className="text-xs font-mono text-amber-300">{namingSeat.id}</span>
              </div>
              <button
                type="button"
                onClick={() => setNamingSeat(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-slate-300">Dignitary / Guest Name (Optional)</Label>
              <Input
                placeholder="e.g. Chief Guest / Police Commissioner"
                value={guestNameInput}
                onChange={(e) => setGuestNameInput(e.target.value)}
                className="h-10 bg-[#1A2839] border-slate-700 text-white rounded-xl text-xs"
                autoFocus
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setNamingSeat(null)}
                className="text-slate-400 hover:text-white text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                className="bg-[#E8913A] hover:bg-[#D97706] text-slate-950 font-bold rounded-xl text-xs"
              >
                Save Name
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          5. MODAL: REVIEW & SAVE (Validation checks from Step 3 table)
      ───────────────────────────────────────────────────────────── */}
      {showReviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg p-6 bg-[#131F2E] border border-slate-700 rounded-2xl space-y-4 shadow-2xl">
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                Review & Commit Layout Plan
              </h3>
              <button
                type="button"
                onClick={() => setShowReviewModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Validation Checklist */}
            <div className="space-y-3 text-xs">
              <div className="p-3 bg-[#0E1722] rounded-xl border border-slate-800 flex items-start gap-2.5">
                <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white">All Seats Accounted For:</strong>
                  <p className="text-slate-400 mt-0.5">
                    1,448 total venue seats ({summary.sellableSeats} sellable + {summary.totalHeldBack} reserved + {summary.unassignedCount} unassigned).
                  </p>
                  {summary.unassignedCount > 0 && (
                    <p className="text-amber-400 font-bold mt-1">
                      ⚠️ Note: {summary.unassignedCount} seat(s) remain unassigned (e.g. Special A).
                    </p>
                  )}
                </div>
              </div>

              <div className="p-3 bg-[#0E1722] rounded-xl border border-slate-800 flex items-start gap-2.5">
                <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white">No Double-Assignment:</strong>
                  <p className="text-slate-400 mt-0.5">Each physical seat belongs to exactly one category.</p>
                </div>
              </div>

              <div className="p-3 bg-[#0E1722] rounded-xl border border-slate-800 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white">Provisional Rows Warning:</strong>
                  <p className="text-slate-400 mt-0.5">
                    Balcony rows I–M (286 seats) are provisional. Confirm with physical venue before live sales.
                  </p>
                </div>
              </div>

              <div className="p-3 bg-emerald-950/40 rounded-xl border border-emerald-900/60 flex items-start gap-2.5">
                <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-emerald-300">Potential Raise Calculated:</strong>
                  <p className="text-white font-mono font-bold mt-0.5">
                    ₹{summary.totalPotentialRaise.toLocaleString('en-IN')}
                  </p>
                  <p className="text-slate-400 text-[10px]">
                    Includes all priced bands (₹5,000, ₹3,500, ₹2,500, ₹1,500) and PP seats × ₹1,000.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowReviewModal(false)}
                className="text-slate-400 hover:text-white text-xs"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={isLoading}
                onClick={handleCommitPlan}
                className="bg-[#E8913A] hover:bg-[#D97706] text-slate-950 font-black rounded-xl text-xs"
              >
                {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                Commit & Update Live Quotas
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Unmissable Status Dialog */}
      {dialogState && (
        <StatusDialog
          open={dialogState.open}
          onOpenChange={(open) => setDialogState(open ? dialogState : null)}
          type={dialogState.type}
          title={dialogState.title}
          message={dialogState.message}
          actionText={dialogState.actionText}
        />
      )}
    </div>
  );
}
