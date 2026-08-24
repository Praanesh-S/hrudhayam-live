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
  Tooltip, 
  TooltipContent, 
  TooltipTrigger 
} from '@/components/ui/tooltip';
import { 
  Users, 
  CheckCircle2, 
  Clock, 
  Ticket, 
  Crown, 
  Sparkles,
  Info,
  Filter
} from 'lucide-react';
import type { SeatSection } from '@/lib/types';

export interface SeatData {
  id: string;
  section: SeatSection;
  row_label: string;
  seat_no: number;
  tier: number | null;
  obligation: string | null;
  guest_name: string | null;
  guest_phone?: string | null;
  guest_email?: string | null;
  pass_code?: string | null;
  payment_status: string;
  checked_in: boolean;
  ticket_sent?: boolean;
  owner_id?: string | null;
}

interface SeatMapProps {
  seats: SeatData[];
  onSeatClick?: (seat: SeatData) => void;
  compact?: boolean;
}

type FilterType = 'all' | '5000' | '3000' | '1500' | 'vip' | 'paid' | 'unpaid' | 'empty' | 'checked_in';

export default function SeatMap({
  seats,
  onSeatClick,
  compact = false,
}: SeatMapProps) {
  const [selectedFloor, setSelectedFloor] = useState<SeatSection>('Ground Floor');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [selectedSeat, setSelectedSeat] = useState<SeatData | null>(null);

  // Multi-key quick lookup map
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
    return seats.filter(s => s.section === selectedFloor);
  }, [seats, selectedFloor]);

  const floorStats = useMemo(() => {
    const total = selectedFloor === 'Ground Floor' ? 648 : 750;
    const filled = floorSeats.filter(s => s.guest_name && s.guest_name.trim() !== '').length;
    const paid = floorSeats.filter(s => (s.payment_status || '').toLowerCase() === 'received').length;
    const checkedIn = floorSeats.filter(s => s.checked_in).length;
    const potentialRevenue = floorSeats.reduce((acc, s) => acc + (s.tier || 0), 0);
    const receivedRevenue = floorSeats
      .filter(s => (s.payment_status || '').toLowerCase() === 'received')
      .reduce((acc, s) => acc + (s.tier || 0), 0);

    return { total, filled, paid, checkedIn, potentialRevenue, receivedRevenue };
  }, [floorSeats, selectedFloor]);

  // Filter matching predicate
  const matchesFilter = (seat: SeatData | undefined) => {
    if (!seat) return false;
    if (activeFilter === 'all') return true;
    if (activeFilter === '5000') return seat.tier === 5000;
    if (activeFilter === '3000') return seat.tier === 3000;
    if (activeFilter === '1500') return seat.tier === 1500;
    if (activeFilter === 'vip') return seat.obligation != null;
    if (activeFilter === 'paid') return (seat.payment_status || '').toLowerCase() === 'received';
    if (activeFilter === 'unpaid') return seat.guest_name && (seat.payment_status || '').toLowerCase() === 'pending';
    if (activeFilter === 'empty') return !seat.guest_name;
    if (activeFilter === 'checked_in') return seat.checked_in;
    return true;
  };

  const rowsConfig = selectedFloor === 'Ground Floor' ? GROUND_FLOOR_LAYOUT : BALCONY_LAYOUT;
  const rowLabels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N'];

  // Color resolver for each individual seat pill
  const getSeatPillBg = (seat?: SeatData) => {
    if (!seat) return '#334E68';
    if (seat.checked_in) return '#0284C7'; // Sky Blue
    if ((seat.payment_status || '').toLowerCase() === 'received') return '#10B981'; // Emerald
    if (seat.guest_name && seat.guest_name.trim() !== '') return '#E8913A'; // Warm Amber
    if (seat.obligation != null) return '#8B5CF6'; // Royal Purple
    if (seat.tier === 5000) return '#F59E0B'; // Platinum Gold
    if (seat.tier === 3000) return '#0D9488'; // Teal
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
              Live Interactive Map
            </Badge>
          </div>
          <p className="text-xs text-slate-300 mt-1">
            Exact architectural representation of Ground Floor (698 seats) and Balcony (750 seats).
          </p>
        </div>

        {/* Floor Switcher Buttons */}
        <div className="inline-flex p-1 bg-[#081522] rounded-xl border border-[#243D56]">
          <button
            type="button"
            onClick={() => setSelectedFloor('Ground Floor')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              selectedFloor === 'Ground Floor'
                ? 'bg-[#E8913A] text-slate-950 shadow-md'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <span>Ground Floor</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
              selectedFloor === 'Ground Floor' ? 'bg-slate-950 text-white' : 'bg-slate-800 text-slate-300'
            }`}>
              698
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedFloor('Balcony')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              selectedFloor === 'Balcony'
                ? 'bg-[#E8913A] text-slate-950 shadow-md'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <span>Balcony</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
              selectedFloor === 'Balcony' ? 'bg-slate-950 text-white' : 'bg-slate-800 text-slate-300'
            }`}>
              750
            </span>
          </button>
        </div>
      </div>

      {/* 2. Floor Live Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-[#0F2236] p-3.5 rounded-xl border border-[#243D56] shadow-xs text-white">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Seats</span>
          <span className="text-xl font-extrabold text-white mt-0.5 block font-mono">{floorStats.total}</span>
        </div>
        <div className="bg-[#0F2236] p-3.5 rounded-xl border border-[#243D56] shadow-xs text-white">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Filled Seats</span>
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
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Potential</span>
          <span className="text-base font-extrabold text-white mt-1 block font-mono">{formatINR(floorStats.potentialRevenue)}</span>
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
              size="xs"
              variant={activeFilter === 'all' ? 'default' : 'outline'}
              className={activeFilter === 'all' ? 'bg-[#E8913A] text-slate-950 font-bold' : 'text-slate-300 bg-[#162C42] border-[#2A4866] hover:bg-[#1E3B5A] text-xs'}
              onClick={() => setActiveFilter('all')}
            >
              All Seats
            </Button>
            <Button
              size="xs"
              variant={activeFilter === '5000' ? 'default' : 'outline'}
              className={activeFilter === '5000' ? 'bg-[#F59E0B] text-slate-950 font-bold' : 'text-[#FBBF24] border-[#F59E0B]/40 bg-[#F59E0B]/10 text-xs'}
              onClick={() => setActiveFilter('5000')}
            >
              ₹5,000 Tier
            </Button>
            <Button
              size="xs"
              variant={activeFilter === '3000' ? 'default' : 'outline'}
              className={activeFilter === '3000' ? 'bg-[#0D9488] text-white font-bold' : 'text-[#2DD4BF] border-[#0D9488]/40 bg-[#0D9488]/10 text-xs'}
              onClick={() => setActiveFilter('3000')}
            >
              ₹3,000 Tier
            </Button>
            <Button
              size="xs"
              variant={activeFilter === '1500' ? 'default' : 'outline'}
              className={activeFilter === '1500' ? 'bg-[#64748B] text-white font-bold' : 'text-slate-300 border-slate-600 bg-slate-800 text-xs'}
              onClick={() => setActiveFilter('1500')}
            >
              ₹1,500 Tier
            </Button>
            <Button
              size="xs"
              variant={activeFilter === 'vip' ? 'default' : 'outline'}
              className={activeFilter === 'vip' ? 'bg-[#8B5CF6] text-white font-bold' : 'text-purple-300 border-purple-800 bg-purple-950/40 text-xs'}
              onClick={() => setActiveFilter('vip')}
            >
              VIP / Reserved
            </Button>
            <Button
              size="xs"
              variant={activeFilter === 'paid' ? 'default' : 'outline'}
              className={activeFilter === 'paid' ? 'bg-[#10B981] text-slate-950 font-bold' : 'text-emerald-300 border-emerald-800 bg-emerald-950/40 text-xs'}
              onClick={() => setActiveFilter('paid')}
            >
              Paid
            </Button>
            <Button
              size="xs"
              variant={activeFilter === 'checked_in' ? 'default' : 'outline'}
              className={activeFilter === 'checked_in' ? 'bg-[#0284C7] text-white font-bold' : 'text-sky-300 border-sky-800 bg-sky-950/40 text-xs'}
              onClick={() => setActiveFilter('checked_in')}
            >
              Checked In
            </Button>
            <Button
              size="xs"
              variant={activeFilter === 'empty' ? 'default' : 'outline'}
              className={activeFilter === 'empty' ? 'bg-slate-600 text-white font-bold' : 'text-slate-400 border-slate-700 bg-slate-900 text-xs'}
              onClick={() => setActiveFilter('empty')}
            >
              Empty
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
            <span className="w-3 h-3 rounded-xs bg-[#0D9488] inline-block shadow-xs"></span>
            <span>₹3,000 Tier</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-xs bg-[#64748B] inline-block shadow-xs"></span>
            <span>₹1,500 Tier</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-xs bg-[#8B5CF6] inline-block shadow-xs"></span>
            <span>VIP Box</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-xs bg-[#10B981] inline-block shadow-xs"></span>
            <span>Paid</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-xs bg-[#E8913A] inline-block shadow-xs"></span>
            <span>Filled (Pending)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-xs bg-[#0284C7] inline-block shadow-xs"></span>
            <span>Checked In</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-xs bg-[#334E68] border border-slate-600 inline-block"></span>
            <span>Unassigned</span>
          </div>
        </div>
      </div>

      {/* 4. Main Architectural Hall Seating Canvas */}
      <div className="bg-[#0A1624] text-slate-100 p-6 sm:p-8 rounded-3xl border border-[#243D56] shadow-2xl overflow-x-auto relative">
        <div className="min-w-[840px] max-w-[1100px] mx-auto space-y-6">

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

          {/* GROUND FLOOR: 3-BLOCK SEATING GRID */}
          {selectedFloor === 'Ground Floor' ? (
            <div className="space-y-1.5 bg-[#08121D] p-5 rounded-2xl border border-slate-800">
              {rowLabels.map(rowLetter => {
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

                              return (
                                <SeatPill
                                  key={seatNum}
                                  seat={seat || {
                                    id: `GF-${rowLetter}-${seatNum}`,
                                    section: 'Ground Floor',
                                    row_label: rowLetter,
                                    seat_no: seatNum,
                                    tier: null,
                                    obligation: null,
                                    guest_name: null,
                                    payment_status: 'pending',
                                    checked_in: false,
                                  }}
                                  isDimmed={isDimmed}
                                  seatBg={seatBg}
                                  onClick={() => {
                                    if (seat) {
                                      setSelectedSeat(seat);
                                      onSeatClick?.(seat);
                                    }
                                  }}
                                />
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
          ) : (
            /* BALCONY: 4-COLUMN ARCHITECTURAL SEATING GRID */
            <div className="space-y-2 bg-[#08121D] p-5 rounded-2xl border border-slate-800">
              <div className="flex items-center justify-between text-[11px] font-mono font-semibold text-slate-400 px-8 pb-1 border-b border-slate-800">
                <span>BLOCK 1 (LEFT)</span>
                <span>BLOCK 2 (CENTER-LEFT)</span>
                <span>BLOCK 3 (CENTER-RIGHT)</span>
                <span>BLOCK 4 (RIGHT)</span>
              </div>

              {rowLabels.map(rowLetter => {
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

                              return (
                                <SeatPill
                                  key={seatNum}
                                  seat={seat || {
                                    id: `BAL-${rowLetter}-${seatNum}`,
                                    section: 'Balcony',
                                    row_label: rowLetter,
                                    seat_no: seatNum,
                                    tier: null,
                                    obligation: null,
                                    guest_name: null,
                                    payment_status: 'pending',
                                    checked_in: false,
                                  }}
                                  isDimmed={isDimmed}
                                  seatBg={seatBg}
                                  onClick={() => {
                                    if (seat) {
                                      setSelectedSeat(seat);
                                      onSeatClick?.(seat);
                                    }
                                  }}
                                />
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
        <Card className="bg-[#0F2236] border-amber-500/40 p-4 rounded-2xl shadow-xl border text-white animate-in fade-in-50">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-base font-extrabold text-amber-400 font-mono">
                  {selectedSeat.id}
                </span>
                <Badge className="bg-[#1A344E] text-slate-200 border-[#2A4D70] text-xs">
                  {selectedSeat.section} • Row {selectedSeat.row_label} • Seat #{selectedSeat.seat_no}
                </Badge>
                {selectedSeat.tier && (
                  <Badge className="bg-amber-500 text-slate-950 font-bold text-xs font-mono">
                    {formatINR(selectedSeat.tier)}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-slate-300">
                {selectedSeat.guest_name ? (
                  <>Passholder: <strong className="text-white">{selectedSeat.guest_name}</strong> {selectedSeat.guest_phone && `(${selectedSeat.guest_phone})`}</>
                ) : (
                  <span className="text-slate-400 italic">No guest assigned yet</span>
                )}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                (selectedSeat.payment_status || '').toLowerCase() === 'received'
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                  : 'bg-amber-950 text-amber-300 border border-amber-800'
              }`}>
                {(selectedSeat.payment_status || '').toLowerCase() === 'received' ? '✓ Paid' : 'Pending Payment'}
              </span>

              {selectedSeat.checked_in && (
                <span className="bg-sky-950 text-sky-300 border border-sky-800 px-2.5 py-1 rounded-full text-xs font-bold">
                  ✓ Checked In
                </span>
              )}

              <Button
                size="xs"
                variant="ghost"
                className="text-slate-400 hover:text-white"
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

/**
 * Individual Seat Pill Component with Hover Tooltip
 */
interface SeatPillProps {
  seat: SeatData;
  seatBg: string;
  isDimmed: boolean;
  onClick: () => void;
}

function SeatPill({ seat, seatBg, isDimmed, onClick }: SeatPillProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            onClick={onClick}
            aria-label={`Seat ${seat.row_label}-${seat.seat_no}`}
            className={`h-4 min-w-[14px] px-0.5 rounded-[3px] text-[8px] font-mono font-medium flex items-center justify-center transition-all duration-150 cursor-pointer shadow-2xs hover:scale-125 hover:z-20 ${
              isDimmed ? 'opacity-20 saturate-0' : 'opacity-100'
            }`}
            style={{
              backgroundColor: seatBg,
              color: '#FFFFFF',
            }}
          >
            {seat.seat_no}
          </button>
        }
      />
      <TooltipContent 
        side="top" 
        className="bg-slate-900 text-white text-xs p-2.5 rounded-xl shadow-xl border border-slate-700 max-w-xs space-y-1"
      >
        <div className="flex items-center justify-between gap-2 border-b border-slate-700 pb-1">
          <span className="font-bold text-amber-400">{seat.id}</span>
          <span className="text-[10px] text-slate-400">{seat.section} • Row {seat.row_label}</span>
        </div>
        <div>
          <span className="font-semibold text-slate-200 block">
            {seat.guest_name || 'Empty / Unassigned'}
          </span>
          {seat.tier && (
            <span className="text-[11px] text-amber-300 font-mono">
              Tier: {formatINR(seat.tier)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 pt-0.5 text-[10px]">
          <span className={`px-1.5 py-0.5 rounded-sm ${
            (seat.payment_status || '').toLowerCase() === 'received' ? 'bg-emerald-900/60 text-emerald-300' : 'bg-amber-900/60 text-amber-300'
          }`}>
            {(seat.payment_status || '').toLowerCase() === 'received' ? 'Paid' : 'Pending Payment'}
          </span>
          {seat.checked_in && (
            <span className="bg-sky-900/60 text-sky-300 px-1.5 py-0.5 rounded-sm">
              Checked In
            </span>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
