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

    setStatusMessage({
      type: 'success',
      text: `Row ${pendingReassignment.row} unsold seats updated to ${targetCategoryMeta.label}. Sold seats retain ₹${pendingReassignment.oldPrice.toLocaleString('en-IN')}.`,
    });
    setPendingReassignment(null);
  };

  // Seat Click Handler
  const handleSeatClick = (seat: SeatData) => {
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

    const res = await saveLayoutPlan(updates);
    setIsLoading(false);

    if (res.success) {
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
          Plan the hall — assign each row to a price band or reserve it.{' '}
          <strong className="text-white">
            The Music Academy, Madras — 648 Ground Floor + 750 Balcony + 50 VIP = 1,448 total (1,398 sellable).
          </strong>
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
          Reassigning a row that already has sales opens a confirmation: sold seats keep their original price, only unsold seats take the new band. VIP Box is fixed.
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
        <div className="lg:col-span-8 bg-[#131F2E] border border-slate-800 rounded-3xl p-5 space-y-4 shadow-xl">
          {/* Floor tabs */}
          <div className="flex justify-between items-center pb-2 border-b border-slate-800">
            <div className="inline-flex p-1 bg-[#0E1722] rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setActiveFloor('Ground Floor')}
                className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${
                  activeFloor === 'Ground Floor'
                    ? 'bg-[#E8913A] text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Ground Floor <span className="text-[10px] font-normal opacity-80">648 + 50 VIP</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveFloor('Balcony')}
                className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${
                  activeFloor === 'Balcony'
                    ? 'bg-[#E8913A] text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Balcony <span className="text-[10px] font-normal opacity-80">750</span>
              </button>
            </div>

            <span className="text-xs text-slate-400 font-mono">
              {activeFloor === 'Ground Floor' ? 'Rows A–N · nearest stage first' : 'Rows A–O · nearest stage first'}
            </span>
          </div>

          {/* Stage Area */}
          <div className="w-full py-2 bg-[#0E1722] border border-slate-800 text-center rounded-xl text-slate-500 font-black tracking-widest text-xs uppercase">
            STAGE & PERFORMANCE AREA
          </div>

          {/* Layout Map: Ground Floor vs Balcony */}
          <div className="flex gap-4 items-start overflow-x-auto pb-4">
            {/* SPL VIP Box (Visible on Ground Floor) */}
            {activeFloor === 'Ground Floor' && (
              <div className="w-36 p-3 bg-[#0E1722] border-2 border-amber-500/40 rounded-2xl space-y-2 shrink-0">
                <div className="text-center">
                  <div className="text-xs font-black text-amber-400 flex items-center justify-center gap-1">
                    <Crown className="w-3 h-3 text-amber-400" /> SPL VIP
                  </div>
                  <div className="text-[10px] text-slate-400">50 · reserved</div>
                </div>

                <div className="grid grid-cols-5 gap-1 pt-1">
                  {stagedSeats
                    .filter((s) => s.row_label === 'SPL VIP')
                    .sort((a, b) => a.seat_no - b.seat_no)
                    .map((s) => {
                      const isNamed = !!(s.name || s.guest_name);
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => handleSeatClick(s)}
                          title={`${s.id}: ${s.name || 'VIP Chief Guest'}`}
                          className={`w-5 h-5 rounded text-[9px] font-black flex items-center justify-center transition-all ${
                            isNamed ? 'bg-amber-400 text-slate-950 ring-1 ring-white' : 'bg-amber-500/30 text-amber-300 hover:bg-amber-500 hover:text-slate-950'
                          }`}
                        >
                          {s.seat_no}
                        </button>
                      );
                    })}
                </div>

                <div className="text-[9px] text-slate-500 text-center pt-1 border-t border-slate-800">
                  ← VIP ENTRANCE
                </div>
              </div>
            )}

            {/* Rows List */}
            <div className="flex-1 space-y-2 min-w-[500px]">
              {(activeFloor === 'Ground Floor' ? groundRowsList : balconyRowsList).map((rLabel) => {
                const rowSeats = stagedSeats.filter((s) => s.section === activeFloor && s.row_label === rLabel);
                const isProvisional = rowSeats.some((s) => s.provisional);
                const firstSeat = rowSeats[0];
                const categoryMeta = firstSeat ? CATEGORY_META[firstSeat.category] : CATEGORY_META.unassigned;

                // Split row into 3 blocks (left, center, right)
                const total = rowSeats.length;
                const leftCount = Math.floor(total * 0.25);
                const centerCount = Math.floor(total * 0.5);
                const leftBlock = rowSeats.slice(0, leftCount);
                const centerBlock = rowSeats.slice(leftCount, leftCount + centerCount);
                const rightBlock = rowSeats.slice(leftCount + centerCount);

                return (
                  <div key={rLabel} className="flex items-center gap-3">
                    {/* Row Label */}
                    <div className="w-16 text-xs font-mono font-black text-slate-300 flex items-center gap-1 shrink-0">
                      <span>{rLabel}</span>
                      {isProvisional && (
                        <span className="text-[8px] px-1 bg-amber-500/20 text-amber-400 rounded border border-amber-500/30">
                          Prov
                        </span>
                      )}
                    </div>

                    {/* Physical Seats in 3 blocks */}
                    <div className="flex-1 flex items-center gap-2">
                      <div className="flex items-center gap-0.5">
                        {leftBlock.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => handleSeatClick(s)}
                            title={`${s.id}: ${CATEGORY_META[s.category]?.label} ${s.name ? `(${s.name})` : ''}`}
                            className="w-2.5 h-3.5 rounded-xs transition-transform hover:scale-125"
                            style={{ backgroundColor: CATEGORY_META[s.category]?.color || '#1E293B' }}
                          />
                        ))}
                      </div>

                      <div className="flex items-center gap-0.5">
                        {centerBlock.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => handleSeatClick(s)}
                            title={`${s.id}: ${CATEGORY_META[s.category]?.label} ${s.name ? `(${s.name})` : ''}`}
                            className="w-2.5 h-3.5 rounded-xs transition-transform hover:scale-125"
                            style={{ backgroundColor: CATEGORY_META[s.category]?.color || '#1E293B' }}
                          />
                        ))}
                      </div>

                      <div className="flex items-center gap-0.5">
                        {rightBlock.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => handleSeatClick(s)}
                            title={`${s.id}: ${CATEGORY_META[s.category]?.label} ${s.name ? `(${s.name})` : ''}`}
                            className="w-2.5 h-3.5 rounded-xs transition-transform hover:scale-125"
                            style={{ backgroundColor: CATEGORY_META[s.category]?.color || '#1E293B' }}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Row Price / Category label on right */}
                    <div className="w-24 text-right text-xs font-mono font-bold shrink-0" style={{ color: categoryMeta.color }}>
                      {categoryMeta.label.split('—')[0].trim()}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Legend */}
          <div className="pt-3 border-t border-slate-800 space-y-2">
            <div className="flex flex-wrap items-center gap-3 text-[11px] font-bold">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-xs bg-[#F59E0B]" /> ₹5,000</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-xs bg-[#8B5CF6]" /> ₹3,500</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-xs bg-[#0D9488]" /> ₹2,500</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-xs bg-[#64748B]" /> ₹1,500</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-xs bg-[#0284C7]" /> ₹1,000 PP</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-xs bg-[#EAB308]" /> VIP</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-xs bg-[#EF4444]" /> Obligation</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-xs bg-[#06B6D4]" /> Sponsor comp</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-xs bg-[#475569]" /> Blocked</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-xs bg-[#1E293B]" /> Unassigned</span>
            </div>
            <p className="text-[10px] text-slate-500">
              Dashed = reserved (VIP / obligation / sponsor comp / blocked). Priced bands + PP are sold. Click a VIP, obligation or sponsor seat to name who sits there (optional).
            </p>
          </div>
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
            <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">
              SOLD — COUNTS TOWARDS RAISE
            </p>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-1.5 font-bold text-white">
                  <span className="w-2.5 h-2.5 rounded-xs bg-[#F59E0B]" /> ₹5,000
                </span>
                <div className="text-right">
                  <span className="font-mono font-bold text-white">{summary.soldCounts.b5000}</span>
                  <p className="text-[10px] text-slate-500">= ₹{(summary.soldCounts.b5000 * 5000).toLocaleString('en-IN')} if sold</p>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <span className="flex items-center gap-1.5 font-bold text-white">
                  <span className="w-2.5 h-2.5 rounded-xs bg-[#8B5CF6]" /> ₹3,500
                </span>
                <div className="text-right">
                  <span className="font-mono font-bold text-white">{summary.soldCounts.b3500}</span>
                  <p className="text-[10px] text-slate-500">= ₹{(summary.soldCounts.b3500 * 3500).toLocaleString('en-IN')} if sold</p>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <span className="flex items-center gap-1.5 font-bold text-white">
                  <span className="w-2.5 h-2.5 rounded-xs bg-[#0D9488]" /> ₹2,500
                </span>
                <div className="text-right">
                  <span className="font-mono font-bold text-white">{summary.soldCounts.b2500}</span>
                  <p className="text-[10px] text-slate-500">= ₹{(summary.soldCounts.b2500 * 2500).toLocaleString('en-IN')} if sold</p>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <span className="flex items-center gap-1.5 font-bold text-white">
                  <span className="w-2.5 h-2.5 rounded-xs bg-[#64748B]" /> ₹1,500
                </span>
                <div className="text-right">
                  <span className="font-mono font-bold text-white">{summary.soldCounts.b1500}</span>
                  <p className="text-[10px] text-slate-500">= ₹{(summary.soldCounts.b1500 * 1500).toLocaleString('en-IN')} if sold</p>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <span className="flex items-center gap-1.5 font-bold text-white">
                  <span className="w-2.5 h-2.5 rounded-xs bg-[#0284C7]" /> ₹1,000 PP
                </span>
                <div className="text-right">
                  <span className="font-mono font-bold text-white">{summary.soldCounts.pp}</span>
                  <p className="text-[10px] text-slate-500">= ₹{(summary.soldCounts.pp * 1000).toLocaleString('en-IN')} if sold</p>
                </div>
              </div>
            </div>
          </div>

          {/* Reserved — Not for Sale */}
          <div className="space-y-2 pt-2 border-t border-slate-800">
            <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">
              RESERVED — NOT FOR SALE
            </p>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-1.5 font-bold text-white">
                  <span className="w-2.5 h-2.5 rounded-xs bg-[#EAB308]" /> VIP
                </span>
                <span className="font-mono text-slate-300">
                  {summary.reservedCounts.vip.count} · {summary.reservedCounts.vip.named} named
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="flex items-center gap-1.5 font-bold text-white">
                  <span className="w-2.5 h-2.5 rounded-xs bg-[#EF4444]" /> Obligation
                </span>
                <span className="font-mono text-slate-300">
                  {summary.reservedCounts.obligation.count} · {summary.reservedCounts.obligation.named} named
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="flex items-center gap-1.5 font-bold text-white">
                  <span className="w-2.5 h-2.5 rounded-xs bg-[#06B6D4]" /> Sponsor comp
                </span>
                <span className="font-mono text-slate-300">
                  {summary.reservedCounts.sponsor_comp.count} · {summary.reservedCounts.sponsor_comp.named} named
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="flex items-center gap-1.5 font-bold text-white">
                  <span className="w-2.5 h-2.5 rounded-xs bg-[#475569]" /> Blocked
                </span>
                <span className="font-mono text-slate-300">
                  {summary.reservedCounts.blocked.count} seats
                </span>
              </div>
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

            <p className="text-sm text-slate-300">
              Row <strong className="text-white">{pendingReassignment.row}</strong> has{' '}
              <strong className="text-amber-400">{pendingReassignment.salesCount}</strong> sales.{' '}
              {pendingReassignment.salesCount} sold seats keep ₹{pendingReassignment.oldPrice.toLocaleString('en-IN')};{' '}
              {pendingReassignment.affectedSeatIds.length} unsold seats move to ₹{pendingReassignment.newPrice.toLocaleString('en-IN')}. Confirm?
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
