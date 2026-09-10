'use client';

import React, { useState } from 'react';
import { TeamMetric } from '@/lib/team-metrics';
import { Trophy, TrendingUp, Users, CreditCard } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TeamCollectionsChartProps {
  teams: TeamMetric[];
}

export function TeamCollectionsChart({ teams }: TeamCollectionsChartProps) {
  const [hoveredTeamId, setHoveredTeamId] = useState<number | null>(null);

  // Determine scales
  const maxCollection = Math.max(
    ...teams.map((t) => t.totalAmount),
    50000 // default minimum ceiling
  );
  // Round max collection up to a clean multiple of 25,000
  const collectionCeiling = Math.ceil(maxCollection / 25000) * 25000;

  const maxSeats = Math.max(
    ...teams.map((t) => t.seatsSold),
    10 // default minimum ceiling
  );
  // Round max seats up to a clean multiple of 5
  const seatsCeiling = Math.ceil(maxSeats / 5) * 5;

  // Aggregate totals
  const totalReceived = teams.reduce((sum, t) => sum + t.receivedAmount, 0);
  const totalPending = teams.reduce((sum, t) => sum + t.pendingAmount, 0);
  const totalSeats = teams.reduce((sum, t) => sum + t.seatsSold, 0);

  return (
    <div className="bg-[#131F2E] border border-slate-800 rounded-3xl p-5 space-y-6 shadow-xl">
      {/* Header & Overall Summary */}
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 pb-4 border-b border-slate-800">
        <div>
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" />
            <span>Team Collections & Seats Sold</span>
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Comparing all 8 Rotarian teams · Live aggregated sales excluding ring-fenced Rotary clubs
          </p>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 text-xs font-bold">
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded-xs bg-[#10B981]" />
            <span className="text-slate-300">Received (₹)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded-xs bg-[#F59E0B]" />
            <span className="text-slate-300">Pending (₹)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded-xs bg-[#0284C7]" />
            <span className="text-slate-300">Seats Sold (Count)</span>
          </div>
        </div>
      </div>

      {/* KPI Chips */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3 bg-[#0E1722] rounded-xl border border-slate-800 flex items-center justify-between">
          <span className="text-xs text-slate-400 font-medium">Total Received</span>
          <span className="font-mono font-bold text-emerald-400 text-sm">
            ₹{totalReceived.toLocaleString('en-IN')}
          </span>
        </div>
        <div className="p-3 bg-[#0E1722] rounded-xl border border-slate-800 flex items-center justify-between">
          <span className="text-xs text-slate-400 font-medium">Total Pending</span>
          <span className="font-mono font-bold text-amber-400 text-sm">
            ₹{totalPending.toLocaleString('en-IN')}
          </span>
        </div>
        <div className="p-3 bg-[#0E1722] rounded-xl border border-slate-800 flex items-center justify-between">
          <span className="text-xs text-slate-400 font-medium">Total Seats Sold</span>
          <span className="font-mono font-bold text-sky-400 text-sm">
            {totalSeats} seats
          </span>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="overflow-x-auto pb-2">
        <div className="min-w-[700px] h-[320px] flex flex-col justify-between pt-6">
          {/* Main Bars Grid with Axis Ticks */}
          <div className="relative flex-1 flex items-end border-b border-slate-800 pb-1 px-4">
            {/* Horizontal Gridlines */}
            <div className="absolute inset-x-0 inset-y-0 flex flex-col justify-between pointer-events-none opacity-20">
              <div className="border-b border-slate-700 w-full" />
              <div className="border-b border-slate-700 w-full" />
              <div className="border-b border-slate-700 w-full" />
              <div className="border-b border-slate-700 w-full" />
            </div>

            {/* Left Axis Label (₹) */}
            <div className="absolute -left-2 top-0 text-[10px] font-mono text-emerald-400 font-bold -translate-y-4">
              ₹ Collections (Left Bar)
            </div>

            {/* Right Axis Label (Seats) */}
            <div className="absolute -right-2 top-0 text-[10px] font-mono text-sky-400 font-bold -translate-y-4">
              Seats Sold (Right Bar)
            </div>

            {/* Bars for each of the 8 teams */}
            <div className="w-full flex items-end justify-between gap-3 z-10">
              {teams.map((t) => {
                const isHovered = hoveredTeamId === t.groupId;

                // Collection bar height percentage
                const receivedPct = (t.receivedAmount / collectionCeiling) * 100;
                const pendingPct = (t.pendingAmount / collectionCeiling) * 100;
                const totalColPct = Math.min(100, receivedPct + pendingPct);

                // Seats bar height percentage
                const seatsPct = Math.min(100, (t.seatsSold / seatsCeiling) * 100);

                return (
                  <div
                    key={t.groupId}
                    className="flex-1 flex flex-col items-center group cursor-pointer"
                    onMouseEnter={() => setHoveredTeamId(t.groupId)}
                    onMouseLeave={() => setHoveredTeamId(null)}
                  >
                    {/* Hover Tooltip */}
                    <div
                      className={cn(
                        'absolute -top-14 bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-center shadow-xl transition-all pointer-events-none z-30',
                        isHovered ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
                      )}
                    >
                      <div className="text-[11px] font-bold text-white">{t.teamLabel}</div>
                      <div className="text-[10px] text-slate-300 font-mono">
                        <span className="text-emerald-400">₹{t.receivedAmount.toLocaleString('en-IN')} rec</span>
                        {t.pendingAmount > 0 && (
                          <span className="text-amber-400"> + ₹{t.pendingAmount.toLocaleString('en-IN')} pend</span>
                        )}
                        {' · '}
                        <span className="text-sky-400">{t.seatsSold} seats</span>
                      </div>
                    </div>

                    {/* Bars Container: Grouped pair */}
                    <div className="w-full flex items-end justify-center gap-1.5 h-[220px]">
                      {/* 1. Collection Bar (Stacked: Received + Pending) */}
                      <div className="w-7 flex flex-col justify-end h-full">
                        {/* Top Value Label */}
                        <span className="text-[9px] font-mono font-bold text-center text-emerald-400 mb-1 truncate block">
                          {t.totalAmount > 0 ? `₹${Math.round(t.totalAmount / 1000)}k` : '₹0'}
                        </span>
                        <div
                          className={cn(
                            'w-full rounded-t-md overflow-hidden flex flex-col-reverse transition-all',
                            isHovered ? 'brightness-125 scale-x-105' : ''
                          )}
                          style={{ height: `${Math.max(4, totalColPct)}%` }}
                        >
                          {/* Received segment (solid emerald) */}
                          <div
                            style={{ height: `${totalColPct > 0 ? (receivedPct / totalColPct) * 100 : 100}%` }}
                            className="bg-[#10B981] w-full"
                          />
                          {/* Pending segment (accent amber) */}
                          {pendingPct > 0 && (
                            <div
                              style={{ height: `${(pendingPct / totalColPct) * 100}%` }}
                              className="bg-[#F59E0B] w-full"
                            />
                          )}
                        </div>
                      </div>

                      {/* 2. Seats Sold Bar */}
                      <div className="w-7 flex flex-col justify-end h-full">
                        {/* Top Value Label */}
                        <span className="text-[9px] font-mono font-bold text-center text-sky-400 mb-1 truncate block">
                          {t.seatsSold}
                        </span>
                        <div
                          className={cn(
                            'w-full bg-[#0284C7] rounded-t-md transition-all',
                            isHovered ? 'brightness-125 scale-x-105' : ''
                          )}
                          style={{ height: `${Math.max(4, seatsPct)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* X-Axis Labels: Team [X] · [Coordinator Name] */}
          <div className="w-full flex justify-between gap-3 px-4 pt-2">
            {teams.map((t) => {
              const isHovered = hoveredTeamId === t.groupId;
              return (
                <div
                  key={t.groupId}
                  className="flex-1 text-center"
                  onMouseEnter={() => setHoveredTeamId(t.groupId)}
                  onMouseLeave={() => setHoveredTeamId(null)}
                >
                  <div
                    className={cn(
                      'text-xs font-bold tracking-tight truncate transition-colors',
                      isHovered ? 'text-amber-400 font-black' : 'text-slate-200'
                    )}
                  >
                    Team {t.groupId}
                  </div>
                  <div
                    className="text-[10px] text-slate-400 truncate max-w-[100px] mx-auto"
                    title={t.coordinatorName}
                  >
                    {t.coordinatorName.replace(/^Rtn\.\s*/i, '')}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
