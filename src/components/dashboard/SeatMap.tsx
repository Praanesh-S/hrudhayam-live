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
import { Card } from '@/components/ui/card';
import { 
  Crown, 
  Sparkles,
  Info,
  Filter,
  Lock,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import type { SeatSection, SeatData, VenueRow } from '@/lib/types';

interface SeatMapProps {
  seats: SeatData[];
  rows?: VenueRow[];
  onSeatClick?: (seat: SeatData) => void;
  compact?: boolean;
}

type FilterType = 'all' | '5000' | '3500' | '2500' | '1500' | 'vip' | 'paid' | 'unpaid' | 'empty';

export default function SeatMap({
  seats,
  rows,
  onSeatClick,
  compact = false,
}: SeatMapProps) {
  const [selectedFloor, setSelectedFloor] = useState<SeatSection>('Ground Floor');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [selectedSeat, setSelectedSeat] = useState<SeatData | null>(null);

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

  // Floor stats
  const floorStats = useMemo(() => {
    // Ground floor regular seats = 648, Balcony = 750
    const regularTotal = selectedFloor === 'Ground Floor' ? 648 : 750;
    const vipTotal = selectedFloor === 'Ground Floor' ? 50 : 0;
    const total = regularTotal + vipTotal;

    const filled = floorSeats.filter((s) => s.guest_name && s.guest_name.trim() !== '').length;
    const paid = floorSeats.filter((s) => (s.payment_status || '').toLowerCase() === 'received').length;
    const checkedIn = floorSeats.filter((s) => s.checked_in).length;
    const potentialRevenue = floorSeats.reduce((acc, s) => acc + (s.tier || 0), 0);
    const receivedRevenue = floorSeats
      .filter((s) => (s.payment_status || '').toLowerCase() === 'received')
      .reduce((acc, s) => acc + (s.tier || 0), 0);

    return { 
      total, 
      regularTotal, 
      vipTotal, 
      filled, 
      paid, 
      checkedIn, 
      potentialRevenue, 
      receivedRevenue 
    };
  }, [floorSeats, selectedFloor]);

  // Filter matching predicate
  const matchesFilter = (seat: SeatData | undefined) => {
    if (!seat) return false;
    if (activeFilter === 'all') return true;
    if (activeFilter === '5000') return seat.tier === 5000;
    if (activeFilter === '3500') return seat.tier === 3500 || seat.tier === 3000;
    if (activeFilter === '2500') return seat.tier === 2500;
    if (activeFilter === '1500') return seat.tier === 1500;
    if (activeFilter === 'vip') return seat.obligation != null || seat.row_label === 'SPL VIP';
    if (activeFilter === 'paid') return (seat.payment_status || '').toLowerCase() === 'received';
    if (activeFilter === 'unpaid') return Boolean(seat.guest_name && (seat.payment_status || '').toLowerCase() === 'pending');
    if (activeFilter === 'empty') return !seat.guest_name && seat.row_label !== 'SPL VIP';
    return true;
  };

  const rowLabels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N'];

  // Color resolver
  const getSeatPillBg = (seat?: SeatData) => {
    if (!seat) return '#334E68';
    if (seat.obligation != null || seat.row_label === 'SPL VIP') return '#8B5CF6'; // Royal Purple VIP
    if (seat.checked_in) return '#0284C7'; // Sky Blue
    if ((seat.payment_status || '').toLowerCase() === 'received') return '#10B981'; // Emerald Green
    if (seat.guest_name && seat.guest_name.trim() !== '') return '#EF4444'; // Red for Pending
    if (seat.tier === 5000) return '#F59E0B'; // Amber Gold
    if (seat.tier === 3500 || seat.tier === 3000) return '#8B5CF6'; // Purple / Gold
    if (seat.tier === 2500) return '#0D9488'; // Teal
    if (seat.tier === 1500) return '#64748B'; // Steel Slate
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
              className={activeFilter === '3500' ? 'bg-[#8B5CF6] text-white font-bold h-8 text-xs' : 'text-purple-300 border-purple-800 bg-purple-950/40 text-xs h-8'}
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
              variant={activeFilter === 'paid' ? 'default' : 'outline'}
              className={activeFilter === 'paid' ? 'bg-[#10B981] text-slate-950 font-bold h-8 text-xs' : 'text-emerald-300 border-emerald-800 bg-emerald-950/40 text-xs h-8'}
              onClick={() => setActiveFilter('paid')}
            >
              Paid / Issued
            </Button>
            <Button
              size="sm"
              variant={activeFilter === 'unpaid' ? 'default' : 'outline'}
              className={activeFilter === 'unpaid' ? 'bg-[#EF4444] text-white font-bold h-8 text-xs' : 'text-red-300 border-red-800 bg-red-950/40 text-xs h-8'}
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
            <span className="w-3 h-3 rounded-xs bg-[#8B5CF6] inline-block shadow-xs"></span>
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
              <Crown className="w-3 h-3" /> VIP Box (50 Seats - Non-editable)
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-xs bg-[#10B981] inline-block shadow-xs"></span>
            <span>Paid Pass</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-xs bg-[#EF4444] inline-block shadow-xs"></span>
            <span>Pending</span>
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
                      <span className="text-xs font-mono font-bold text-amber-400 w-5 text-center shrink-0">
                        {rowLetter}
                      </span>

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

                                return (
                                  <button
                                    key={seatNum}
                                    type="button"
                                    onClick={() => {
                                      setSelectedSeat(effectiveSeat);
                                      onSeatClick?.(effectiveSeat);
                                    }}
                                    title={`Seat ${effectiveSeat.id} • ${effectiveSeat.tier ? '₹' + effectiveSeat.tier : 'Available'} • Row ${rowLetter}`}
                                    className={`h-4 min-w-[14px] px-0.5 rounded-[3px] text-[8px] font-mono font-medium flex items-center justify-center transition-all cursor-pointer shadow-2xs hover:scale-125 hover:z-20 text-white ${
                                      isDimmed ? 'opacity-20 saturate-0' : 'opacity-100'
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
                      <span className="text-xs font-mono font-bold text-amber-400 w-5 text-center shrink-0">
                        {rowLetter}
                      </span>
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
                    <span className="text-xs font-mono font-bold text-amber-400 w-5 text-center shrink-0">
                      {rowLetter}
                    </span>

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

                              return (
                                <button
                                  key={seatNum}
                                  type="button"
                                  onClick={() => {
                                    setSelectedSeat(effectiveSeat);
                                    onSeatClick?.(effectiveSeat);
                                  }}
                                  title={`Seat ${effectiveSeat.id} • ${effectiveSeat.tier ? '₹' + effectiveSeat.tier : 'Available'} • Row ${rowLetter}`}
                                  className={`h-4 min-w-[14px] px-0.5 rounded-[3px] text-[8px] font-mono font-medium flex items-center justify-center transition-all cursor-pointer shadow-2xs hover:scale-125 hover:z-20 text-white ${
                                    isDimmed ? 'opacity-20 saturate-0' : 'opacity-100'
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

                    <span className="text-xs font-mono font-bold text-amber-400 w-5 text-center shrink-0">
                      {rowLetter}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 5. Selected Seat Inspection Modal / Card */}
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

                {selectedSeat.row_label === 'SPL VIP' || selectedSeat.obligation != null ? (
                  <Badge className="bg-purple-900 text-purple-200 border border-purple-600 text-xs font-bold flex items-center gap-1">
                    <Lock className="w-3 h-3" /> VIP Reserved (Non-editable)
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

              {selectedSeat.row_label === 'SPL VIP' || selectedSeat.obligation != null ? (
                <p className="text-xs text-purple-300 font-medium">
                  🔒 This seat is part of the Special VIP Box reserved exclusively for Chief Guests, Trust Dignitaries, and Officials. It is strictly non-editable and protected from public selling.
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

            <div className="flex items-center gap-2">
              {selectedSeat.row_label !== 'SPL VIP' && (
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
