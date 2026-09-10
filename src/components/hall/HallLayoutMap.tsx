'use client';

import React, { useState, useMemo } from 'react';
import { SeatData, SeatSection, SeatCategory } from '@/lib/types';
import { Crown } from 'lucide-react';
import { cn } from '@/lib/utils';

export const CATEGORY_META: Record<SeatCategory, { label: string; price: number; color: string; countsToRaise: boolean }> = {
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

interface HallLayoutMapProps {
  seats: SeatData[];
  bands?: any[];
  readOnly?: boolean;
  activeFloor?: SeatSection;
  onFloorChange?: (floor: SeatSection) => void;
  onSeatClick?: (seat: SeatData) => void;
  soldSeatMap?: Map<string, { soldIndex: number; totalSold: number; bandName: string; status?: 'received' | 'pending' }>;
  isolatedFilter?: string;
  onIsolatedFilterChange?: (filter: string) => void;
}

export function HallLayoutMap({
  seats,
  bands,
  readOnly = false,
  activeFloor: controlledFloor,
  onFloorChange,
  onSeatClick,
  soldSeatMap,
  isolatedFilter: controlledFilter,
  onIsolatedFilterChange,
}: HallLayoutMapProps) {
  const [internalFloor, setInternalFloor] = useState<SeatSection>('Ground Floor');
  const activeFloor = controlledFloor !== undefined ? controlledFloor : internalFloor;

  const [internalFilter, setInternalFilter] = useState<string>('all');
  const activeFilter = controlledFilter !== undefined ? controlledFilter : internalFilter;

  const handleFloorSelect = (floor: SeatSection) => {
    if (onFloorChange) onFloorChange(floor);
    else setInternalFloor(floor);
  };

  const handleFilterSelect = (filter: string) => {
    const next = activeFilter === filter ? 'all' : filter;
    if (onIsolatedFilterChange) onIsolatedFilterChange(next);
    else setInternalFilter(next);
  };

  const groundRowsList = useMemo(
    () => ['Special A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N'],
    []
  );

  const balconyRowsList = useMemo(
    () => ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O'],
    []
  );

  const currentRowsList = activeFloor === 'Ground Floor' ? groundRowsList : balconyRowsList;

  // Derive sold seat map accurately
  const effectiveSoldSeatMap = useMemo(() => {
    if (soldSeatMap) return soldSeatMap;
    const map = new Map<string, { soldIndex: number; totalSold: number; bandName: string; status?: 'received' | 'pending' }>();

    // 1. Direct pass or sold flags on seats
    const directSold = seats.filter((s) => s.sold || s.pass_code);
    directSold.forEach((s, idx) => {
      map.set(s.id, {
        soldIndex: idx + 1,
        totalSold: directSold.length,
        bandName: CATEGORY_META[s.category]?.label || 'Band',
        status: s.payment_status === 'pending' ? 'pending' : 'received',
      });
    });

    // 2. If bands data is passed with sold_count, fill sequentially
    if (bands && bands.length > 0) {
      const categoryToBandPrice: Record<string, number> = {
        b5000: 5000,
        b3500: 3500,
        b2500: 2500,
        b1500: 1500,
        pp: 1000,
      };

      for (const [cat, price] of Object.entries(categoryToBandPrice)) {
        const band = bands.find((b) => b.price === price || b.id?.includes(cat));
        const soldCount = band?.sold_count || 0;
        if (soldCount <= 0) continue;

        const catSeats = seats.filter((s) => s.category === cat);
        catSeats.sort((a, b) => {
          if (a.section !== b.section) return a.section === 'Ground Floor' ? -1 : 1;
          const rowList = a.section === 'Ground Floor' ? groundRowsList : balconyRowsList;
          const aRowIdx = rowList.indexOf(a.row_label);
          const bRowIdx = rowList.indexOf(b.row_label);
          if (aRowIdx !== bRowIdx) return aRowIdx - bRowIdx;
          return a.seat_no - b.seat_no;
        });

        const soldSlice = catSeats.slice(0, soldCount);
        soldSlice.forEach((seat, idx) => {
          if (!map.has(seat.id)) {
            map.set(seat.id, {
              soldIndex: idx + 1,
              totalSold: soldCount,
              bandName: band?.name || band?.label || CATEGORY_META[cat as SeatCategory]?.label || `Band ${cat}`,
              status: 'received',
            });
          }
        });
      }
    }

    return map;
  }, [soldSeatMap, seats, bands, groundRowsList, balconyRowsList]);

  // Compute live seat status: received (sold) vs pending vs available
  const getSeatStatus = (s: SeatData): 'sold' | 'pending' | 'available' => {
    const soldInfo = effectiveSoldSeatMap.get(s.id);
    if (soldInfo) {
      return soldInfo.status === 'pending' ? 'pending' : 'sold';
    }
    if (s.sold || s.pass_code) {
      return s.payment_status === 'pending' ? 'pending' : 'sold';
    }
    return 'available';
  };

  // Check if seat matches active isolation filter
  const isSeatIsolated = (s: SeatData) => {
    if (!activeFilter || activeFilter === 'all') return true;
    const status = getSeatStatus(s);
    if (activeFilter === 'sold') return status === 'sold';
    if (activeFilter === 'pending') return status === 'pending';
    if (activeFilter === 'available') return status === 'available' && s.counts_to_raise;
    return s.category === activeFilter;
  };

  return (
    <div className="bg-[#131F2E] border border-slate-800 rounded-3xl p-5 space-y-4 shadow-xl">
      {/* Floor tabs & Legend */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 pb-2 border-b border-slate-800">
        <div className="inline-flex p-1 bg-[#0E1722] rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => handleFloorSelect('Ground Floor')}
            className={cn(
              'px-4 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer',
              activeFloor === 'Ground Floor'
                ? 'bg-[#E8913A] text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            )}
          >
            Ground Floor <span className="text-[10px] font-normal opacity-80">648 + 50 VIP</span>
          </button>
          <button
            type="button"
            onClick={() => handleFloorSelect('Balcony')}
            className={cn(
              'px-4 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer',
              activeFloor === 'Balcony'
                ? 'bg-[#E8913A] text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            )}
          >
            Balcony <span className="text-[10px] font-normal opacity-80">750</span>
          </button>
        </div>

        {readOnly && (
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-emerald-400 font-bold">✓ Sold</span>
            <span className="text-slate-500">·</span>
            <span className="text-amber-400 font-bold">● Pending</span>
            <span className="text-slate-500">·</span>
            <span className="text-slate-400 font-bold">○ Available</span>
          </div>
        )}
      </div>

      {/* Status & Price Category Isolation Filter Chips */}
      <div className="flex flex-wrap items-center gap-1.5 pt-0.5 pb-1">
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider shrink-0 mr-1">
          Isolate:
        </span>
        {[
          { id: 'all', label: 'All Seats' },
          { id: 'sold', label: '✓ Sold', color: '#10B981' },
          { id: 'available', label: '○ Available', color: '#0D9488' },
          { id: 'b5000', label: '₹5k Band A', color: '#F59E0B' },
          { id: 'b3500', label: '₹3.5k Band B', color: '#8B5CF6' },
          { id: 'b2500', label: '₹2.5k Band C', color: '#0D9488' },
          { id: 'b1500', label: '₹1.5k Band D', color: '#64748B' },
          { id: 'pp', label: '₹1k PP', color: '#0284C7' },
          { id: 'vip', label: 'VIP', color: '#EAB308' },
          { id: 'obligation', label: 'Obligation', color: '#EF4444' },
          { id: 'sponsor_comp', label: 'Sponsor', color: '#06B6D4' },
          { id: 'blocked', label: 'Blocked', color: '#475569' },
        ].map((opt) => {
          const isActive = activeFilter === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => handleFilterSelect(opt.id)}
              className={cn(
                'px-2 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer flex items-center gap-1',
                isActive
                  ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm font-black ring-1 ring-white/50'
                  : 'bg-[#1A2839] text-slate-300 border-slate-700 hover:border-slate-500 hover:text-white'
              )}
            >
              {opt.color && <span className="w-2 h-2 rounded-xs" style={{ backgroundColor: opt.color }} />}
              <span>{opt.label}</span>
            </button>
          );
        })}
      </div>

      {/* Stage Area */}
      <div className="w-full py-2 bg-[#0E1722] border border-slate-800 text-center rounded-xl text-slate-400 font-black tracking-widest text-xs uppercase">
        STAGE
      </div>

      {/* Layout Map: Ground Floor vs Balcony */}
      <div className="flex gap-4 items-start overflow-x-auto pb-4">
        {/* SPL VIP Box (Visible on Ground Floor) */}
        {activeFloor === 'Ground Floor' && (
          <div className="w-36 p-3 bg-[#0E1722] border-2 border-amber-500/40 rounded-2xl space-y-2 shrink-0">
            <div className="text-center">
              <div className="text-xs font-black text-amber-400 flex items-center justify-center gap-1">
                <Crown className="w-3 h-3 text-amber-400" /> SPL VIP (50)
              </div>
            </div>

            <div className="grid grid-cols-5 gap-1 pt-1">
              {seats
                .filter((s) => s.row_label === 'SPL VIP')
                .sort((a, b) => a.seat_no - b.seat_no)
                .map((s) => {
                  const isNamed = !!(s.name || s.guest_name);
                  const status = getSeatStatus(s);
                  const isIsolated = isSeatIsolated(s);

                  return (
                    <button
                      key={s.id}
                      type="button"
                      disabled={readOnly}
                      onClick={() => !readOnly && onSeatClick?.(s)}
                      title={`${s.id}: ${s.name || s.guest_name || 'VIP Chief Guest'} (${status})`}
                      className={cn(
                        'w-5 h-5 rounded text-[9px] font-black flex items-center justify-center transition-all',
                        isNamed
                          ? 'bg-amber-400 text-slate-950 ring-1 ring-white'
                          : 'bg-amber-500/30 text-amber-300 hover:bg-amber-500 hover:text-slate-950',
                        readOnly ? 'cursor-default' : 'cursor-pointer',
                        !isIsolated && 'opacity-20 grayscale pointer-events-none'
                      )}
                    >
                      {readOnly ? (status === 'sold' ? '✓' : status === 'pending' ? '●' : s.seat_no) : s.seat_no}
                    </button>
                  );
                })}
            </div>
          </div>
        )}

        {/* Rows List */}
        <div className="flex-1 space-y-2.5 min-w-[580px]">
          {currentRowsList.map((rLabel) => {
            const rowSeats = seats.filter((s) => s.section === activeFloor && s.row_label === rLabel);
            const firstSeat = rowSeats[0];
            const categoryMeta = firstSeat ? CATEGORY_META[firstSeat.category] : CATEGORY_META.unassigned;

            // Split row into 3 blocks (left, center, right)
            const total = rowSeats.length;
            const leftCount = Math.floor(total * 0.25);
            const centerCount = Math.floor(total * 0.5);
            const leftBlock = rowSeats.slice(0, leftCount);
            const centerBlock = rowSeats.slice(leftCount, leftCount + centerCount);
            const rightBlock = rowSeats.slice(leftCount + centerCount);

            // Render individual seat
            const renderSeat = (s: SeatData) => {
              const status = getSeatStatus(s);
              const soldInfo = effectiveSoldSeatMap.get(s.id);
              const baseColor = CATEGORY_META[s.category]?.color || '#1E293B';
              const isIsolated = isSeatIsolated(s);

              let seatBg = baseColor;
              let symbol = '○';
              let ringClass = '';

              if (status === 'sold') {
                seatBg = '#10B981'; // Emerald Green
                symbol = '✓';
                ringClass = 'ring-1 ring-emerald-300 shadow-xs shadow-emerald-500/50';
              } else if (status === 'pending') {
                seatBg = '#F59E0B'; // Amber
                symbol = '●';
                ringClass = 'ring-1 ring-amber-300 shadow-xs shadow-amber-500/50';
              }

              if (activeFilter !== 'all' && isIsolated) {
                ringClass = 'ring-2 ring-white shadow-md scale-110 z-10';
              }

              const tooltip = readOnly
                ? `Row ${s.row_label} Seat ${s.seat_no} · ${status.toUpperCase()} · ${CATEGORY_META[s.category]?.label || 'Band'}${s.guest_name ? ` (${s.guest_name})` : ''}`
                : soldInfo
                ? `SOLD PASS (#${soldInfo.soldIndex} of ${soldInfo.totalSold} sold in ${soldInfo.bandName}) · Row ${s.row_label} Seat ${s.seat_no}`
                : `${s.id}: ${CATEGORY_META[s.category]?.label}${s.name ? ` (${s.name})` : ''}`;

              return (
                <button
                  key={s.id}
                  type="button"
                  disabled={readOnly}
                  onClick={() => !readOnly && onSeatClick?.(s)}
                  title={tooltip}
                  className={cn(
                    'w-3.5 h-4.5 rounded-xs transition-all flex items-center justify-center text-[8px] font-black leading-none select-none',
                    readOnly ? 'cursor-default hover:scale-125' : 'cursor-pointer hover:scale-150',
                    !isIsolated && 'opacity-20 grayscale pointer-events-none',
                    ringClass
                  )}
                  style={{
                    backgroundColor: readOnly ? seatBg : soldInfo ? '#10B981' : baseColor,
                    color: status === 'sold' || status === 'pending' ? '#07111C' : '#FFFFFF',
                  }}
                >
                  {readOnly ? symbol : null}
                </button>
              );
            };

            return (
              <div key={rLabel} className="flex items-center gap-3 group">
                {/* Row Label (clean, no clutter) */}
                <div className="w-16 text-xs font-mono font-black text-slate-300 flex items-center shrink-0">
                  <span>Row {rLabel}</span>
                </div>

                {/* Physical Seats in 3 blocks */}
                <div className="flex-1 flex items-center gap-2">
                  <div className="flex items-center gap-0.5">{leftBlock.map(renderSeat)}</div>
                  <div className="flex items-center gap-0.5">{centerBlock.map(renderSeat)}</div>
                  <div className="flex items-center gap-0.5">{rightBlock.map(renderSeat)}</div>
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
      <div className="pt-3 border-t border-slate-800 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2.5 text-xs font-bold">
          {readOnly ? (
            <>
              <span className="flex items-center gap-1 text-emerald-400 font-extrabold bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-500/30">
                <span className="w-3 h-3 rounded-xs bg-[#10B981] text-slate-950 font-black flex items-center justify-center text-[8px]">✓</span>
                Sold
              </span>
              <span className="flex items-center gap-1 text-amber-400 font-extrabold bg-amber-950/40 px-2 py-0.5 rounded border border-amber-500/30">
                <span className="w-3 h-3 rounded-xs bg-[#F59E0B] text-slate-950 font-black flex items-center justify-center text-[8px]">●</span>
                Pending
              </span>
              <span className="flex items-center gap-1 text-slate-300 font-extrabold bg-slate-800/40 px-2 py-0.5 rounded border border-slate-700">
                <span className="w-3 h-3 rounded-xs bg-[#1E293B] text-white font-black flex items-center justify-center text-[8px]">○</span>
                Available
              </span>
            </>
          ) : (
            <span className="flex items-center gap-1 text-emerald-400 font-extrabold bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-500/30">
              <span className="w-2.5 h-2.5 rounded-xs bg-[#10B981]" />
              Sold Pass
            </span>
          )}

          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-xs bg-[#F59E0B]" /> ₹5,000</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-xs bg-[#8B5CF6]" /> ₹3,500</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-xs bg-[#0D9488]" /> ₹2,500</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-xs bg-[#64748B]" /> ₹1,500</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-xs bg-[#0284C7]" /> ₹1,000 PP</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-xs bg-[#EAB308]" /> VIP</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-xs bg-[#EF4444]" /> Obligation</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-xs bg-[#06B6D4]" /> Sponsor</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-xs bg-[#475569]" /> Blocked</span>
        </div>

        <p className="text-[11px] text-slate-400">
          Live venue occupancy layout · Hover over seats for details.
        </p>
      </div>
    </div>
  );
}
