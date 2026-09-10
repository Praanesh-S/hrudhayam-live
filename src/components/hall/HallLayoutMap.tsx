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
  readOnly?: boolean;
  activeFloor?: SeatSection;
  onFloorChange?: (floor: SeatSection) => void;
  onSeatClick?: (seat: SeatData) => void;
  soldSeatMap?: Map<string, { soldIndex: number; totalSold: number; bandName: string }>;
}

export function HallLayoutMap({
  seats,
  readOnly = false,
  activeFloor: controlledFloor,
  onFloorChange,
  onSeatClick,
  soldSeatMap,
}: HallLayoutMapProps) {
  const [internalFloor, setInternalFloor] = useState<SeatSection>('Ground Floor');
  const activeFloor = controlledFloor !== undefined ? controlledFloor : internalFloor;

  const handleFloorSelect = (floor: SeatSection) => {
    if (onFloorChange) {
      onFloorChange(floor);
    } else {
      setInternalFloor(floor);
    }
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

  // Compute live seat status for each seat: received (sold) vs pending vs available
  const getSeatStatus = (s: SeatData) => {
    if (s.payment_status === 'received' || (s.sold && s.payment_status !== 'pending')) {
      return 'sold';
    }
    if (s.payment_status === 'pending') {
      return 'pending';
    }
    return 'available';
  };

  return (
    <div className="bg-[#131F2E] border border-slate-800 rounded-3xl p-5 space-y-4 shadow-xl">
      {/* Floor tabs */}
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

        <div className="flex items-center gap-3">
          {readOnly && (
            <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
              <span className="text-emerald-400 font-bold">✓ Sold</span>
              <span>·</span>
              <span className="text-amber-400 font-bold">● Pending</span>
              <span>·</span>
              <span className="text-slate-400 font-bold">○ Available</span>
            </div>
          )}
          <span className="text-xs text-slate-400 font-mono hidden sm:inline">
            {activeFloor === 'Ground Floor' ? 'Rows A–N · stage first' : 'Rows A–O · stage first'}
          </span>
        </div>
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
              {seats
                .filter((s) => s.row_label === 'SPL VIP')
                .sort((a, b) => a.seat_no - b.seat_no)
                .map((s) => {
                  const isNamed = !!(s.name || s.guest_name);
                  const status = getSeatStatus(s);

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
                        readOnly ? 'cursor-default' : 'cursor-pointer'
                      )}
                    >
                      {readOnly ? (status === 'sold' ? '✓' : status === 'pending' ? '●' : s.seat_no) : s.seat_no}
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
        <div className="flex-1 space-y-2.5 min-w-[580px]">
          {currentRowsList.map((rLabel) => {
            const rowSeats = seats.filter((s) => s.section === activeFloor && s.row_label === rLabel);
            const isProvisional = rowSeats.some((s) => s.provisional);
            const firstSeat = rowSeats[0];
            const categoryMeta = firstSeat ? CATEGORY_META[firstSeat.category] : CATEGORY_META.unassigned;

            // Row Counts Reconciled: Sold + Pending + Available = Capacity
            const capacity = rowSeats.length;
            const soldCount = rowSeats.filter((s) => getSeatStatus(s) === 'sold').length;
            const pendingCount = rowSeats.filter((s) => getSeatStatus(s) === 'pending').length;
            const availableCount = Math.max(0, capacity - soldCount - pendingCount);
            const isReconciled = soldCount + pendingCount + availableCount === capacity;

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
              const soldInfo = soldSeatMap?.get(s.id);
              const baseColor = CATEGORY_META[s.category]?.color || '#1E293B';

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
                    'w-3.5 h-4.5 rounded-xs transition-transform flex items-center justify-center text-[8px] font-black leading-none select-none',
                    readOnly ? 'cursor-default hover:scale-125' : 'cursor-pointer hover:scale-150',
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

            const rowTooltip = `Row ${rLabel} — ${soldCount} sold, ${pendingCount} pending, ${availableCount} left (Capacity: ${capacity})`;

            return (
              <div key={rLabel} className="flex items-center gap-3 group" title={rowTooltip}>
                {/* Row Label & Per-row Counts */}
                <div className="w-28 text-xs font-mono font-black text-slate-300 flex items-center gap-1.5 shrink-0">
                  <span className="w-12">{rLabel}</span>
                  {readOnly ? (
                    <span
                      className={cn(
                        'text-[9px] px-1.5 py-0.5 rounded font-mono font-normal',
                        isReconciled ? 'bg-slate-800 text-slate-300' : 'bg-red-500/20 text-red-400 border border-red-500/40'
                      )}
                      title={rowTooltip}
                    >
                      {soldCount}✓ {pendingCount}● {availableCount}○
                    </span>
                  ) : isProvisional ? (
                    <span className="text-[8px] px-1 bg-amber-500/20 text-amber-400 rounded border border-amber-500/30">
                      Prov
                    </span>
                  ) : null}
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
      <div className="pt-3 border-t border-slate-800 space-y-2">
        <div className="flex flex-wrap items-center gap-3 text-[11px] font-bold">
          {readOnly ? (
            <>
              <span className="flex items-center gap-1.5 text-emerald-400 font-extrabold bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-500/30">
                <span className="w-3.5 h-3.5 rounded-xs bg-[#10B981] text-slate-950 font-black flex items-center justify-center text-[8px]">✓</span>
                Sold
              </span>
              <span className="flex items-center gap-1.5 text-amber-400 font-extrabold bg-amber-950/40 px-2 py-0.5 rounded border border-amber-500/30">
                <span className="w-3.5 h-3.5 rounded-xs bg-[#F59E0B] text-slate-950 font-black flex items-center justify-center text-[8px]">●</span>
                Pending
              </span>
              <span className="flex items-center gap-1.5 text-slate-300 font-extrabold bg-slate-800/40 px-2 py-0.5 rounded border border-slate-700">
                <span className="w-3.5 h-3.5 rounded-xs bg-[#1E293B] text-white font-black flex items-center justify-center text-[8px]">○</span>
                Available
              </span>
            </>
          ) : (
            <span className="flex items-center gap-1.5 text-emerald-400 font-extrabold bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-500/30">
              <span className="w-3 h-3 rounded-xs bg-[#10B981] ring-1 ring-emerald-300" />
              Sold Pass ({Array.from(soldSeatMap?.values() || []).length} filled)
            </span>
          )}

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

        <p className="text-[10px] text-slate-400">
          {readOnly ? (
            <span>
              Live blueprint view: Hover over any row to inspect exact sold, pending, and remaining counts. Status driven in real-time by payment status.
            </span>
          ) : (
            <span>
              <strong className="text-emerald-400">Emerald Green (■)</strong> seats represent actual passes sold so far, sequentially allocated across each price band. Click any seat for details.
            </span>
          )}
        </p>
      </div>
    </div>
  );
}
