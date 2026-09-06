'use client';

import React, { useState, useMemo } from 'react';
import { 
  GROUND_FLOOR_LAYOUT, 
  BALCONY_LAYOUT, 
  RowLayoutConfig 
} from '@/lib/seat-layout-config';
import { getSeatColor } from '@/lib/seat-utils';
import { formatINR } from '@/lib/constants';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { 
  Crown, 
  Sparkles,
  Info,
  Filter,
  Lock,
  CheckCircle2,
  AlertCircle,
  Building2,
  Shield,
  Loader2,
  X
} from 'lucide-react';
import type { SeatSection, SeatData, VenueRow, Band } from '@/lib/types';

interface SeatMapProps {
  seats: SeatData[];
  bands?: Band[];
  rows?: VenueRow[];
  onSeatClick?: (seat: SeatData) => void;
  compact?: boolean;
  enableSeatBlocking?: boolean;
  onBlockSeats?: (seatIds: string[], reason: string) => Promise<any>;
  onUnblockSeats?: (seatIds: string[]) => Promise<any>;
  onBlockRow?: (section: SeatSection, rowLabel: string, reason: string) => Promise<any>;
  onUnblockRow?: (section: SeatSection, rowLabel: string) => Promise<any>;
}

type FilterType = 'all' | '5000' | '3500' | '2500' | '1500' | 'vip' | 'blocked' | 'sponsor' | 'paid' | 'unpaid' | 'empty';

export default function SeatMap({
  seats,
  bands,
  rows,
  onSeatClick,
  compact = false,
  enableSeatBlocking = false,
  onBlockSeats,
  onUnblockSeats,
  onBlockRow,
  onUnblockRow,
}: SeatMapProps) {
  const [selectedFloor, setSelectedFloor] = useState<SeatSection>('Ground Floor');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [selectedSeat, setSelectedSeat] = useState<SeatData | null>(null);

  // Exact seat multi-selection for blocking
  const [selectedSeatIds, setSelectedSeatIds] = useState<Set<string>>(new Set());
  const [blockReason, setBlockReason] = useState<string>('VIP / Reserved');
  const [isBlockingAction, setIsBlockingAction] = useState<boolean>(false);

  // Multi-key quick lookup map for fast rendering
  const seatLookup = useMemo(() => {
    const map = new Map<string, SeatData>();
    for (const s of seats) {
      const num = Number(s.seat_no);
      map.set(s.id, s);
      map.set(`${s.section}-${s.row_label}-${num}`, s);
      map.set(`${s.section}-${s.row_label}-${s.seat_no}`, s);
      if (s.section === 'Ground Floor') {
        map.set(`GF-${s.row_label}-${num}`, s);
        map.set(`GF-${s.row_label}-${String(num).padStart(2, '0')}`, s);
      } else {
        map.set(`BAL-${s.row_label}-${num}`, s);
        map.set(`BAL-${s.row_label}-${String(num).padStart(2, '0')}`, s);
      }
    }
    return map;
  }, [seats]);

  // Floor seats
  const floorSeats = useMemo(() => {
    return seats.filter((s) => s.section === selectedFloor);
  }, [seats, selectedFloor]);

  // SPL VIP seats for Ground Floor (50 seats)
  const vipSeats = useMemo(() => {
    if (selectedFloor !== 'Ground Floor') return [];
    return floorSeats
      .filter((s) => s.row_label === 'SPL VIP' || s.id.includes('SPL VIP'))
      .sort((a, b) => Number(a.seat_no) - Number(b.seat_no));
  }, [floorSeats, selectedFloor]);

  // Ordered Sequential Sold Seats Map derived from band metrics
  // Shows X seats from each band colored as sold in an ordered sequential way (GF -> Balcony, Row A -> N, Seat 1 -> end)
  const orderedSoldStatusMap = useMemo(() => {
    const map = new Map<string, 'paid' | 'pending'>();
    if (!bands || bands.length === 0) return map;

    const rowOrder = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N'];

    for (const band of bands) {
      const soldCount = band.sold_count || 0;
      if (soldCount <= 0) continue;

      const paidCount = band.paid_count !== undefined 
        ? band.paid_count 
        : (band.collected_amount ? Math.min(soldCount, Math.floor(band.collected_amount / band.price)) : soldCount);
      const pendingCount = Math.max(0, soldCount - paidCount);

      // Find all regular sellable seats matching this band tier
      const bandSellableSeats = seats.filter((s) => {
        if (s.row_label === 'SPL VIP') return false;
        if (s.is_blocked) return false;
        if (s.sponsor_id) return false;
        const effectiveTier = s.tier === 3000 ? 3500 : s.tier;
        return effectiveTier === band.price;
      });

      // Sort deterministically: Ground Floor first, then Balcony; alphabetical row A->N; numerical seat_no ascending
      bandSellableSeats.sort((a, b) => {
        if (a.section !== b.section) {
          return a.section === 'Ground Floor' ? -1 : 1;
        }
        const rowDiff = rowOrder.indexOf(a.row_label) - rowOrder.indexOf(b.row_label);
        if (rowDiff !== 0) return rowDiff;
        return Number(a.seat_no) - Number(b.seat_no);
      });

      // Assign the first `paidCount` seats as 'paid'
      for (let i = 0; i < paidCount && i < bandSellableSeats.length; i++) {
        map.set(bandSellableSeats[i].id, 'paid');
      }

      // Assign the next `pendingCount` seats as 'pending'
      for (let i = paidCount; i < (paidCount + pendingCount) && i < bandSellableSeats.length; i++) {
        map.set(bandSellableSeats[i].id, 'pending');
      }
    }

    return map;
  }, [seats, bands]);

  // Floor stats
  const floorStats = useMemo(() => {
    const regularTotal = selectedFloor === 'Ground Floor' ? 648 : 750;
    const vipTotal = selectedFloor === 'Ground Floor' ? 50 : 0;
    const total = regularTotal + vipTotal;

    const filled = floorSeats.filter((s) => 
      orderedSoldStatusMap.has(s.id) || (s.guest_name && s.guest_name.trim() !== '')
    ).length;

    const paid = floorSeats.filter((s) => 
      orderedSoldStatusMap.get(s.id) === 'paid' || (s.payment_status || '').toLowerCase() === 'received'
    ).length;

    const checkedIn = floorSeats.filter((s) => s.checked_in).length;
    const blocked = floorSeats.filter((s) => s.is_blocked).length;
    const sponsored = floorSeats.filter((s) => s.sponsor_id).length;
    const potentialRevenue = floorSeats.reduce((acc, s) => acc + (s.tier || 0), 0);
    const receivedRevenue = floorSeats
      .filter((s) => orderedSoldStatusMap.get(s.id) === 'paid' || (s.payment_status || '').toLowerCase() === 'received')
      .reduce((acc, s) => acc + (s.tier || 0), 0);

    return { 
      total, 
      regularTotal, 
      vipTotal, 
      filled, 
      paid, 
      checkedIn,
      blocked,
      sponsored,
      potentialRevenue, 
      receivedRevenue 
    };
  }, [floorSeats, selectedFloor, orderedSoldStatusMap]);

  // Filter matching predicate
  const matchesFilter = (seat: SeatData | undefined) => {
    if (!seat) return false;
    if (activeFilter === 'all') return true;
    if (activeFilter === '5000') return seat.tier === 5000;
    if (activeFilter === '3500') return seat.tier === 3500 || seat.tier === 3000;
    if (activeFilter === '2500') return seat.tier === 2500;
    if (activeFilter === '1500') return seat.tier === 1500;
    if (activeFilter === 'vip') return seat.obligation === 'chief' || seat.row_label === 'SPL VIP';
    if (activeFilter === 'blocked') return Boolean(seat.is_blocked);
    if (activeFilter === 'sponsor') return Boolean(seat.sponsor_id || seat.obligation === 'sponsor');
    if (activeFilter === 'paid') return orderedSoldStatusMap.get(seat.id) === 'paid' || (seat.payment_status || '').toLowerCase() === 'received';
    if (activeFilter === 'unpaid') return orderedSoldStatusMap.get(seat.id) === 'pending' || Boolean(seat.guest_name && (seat.payment_status || '').toLowerCase() === 'pending');
    if (activeFilter === 'empty') return !orderedSoldStatusMap.has(seat.id) && !seat.guest_name && !seat.is_blocked && !seat.sponsor_id && seat.row_label !== 'SPL VIP';
    return true;
  };

  const rowLabels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N'];

  // Exact seat toggle for blocking
  const toggleSeatSelection = (seat: SeatData) => {
    if (!enableSeatBlocking) {
      setSelectedSeat(seat);
      onSeatClick?.(seat);
      return;
    }
    // SPL VIP seats cannot be blocked/edited
    if (seat.row_label === 'SPL VIP') {
      setSelectedSeat(seat);
      onSeatClick?.(seat);
      return;
    }

    const next = new Set(selectedSeatIds);
    if (next.has(seat.id)) {
      next.delete(seat.id);
    } else {
      next.add(seat.id);
    }
    setSelectedSeatIds(next);
    setSelectedSeat(seat);
    onSeatClick?.(seat);
  };

  // Row selection toggle
  const toggleRowSelection = (section: SeatSection, rowLetter: string) => {
    if (!enableSeatBlocking) return;
    const rowSeats = floorSeats.filter(
      (s) => s.section === section && s.row_label === rowLetter && s.row_label !== 'SPL VIP'
    );
    if (rowSeats.length === 0) return;

    const next = new Set(selectedSeatIds);
    const allSelected = rowSeats.every((s) => next.has(s.id));

    if (allSelected) {
      rowSeats.forEach((s) => next.delete(s.id));
    } else {
      rowSeats.forEach((s) => next.add(s.id));
    }
    setSelectedSeatIds(next);
  };

  const handleBlockSelected = async () => {
    if (!onBlockSeats || selectedSeatIds.size === 0) return;
    setIsBlockingAction(true);
    try {
      await onBlockSeats(Array.from(selectedSeatIds), blockReason);
      setSelectedSeatIds(new Set());
    } finally {
      setIsBlockingAction(false);
    }
  };

  const handleUnblockSelected = async () => {
    if (!onUnblockSeats || selectedSeatIds.size === 0) return;
    setIsBlockingAction(true);
    try {
      await onUnblockSeats(Array.from(selectedSeatIds));
      setSelectedSeatIds(new Set());
    } finally {
      setIsBlockingAction(false);
    }
  };

  // High-Contrast Distinct Color Resolver
  const getSeatPillBg = (seat?: SeatData) => {
    if (!seat) return '#334E68';
    if (seat.row_label === 'SPL VIP' || seat.obligation === 'chief') return '#8B5CF6'; // Royal Purple VIP Box
    if (seat.is_blocked) return '#BE123C'; // Deep Crimson (Blocked / Reserved)
    if (seat.sponsor_id || seat.obligation === 'sponsor') return '#06B6D4'; // Vibrant Cyan (Sponsor Complimentary)
    if (seat.checked_in) return '#0284C7'; // Sky Blue (Checked in)

    // Dynamic sequential overview coloring for sold passes
    const orderedStatus = orderedSoldStatusMap.get(seat.id);
    if (orderedStatus === 'paid') return '#10B981'; // Emerald Green (Sold & Paid)
    if (orderedStatus === 'pending') return '#F97316'; // Amber Orange (Sold & Pending)

    if ((seat.payment_status || '').toLowerCase() === 'received' && seat.guest_name) return '#10B981'; // Emerald Green
    if (seat.guest_name && seat.guest_name.trim() !== '') return '#F97316'; // Amber Orange

    if (seat.tier === 5000) return '#F59E0B'; // Amber Gold (Band A)
    if (seat.tier === 3500 || seat.tier === 3000) return '#A855F7'; // Violet Purple (Band B)
    if (seat.tier === 2500) return '#0D9488'; // Teal (Band C)
    if (seat.tier === 1500) return '#64748B'; // Steel Slate (Band D)
    return '#334E68'; // Unassigned default slate
  };

  return (
    <div className="space-y-5">
      {/* 1. Header & Floor Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-[#0F2236] p-4 sm:p-5 rounded-2xl border border-[#243D56] shadow-xl text-white">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">
              The Music Academy Seating Blueprint
            </h3>
            <Badge className="border-amber-400/40 bg-amber-500/20 text-amber-300 font-bold text-xs">
              Live Architectural Layout
            </Badge>
          </div>
          <p className="text-xs text-slate-300 mt-1">
            Exact architectural representation: Ground Floor (648 regular + 50 VIP) and Balcony (750 seats).
          </p>
        </div>

        {/* Floor Switcher Buttons */}
        <div className="inline-flex p-1 bg-[#081522] rounded-xl border border-[#243D56]">
          <button
            type="button"
            onClick={() => {
              setSelectedFloor('Ground Floor');
              setSelectedSeat(null);
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              selectedFloor === 'Ground Floor'
                ? 'bg-[#E8913A] text-slate-950 shadow-md'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <span>Ground Floor</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold ${
              selectedFloor === 'Ground Floor' 
                ? 'bg-slate-950 text-amber-300' 
                : 'bg-slate-800 text-slate-300'
            }`}>
              648 + 50 VIP
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setSelectedFloor('Balcony');
              setSelectedSeat(null);
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              selectedFloor === 'Balcony'
                ? 'bg-[#E8913A] text-slate-950 shadow-md'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <span>Balcony</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold ${
              selectedFloor === 'Balcony' 
                ? 'bg-slate-950 text-amber-300' 
                : 'bg-slate-800 text-slate-300'
            }`}>
              750
            </span>
          </button>
        </div>
      </div>

      {/* 2. Floor Live Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-[#0F2236] p-3.5 rounded-xl border border-[#243D56] shadow-xs text-white">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Regular Capacity</span>
          <span className="text-xl font-extrabold text-white mt-0.5 block font-mono">{floorStats.regularTotal}</span>
        </div>
        
        {selectedFloor === 'Ground Floor' ? (
          <div className="bg-[#0F2236] p-3.5 rounded-xl border border-purple-800/60 shadow-xs text-white">
            <span className="text-[10px] font-bold text-purple-300 uppercase tracking-wider block flex items-center gap-1">
              <Crown className="w-3 h-3 text-purple-400" /> VIP Box (Reserved)
            </span>
            <span className="text-xl font-extrabold text-purple-300 mt-0.5 block font-mono">50 Seats</span>
          </div>
        ) : (
          <div className="bg-[#0F2236] p-3.5 rounded-xl border border-[#243D56] shadow-xs text-white">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Balcony Columns</span>
            <span className="text-xl font-extrabold text-white mt-0.5 block font-mono">4 Blocks</span>
          </div>
        )}

        <div className="bg-[#0F2236] p-3.5 rounded-xl border border-[#243D56] shadow-xs text-white">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Filled / Sold</span>
          <span className="text-xl font-extrabold text-[#E8913A] mt-0.5 block font-mono">{floorStats.filled}</span>
        </div>
        <div className="bg-[#0F2236] p-3.5 rounded-xl border border-[#243D56] shadow-xs text-white">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Paid Passes</span>
          <span className="text-xl font-extrabold text-emerald-400 mt-0.5 block font-mono">{floorStats.paid}</span>
        </div>
        <div className="bg-[#0F2236] p-3.5 rounded-xl border border-[#243D56] shadow-xs text-white">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Checked In</span>
          <span className="text-xl font-extrabold text-sky-400 mt-0.5 block font-mono">{floorStats.checkedIn}</span>
        </div>
        <div className="bg-[#0F2236] p-3.5 rounded-xl border border-[#243D56] shadow-xs text-white">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Collected</span>
          <span className="text-base font-extrabold text-emerald-400 mt-1 block font-mono">{formatINR(floorStats.receivedRevenue)}</span>
        </div>
      </div>

      {/* 3. Filter Chips & Legend Bar */}
      <div className="bg-[#0F2236] p-4 rounded-2xl border border-[#243D56] shadow-md space-y-3 text-white">
        <div className="flex items-center justify-between gap-2 flex-wrap pb-2 border-b border-[#1E3750]">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
            <Filter className="w-3.5 h-3.5 text-[#E8913A]" />
            <span>Highlight on Map:</span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <Button
              size="sm"
              variant={activeFilter === 'all' ? 'default' : 'outline'}
              className={activeFilter === 'all' ? 'bg-[#E8913A] text-slate-950 font-bold h-8 text-xs' : 'text-slate-300 bg-[#162C42] border-[#2A4866] hover:bg-[#1E3B5A] text-xs h-8'}
              onClick={() => setActiveFilter('all')}
            >
              All Seats
            </Button>
            <Button
              size="sm"
              variant={activeFilter === '5000' ? 'default' : 'outline'}
              className={activeFilter === '5000' ? 'bg-[#F59E0B] text-slate-950 font-bold h-8 text-xs' : 'text-[#F59E0B] border-[#F59E0B]/40 bg-[#F59E0B]/10 text-xs h-8'}
              onClick={() => setActiveFilter('5000')}
            >
              ₹5,000 Tier
            </Button>
            <Button
              size="sm"
              variant={activeFilter === '3500' ? 'default' : 'outline'}
              className={activeFilter === '3500' ? 'bg-[#A855F7] text-white font-bold h-8 text-xs' : 'text-purple-300 border-purple-800 bg-purple-950/40 text-xs h-8'}
              onClick={() => setActiveFilter('3500')}
            >
              ₹3,500 Tier
            </Button>
            <Button
              size="sm"
              variant={activeFilter === '2500' ? 'default' : 'outline'}
              className={activeFilter === '2500' ? 'bg-[#0D9488] text-white font-bold h-8 text-xs' : 'text-teal-300 border-teal-800 bg-teal-950/40 text-xs h-8'}
              onClick={() => setActiveFilter('2500')}
            >
              ₹2,500 Tier
            </Button>
            <Button
              size="sm"
              variant={activeFilter === '1500' ? 'default' : 'outline'}
              className={activeFilter === '1500' ? 'bg-[#64748B] text-white font-bold h-8 text-xs' : 'text-slate-300 border-slate-700 bg-slate-800 text-xs h-8'}
              onClick={() => setActiveFilter('1500')}
            >
              ₹1,500 Tier
            </Button>
            <Button
              size="sm"
              variant={activeFilter === 'vip' ? 'default' : 'outline'}
              className={activeFilter === 'vip' ? 'bg-[#8B5CF6] text-white font-bold h-8 text-xs' : 'text-purple-300 border-purple-800 bg-purple-950/40 text-xs h-8 flex items-center gap-1'}
              onClick={() => setActiveFilter('vip')}
            >
              <Crown className="w-3 h-3" /> VIP Box (Non-editable)
            </Button>
            <Button
              size="sm"
              variant={activeFilter === 'blocked' ? 'default' : 'outline'}
              className={activeFilter === 'blocked' ? 'bg-[#BE123C] text-white font-bold h-8 text-xs' : 'text-rose-400 border-rose-800 bg-rose-950/40 text-xs h-8 flex items-center gap-1'}
              onClick={() => setActiveFilter('blocked')}
            >
              <Lock className="w-3 h-3" /> Blocked / Reserved
            </Button>
            <Button
              size="sm"
              variant={activeFilter === 'sponsor' ? 'default' : 'outline'}
              className={activeFilter === 'sponsor' ? 'bg-[#06B6D4] text-slate-950 font-bold h-8 text-xs' : 'text-cyan-300 border-cyan-800 bg-cyan-950/40 text-xs h-8 flex items-center gap-1'}
              onClick={() => setActiveFilter('sponsor')}
            >
              <Building2 className="w-3 h-3" /> Sponsor Comp
            </Button>
            <Button
              size="sm"
              variant={activeFilter === 'paid' ? 'default' : 'outline'}
              className={activeFilter === 'paid' ? 'bg-[#10B981] text-slate-950 font-bold h-8 text-xs' : 'text-emerald-300 border-emerald-800 bg-emerald-950/40 text-xs h-8'}
              onClick={() => setActiveFilter('paid')}
            >
              Paid / Issued
            </Button>
            <Button
              size="sm"
              variant={activeFilter === 'unpaid' ? 'default' : 'outline'}
              className={activeFilter === 'unpaid' ? 'bg-[#F97316] text-white font-bold h-8 text-xs' : 'text-amber-400 border-amber-800 bg-amber-950/40 text-xs h-8'}
              onClick={() => setActiveFilter('unpaid')}
            >
              Pending
            </Button>
            <Button
              size="sm"
              variant={activeFilter === 'empty' ? 'default' : 'outline'}
              className={activeFilter === 'empty' ? 'bg-slate-600 text-white font-bold h-8 text-xs' : 'text-slate-400 border-slate-700 bg-slate-900 text-xs h-8'}
              onClick={() => setActiveFilter('empty')}
            >
              Available
            </Button>
          </div>
        </div>

        {/* Visual Color Legend */}
        <div className="flex items-center gap-4 text-[11px] text-slate-300 flex-wrap pt-1">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-xs bg-[#F59E0B] inline-block shadow-xs"></span>
            <span>₹5,000 Tier</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-xs bg-[#A855F7] inline-block shadow-xs"></span>
            <span>₹3,500 Tier</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-xs bg-[#0D9488] inline-block shadow-xs"></span>
            <span>₹2,500 Tier</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-xs bg-[#64748B] inline-block shadow-xs"></span>
            <span>₹1,500 Tier</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-xs bg-[#8B5CF6] inline-block border border-purple-400 shadow-xs"></span>
            <span className="font-bold text-purple-300 flex items-center gap-1">
              <Crown className="w-3 h-3" /> VIP Box (50 Seats)
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-xs bg-[#BE123C] inline-block shadow-xs"></span>
            <span className="font-bold text-rose-300 flex items-center gap-1">
              <Lock className="w-3 h-3" /> Blocked / Reserved
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-xs bg-[#06B6D4] inline-block shadow-xs"></span>
            <span className="font-bold text-cyan-300 flex items-center gap-1">
              <Building2 className="w-3 h-3" /> Sponsor Comp
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-xs bg-[#10B981] inline-block shadow-xs"></span>
            <span>Paid Pass</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-xs bg-[#F97316] inline-block shadow-xs"></span>
            <span>Pending</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-xs bg-[#0284C7] inline-block shadow-xs"></span>
            <span>Checked In</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-xs bg-[#334E68] border border-slate-600 inline-block"></span>
            <span>Available</span>
          </div>
        </div>
      </div>

      {/* 4. Main Architectural Hall Seating Canvas */}
      <div className="bg-[#0A1624] text-slate-100 p-5 sm:p-7 rounded-3xl border border-[#243D56] shadow-2xl overflow-x-auto relative">
        <div className="min-w-[860px] max-w-[1150px] mx-auto space-y-6">

          {/* STAGE / DAIS HEADER */}
          <div className="flex flex-col items-center justify-center space-y-2">
            <div className="relative w-3/4 max-w-2xl py-3 px-8 rounded-b-2xl bg-gradient-to-b from-[#13283E] to-[#08121D] border border-slate-700/80 shadow-2xl flex flex-col items-center justify-center">
              <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-48 h-1 bg-amber-400/80 rounded-full blur-xs"></div>
              <span className="text-sm font-bold tracking-widest text-amber-300 uppercase">
                {selectedFloor === 'Ground Floor' ? 'STAGE & PERFORMANCE AREA' : 'DAIS / BALCONY FRONT RAILING'}
              </span>
              <span className="text-[10px] text-slate-400 font-mono tracking-wider mt-0.5">
                THE MUSIC ACADEMY, MADRAS
              </span>
            </div>

            {selectedFloor === 'Ground Floor' && (
              <div className="w-1/2 max-w-md py-1 px-4 rounded-md bg-[#08121D] border border-slate-800 text-center">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
                  ORCHESTRA PIT
                </span>
              </div>
            )}
          </div>

          {/* GROUND FLOOR: SPL VIP BOX (NON-EDITABLE) + 3-BLOCK SEATING GRID */}
          {selectedFloor === 'Ground Floor' ? (
            <div className="grid grid-cols-12 gap-4 items-start pt-2">
              {/* Left Column: SPL VIP Section (50 seats) - NON-EDITABLE */}
              <div className="col-span-2 bg-[#08121D] p-3 rounded-2xl border-2 border-purple-800/70 shadow-inner space-y-2">
                <div className="flex items-center justify-between pb-1 border-b border-purple-900/50">
                  <div className="flex items-center gap-1.5">
                    <Crown className="w-3.5 h-3.5 text-purple-400" />
                    <span className="text-xs font-black text-purple-300">SPL VIP</span>
                  </div>
                  <span title="Non-editable VIP Box">
                    <Lock className="w-3 h-3 text-purple-400" />
                  </span>
                </div>
                <div className="text-[10px] text-purple-300 font-semibold">50 Seats (Reserved)</div>
                <div className="text-[9px] text-slate-400 leading-tight">Chief Guest & Dignitaries • Non-editable</div>

                <div className="grid grid-cols-5 gap-1 pt-1.5">
                  {Array.from({ length: 50 }, (_, i) => {
                    const seatNum = i + 1;
                    const existingVip = vipSeats.find((s) => Number(s.seat_no) === seatNum);
                    const seat: SeatData = existingVip || {
                      id: `GF-SPL VIP-${seatNum}`,
                      section: 'Ground Floor',
                      row_label: 'SPL VIP',
                      seat_no: seatNum,
                      tier: null,
                      obligation: 'chief',
                      guest_name: null,
                      payment_status: 'pending',
                      checked_in: false,
                    };

                    const isDimmed = activeFilter !== 'all' && activeFilter !== 'vip';

                    return (
                      <button
                        key={seatNum}
                        type="button"
                        onClick={() => {
                          setSelectedSeat(seat);
                          onSeatClick?.(seat);
                        }}
                        title={`Seat GF-SPL VIP-${seatNum} (Reserved VIP Box — Non-editable)`}
                        className={`h-4 min-w-[14px] px-0.5 rounded-[3px] text-[8px] font-mono font-bold flex items-center justify-center transition-all cursor-pointer shadow-2xs hover:scale-125 hover:z-20 bg-[#8B5CF6] text-white border border-purple-400/60 ${
                          isDimmed ? 'opacity-20 saturate-0' : 'opacity-100'
                        }`}
                      >
                        {seatNum}
                      </button>
                    );
                  })}
                </div>
                <div className="text-[9px] text-purple-400/80 text-center pt-2 font-mono uppercase tracking-wider">
                  ← VIP Entrance
                </div>
              </div>

              {/* Center & Right 10 Columns: Main Ground Floor Rows A to N (648 seats) */}
              <div className="col-span-10 space-y-1.5 bg-[#08121D] p-4 rounded-2xl border border-slate-800">
                <div className="flex justify-between items-center px-1 pb-1 border-b border-slate-800 text-[11px] text-slate-400">
                  <span className="font-bold text-white">Main Ground Floor (648 Regular Seats)</span>
                  <span className="font-mono">Rows A to N (3 Blocks: Left, Center, Right)</span>
                </div>

                {rowLabels.map((rowLetter) => {
                  const config = GROUND_FLOOR_LAYOUT[rowLetter];
                  if (!config) return null;

                  return (
                    <div key={rowLetter} className="flex items-center gap-2 group">
                      {/* Left Row Label */}
                      <button
                        type="button"
                        onClick={() => toggleRowSelection('Ground Floor', rowLetter)}
                        disabled={!enableSeatBlocking}
                        title={enableSeatBlocking ? `Click to select / deselect Row ${rowLetter}` : undefined}
                        className={`text-xs font-mono font-bold text-amber-400 w-5 text-center shrink-0 rounded transition-all ${
                          enableSeatBlocking ? 'hover:bg-amber-400 hover:text-slate-950 cursor-pointer' : ''
                        }`}
                      >
                        {rowLetter}
                      </button>

                      {/* Row Blocks Container */}
                      <div className="flex-1 flex items-center justify-between gap-3">
                        {config.blocks.map((block, bIdx) => (
                          <React.Fragment key={block.blockName}>
                            <div className="flex items-center gap-1 flex-1 justify-center">
                              {Array.from({ length: block.endSeat - block.startSeat + 1 }, (_, i) => {
                                const seatNum = block.startSeat + i;
                                const seat = seatLookup.get(`Ground Floor-${rowLetter}-${seatNum}`) || 
                                             seatLookup.get(`GF-${rowLetter}-${seatNum}`) ||
                                             seatLookup.get(`GF-${rowLetter}-${String(seatNum).padStart(2, '0')}`);
                                
                                const isDimmed = activeFilter !== 'all' && !matchesFilter(seat);
                                const seatBg = getSeatPillBg(seat);

                                const effectiveSeat: SeatData = seat || {
                                  id: `GF-${rowLetter}-${seatNum}`,
                                  section: 'Ground Floor',
                                  row_label: rowLetter,
                                  seat_no: seatNum,
                                  tier: null,
                                  obligation: null,
                                  guest_name: null,
                                  payment_status: 'pending',
                                  checked_in: false,
                                };

                                const isSelected = selectedSeatIds.has(effectiveSeat.id);

                                return (
                                  <button
                                    key={seatNum}
                                    type="button"
                                    onClick={() => toggleSeatSelection(effectiveSeat)}
                                    title={`Seat ${effectiveSeat.id} • ${
                                      effectiveSeat.row_label === 'SPL VIP'
                                        ? 'VIP Box'
                                        : effectiveSeat.is_blocked
                                        ? 'Blocked: ' + (effectiveSeat.blocked_reason || 'VIP')
                                        : effectiveSeat.sponsor_id
                                        ? 'Sponsor Comp'
                                        : orderedSoldStatusMap.get(effectiveSeat.id) === 'paid'
                                        ? 'Sold (Paid)'
                                        : orderedSoldStatusMap.get(effectiveSeat.id) === 'pending'
                                        ? 'Sold (Pending)'
                                        : effectiveSeat.tier
                                        ? '₹' + effectiveSeat.tier
                                        : 'Available'
                                    } • Row ${rowLetter}`}
                                    className={`h-4 min-w-[14px] px-0.5 rounded-[3px] text-[8px] font-mono font-medium flex items-center justify-center transition-all cursor-pointer shadow-2xs hover:scale-125 hover:z-20 text-white ${
                                      isDimmed ? 'opacity-20 saturate-0' : 'opacity-100'
                                    } ${
                                      isSelected ? 'ring-2 ring-white outline-2 outline-blue-500 scale-125 z-10 font-black shadow-lg' : ''
                                    }`}
                                    style={{ backgroundColor: seatBg }}
                                  >
                                    {seatNum}
                                  </button>
                                );
                              })}
                            </div>

                            {/* Aisle Walkway Spacer */}
                            {bIdx < config.blocks.length - 1 && (
                              <div className="w-5 h-6 flex items-center justify-center shrink-0">
                                <span className="text-[8px] font-mono text-slate-600 rotate-90 tracking-tighter">
                                  AISLE
                                </span>
                              </div>
                            )}
                          </React.Fragment>
                        ))}
                      </div>

                      {/* Right Row Label */}
                      <button
                        type="button"
                        onClick={() => toggleRowSelection('Ground Floor', rowLetter)}
                        disabled={!enableSeatBlocking}
                        title={enableSeatBlocking ? `Click to select / deselect Row ${rowLetter}` : undefined}
                        className={`text-xs font-mono font-bold text-amber-400 w-5 text-center shrink-0 rounded transition-all ${
                          enableSeatBlocking ? 'hover:bg-amber-400 hover:text-slate-950 cursor-pointer' : ''
                        }`}
                      >
                        {rowLetter}
                      </button>
                    </div>
                  );
                })}

                {/* Audio Console & Rear Aisle */}
                <div className="pt-4 flex flex-col items-center justify-center space-y-2">
                  <div className="w-1/3 max-w-xs py-2 px-4 rounded-xl bg-[#0E1C2B] border border-slate-700 text-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      AUDIO CONSOLE BOOTH
                    </span>
                  </div>
                  <div className="w-full py-1 text-center border-t border-dashed border-slate-800">
                    <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest">
                      REAR AISLE & REAR EXITS
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* BALCONY: 4-COLUMN SEATING GRID (750 SEATS) */
            <div className="space-y-1.5 bg-[#08121D] p-5 rounded-2xl border border-slate-800">
              <div className="flex justify-between items-center px-1 pb-2 border-b border-slate-800 text-[11px] text-slate-400">
                <span className="font-bold text-white">Balcony Seating (750 Regular Seats)</span>
                <span className="font-mono">Rows A to N (4 Seating Columns / Blocks)</span>
              </div>

              {rowLabels.map((rowLetter) => {
                const config = BALCONY_LAYOUT[rowLetter];
                if (!config) return null;

                return (
                  <div key={rowLetter} className="flex items-center gap-2 group">
                    <button
                      type="button"
                      onClick={() => toggleRowSelection('Balcony', rowLetter)}
                      disabled={!enableSeatBlocking}
                      title={enableSeatBlocking ? `Click to select / deselect Row ${rowLetter}` : undefined}
                      className={`text-xs font-mono font-bold text-amber-400 w-5 text-center shrink-0 rounded transition-all ${
                        enableSeatBlocking ? 'hover:bg-amber-400 hover:text-slate-950 cursor-pointer' : ''
                      }`}
                    >
                      {rowLetter}
                    </button>

                    <div className="flex-1 flex items-center justify-between gap-3">
                      {config.blocks.map((block, bIdx) => (
                        <React.Fragment key={block.blockName}>
                          <div className="flex items-center gap-1 flex-1 justify-center">
                            {Array.from({ length: block.endSeat - block.startSeat + 1 }, (_, i) => {
                              const seatNum = block.startSeat + i;
                              const seat = seatLookup.get(`Balcony-${rowLetter}-${seatNum}`) || 
                                           seatLookup.get(`BAL-${rowLetter}-${seatNum}`) ||
                                           seatLookup.get(`BAL-${rowLetter}-${String(seatNum).padStart(2, '0')}`);
                              
                              const isDimmed = activeFilter !== 'all' && !matchesFilter(seat);
                              const seatBg = getSeatPillBg(seat);

                              const effectiveSeat: SeatData = seat || {
                                id: `BAL-${rowLetter}-${seatNum}`,
                                section: 'Balcony',
                                row_label: rowLetter,
                                seat_no: seatNum,
                                tier: null,
                                obligation: null,
                                guest_name: null,
                                payment_status: 'pending',
                                checked_in: false,
                              };

                              const isSelected = selectedSeatIds.has(effectiveSeat.id);

                              return (
                                <button
                                  key={seatNum}
                                  type="button"
                                  onClick={() => toggleSeatSelection(effectiveSeat)}
                                  title={`Seat ${effectiveSeat.id} • ${
                                      effectiveSeat.row_label === 'SPL VIP'
                                        ? 'VIP Box'
                                        : effectiveSeat.is_blocked
                                        ? 'Blocked: ' + (effectiveSeat.blocked_reason || 'VIP')
                                        : effectiveSeat.sponsor_id
                                        ? 'Sponsor Comp'
                                        : orderedSoldStatusMap.get(effectiveSeat.id) === 'paid'
                                        ? 'Sold (Paid)'
                                        : orderedSoldStatusMap.get(effectiveSeat.id) === 'pending'
                                        ? 'Sold (Pending)'
                                        : effectiveSeat.tier
                                        ? '₹' + effectiveSeat.tier
                                        : 'Available'
                                    } • Row ${rowLetter}`}
                                  className={`h-4 min-w-[14px] px-0.5 rounded-[3px] text-[8px] font-mono font-medium flex items-center justify-center transition-all cursor-pointer shadow-2xs hover:scale-125 hover:z-20 text-white ${
                                    isDimmed ? 'opacity-20 saturate-0' : 'opacity-100'
                                  } ${
                                    isSelected ? 'ring-2 ring-white outline-2 outline-blue-500 scale-125 z-10 font-black shadow-lg' : ''
                                  }`}
                                  style={{ backgroundColor: seatBg }}
                                >
                                  {seatNum}
                                </button>
                              );
                            })}
                          </div>

                          {bIdx < config.blocks.length - 1 && (
                            <div className="w-4 h-6 flex items-center justify-center shrink-0">
                              <span className="text-[7px] font-mono text-slate-600 rotate-90 tracking-tighter">
                                AISLE
                              </span>
                            </div>
                          )}
                        </React.Fragment>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleRowSelection('Balcony', rowLetter)}
                      disabled={!enableSeatBlocking}
                      title={enableSeatBlocking ? `Click to select / deselect Row ${rowLetter}` : undefined}
                      className={`text-xs font-mono font-bold text-amber-400 w-5 text-center shrink-0 rounded transition-all ${
                        enableSeatBlocking ? 'hover:bg-amber-400 hover:text-slate-950 cursor-pointer' : ''
                      }`}
                    >
                      {rowLetter}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 5. Sticky Action Toolbar for Exact Seat Blocking */}
      {enableSeatBlocking && selectedSeatIds.size > 0 && (
        <div className="sticky bottom-4 z-40 bg-[#081522]/95 backdrop-blur-md border-2 border-blue-500/80 p-4 rounded-2xl shadow-2xl flex flex-wrap items-center justify-between gap-4 text-white animate-in slide-in-from-bottom-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Badge className="bg-blue-600 text-white font-mono text-xs px-3 py-1 font-bold shadow-sm">
              {selectedSeatIds.size} {selectedSeatIds.size === 1 ? 'Seat' : 'Seats'} Selected
            </Badge>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-300 font-medium">Reason:</span>
              <Input
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                placeholder="e.g. VIP / Reserved / Sponsor Row"
                className="h-8 w-44 sm:w-60 bg-[#0F2236] border-slate-700 text-xs text-white"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              disabled={isBlockingAction}
              onClick={handleBlockSelected}
              className="bg-rose-600 hover:bg-rose-700 text-white font-bold h-8 text-xs flex items-center gap-1.5 shadow-md"
            >
              {isBlockingAction ? <Loader2 className="w-3 h-3 animate-spin" /> : <Lock className="w-3 h-3" />}
              Block as Reserved
            </Button>

            <Button
              size="sm"
              disabled={isBlockingAction}
              onClick={handleUnblockSelected}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-8 text-xs flex items-center gap-1.5 shadow-md"
            >
              {isBlockingAction ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
              Unblock / Release to Sell
            </Button>

            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedSeatIds(new Set())}
              className="text-slate-400 hover:text-white h-8 text-xs"
            >
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* 6. Selected Seat Inspection Modal / Card */}
      {selectedSeat && (
        <Card className="bg-[#0F2236] border-2 border-amber-500/50 p-4 rounded-2xl shadow-xl text-white animate-in fade-in-50">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-base font-extrabold text-amber-400 font-mono">
                  {selectedSeat.id}
                </span>
                <Badge className="bg-[#1A344E] text-slate-200 border-[#2A4D70] text-xs">
                  {selectedSeat.section} • Row {selectedSeat.row_label} • Seat #{selectedSeat.seat_no}
                </Badge>

                {selectedSeat.row_label === 'SPL VIP' || selectedSeat.obligation === 'chief' ? (
                  <Badge className="bg-purple-900 text-purple-200 border border-purple-600 text-xs font-bold flex items-center gap-1">
                    <Lock className="w-3 h-3" /> VIP Reserved (Non-editable)
                  </Badge>
                ) : selectedSeat.is_blocked ? (
                  <Badge className="bg-rose-950 text-rose-300 border border-rose-700 text-xs font-bold flex items-center gap-1">
                    <Lock className="w-3 h-3" /> Blocked: {selectedSeat.blocked_reason || 'Reserved'}
                  </Badge>
                ) : selectedSeat.sponsor_id || selectedSeat.obligation === 'sponsor' ? (
                  <Badge className="bg-cyan-950 text-cyan-300 border border-cyan-700 text-xs font-bold flex items-center gap-1">
                    <Building2 className="w-3 h-3" /> Sponsor Complimentary
                  </Badge>
                ) : selectedSeat.tier ? (
                  <Badge className="bg-amber-500 text-slate-950 font-bold text-xs font-mono">
                    {formatINR(selectedSeat.tier)}
                  </Badge>
                ) : (
                  <Badge className="bg-slate-700 text-slate-300 text-xs">
                    Unallocated
                  </Badge>
                )}
              </div>

              {selectedSeat.row_label === 'SPL VIP' || selectedSeat.obligation === 'chief' ? (
                <p className="text-xs text-purple-300 font-medium">
                  🔒 This seat is part of the Special VIP Box reserved exclusively for Chief Guests, Trust Dignitaries, and Officials. It is strictly non-editable and protected from public selling.
                </p>
              ) : selectedSeat.is_blocked ? (
                <p className="text-xs text-rose-300 font-medium">
                  🚫 This seat is blocked from sale ({selectedSeat.blocked_reason || 'VIP / Reserved'}). It will not appear in the selling console until released back.
                </p>
              ) : selectedSeat.sponsor_id ? (
                <p className="text-xs text-cyan-300 font-medium">
                  🏢 Allocated as a complimentary pass for Corporate Sponsor.
                </p>
              ) : (
                <p className="text-xs text-slate-300">
                  {selectedSeat.guest_name ? (
                    <>Passholder: <strong className="text-white">{selectedSeat.guest_name}</strong> {selectedSeat.guest_phone && `(${selectedSeat.guest_phone})`}</>
                  ) : (
                    <span className="text-slate-400 italic">Available in band quota — No specific donor assigned</span>
                  )}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Quick Block / Unblock Actions for inspected seat */}
              {enableSeatBlocking && selectedSeat.row_label !== 'SPL VIP' && (
                <>
                  {selectedSeat.is_blocked ? (
                    <Button
                      size="sm"
                      disabled={isBlockingAction}
                      onClick={async () => {
                        if (!onUnblockSeats) return;
                        setIsBlockingAction(true);
                        try {
                          await onUnblockSeats([selectedSeat.id]);
                          setSelectedSeat((prev) => (prev ? { ...prev, is_blocked: false, blocked_reason: undefined } : null));
                        } finally {
                          setIsBlockingAction(false);
                        }
                      }}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-8 text-xs flex items-center gap-1 shadow-xs"
                    >
                      {isBlockingAction ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                      Unblock Seat
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      disabled={isBlockingAction || Boolean(selectedSeat.guest_name)}
                      onClick={async () => {
                        if (!onBlockSeats) return;
                        setIsBlockingAction(true);
                        try {
                          await onBlockSeats([selectedSeat.id], blockReason);
                          setSelectedSeat((prev) => (prev ? { ...prev, is_blocked: true, blocked_reason: blockReason } : null));
                        } finally {
                          setIsBlockingAction(false);
                        }
                      }}
                      className="bg-rose-600 hover:bg-rose-700 text-white font-bold h-8 text-xs flex items-center gap-1 shadow-xs"
                      title={selectedSeat.guest_name ? 'Cannot block seat with pass issued' : undefined}
                    >
                      {isBlockingAction ? <Loader2 className="w-3 h-3 animate-spin" /> : <Lock className="w-3 h-3" />}
                      Block Seat
                    </Button>
                  )}
                </>
              )}

              {selectedSeat.row_label !== 'SPL VIP' && !selectedSeat.is_blocked && (
                <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                  (selectedSeat.payment_status || '').toLowerCase() === 'received'
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                    : 'bg-amber-950 text-amber-300 border border-amber-800'
                }`}>
                  {(selectedSeat.payment_status || '').toLowerCase() === 'received' ? '✓ Paid' : 'Pending / Open'}
                </span>
              )}

              {selectedSeat.checked_in && (
                <span className="bg-sky-950 text-sky-300 border border-sky-800 px-2.5 py-1 rounded-full text-xs font-bold">
                  ✓ Checked In
                </span>
              )}

              <Button
                size="sm"
                variant="ghost"
                className="text-slate-400 hover:text-white h-8 text-xs"
                onClick={() => setSelectedSeat(null)}
              >
                Close
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
