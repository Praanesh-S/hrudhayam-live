'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { 
  Clock, 
  Search, 
  Filter, 
  ChevronDown, 
  ChevronRight, 
  History,
  ShieldAlert,
  User,
  Tag,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import type { AuditLog } from '@/lib/types';

interface AuditLogsClientProps {
  logs: AuditLog[];
}

export function AuditLogsClient({ logs }: AuditLogsClientProps) {
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Distinct action types
  const actionTypes = Array.from(new Set(logs.map(l => l.action))).sort();

  const filteredLogs = logs.filter(log => {
    const userName = log.profiles?.full_name || '';
    const userEmail = log.profiles?.email || '';
    const entityId = log.entity_id || '';
    const detailsStr = JSON.stringify(log.details || {});

    const matchesSearch = 
      userName.toLowerCase().includes(search.toLowerCase()) ||
      userEmail.toLowerCase().includes(search.toLowerCase()) ||
      entityId.toLowerCase().includes(search.toLowerCase()) ||
      detailsStr.toLowerCase().includes(search.toLowerCase());

    const matchesAction = actionFilter === 'all' || log.action === actionFilter;

    return matchesSearch && matchesAction;
  });

  const getActionBadgeColor = (action: string) => {
    switch (action) {
      case 'CHECK_IN':
      case 'CHECKIN_VERIFIED':
        return 'bg-sky-950 text-sky-300 border-sky-800';
      case 'OVERRIDE':
        return 'bg-red-950 text-red-300 border-red-700 font-bold';
      case 'PRICE_SET':
      case 'update_row_tier':
        return 'bg-amber-950 text-amber-300 border-amber-800';
      case 'RESERVE':
      case 'allocate_rows':
        return 'bg-purple-950 text-purple-300 border-purple-800';
      case 'RELEASE':
      case 'release_rows':
        return 'bg-rose-950 text-rose-300 border-rose-800';
      case 'SPONSOR_TAG':
      case 'SPONSOR_CREATE':
        return 'bg-emerald-950 text-emerald-300 border-emerald-800';
      case 'GROUP_CREATE':
      case 'GROUP_ASSIGN':
        return 'bg-indigo-950 text-indigo-300 border-indigo-800';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & Filters */}
      <Card className="bg-[#131F2E] border-[#223345] rounded-2xl p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search user, entity ID, or details..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-9 text-xs bg-[#1A2839] border-[#2A3F55] text-white"
            />
          </div>

          <div>
            <Select value={actionFilter} onValueChange={v => v && setActionFilter(v)}>
              <SelectTrigger className="h-9 text-xs bg-[#1A2839] border-[#2A3F55] text-white">
                <SelectValue placeholder="Filter by Action" />
              </SelectTrigger>
              <SelectContent className="bg-[#131F2E] border-[#223345] text-white max-h-64">
                <SelectItem value="all">All Actions ({logs.length})</SelectItem>
                {actionTypes.map(action => (
                  <SelectItem key={action} value={action}>
                    {action}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-end text-xs text-slate-400">
            Showing <strong className="text-white mx-1">{filteredLogs.length}</strong> of {logs.length} audit records
          </div>
        </div>
      </Card>

      {/* 2. Audit Logs Table */}
      <Card className="bg-[#131F2E] border-[#223345] rounded-2xl shadow-xl overflow-hidden">
        <CardHeader className="bg-[#0E1724] pb-3 border-b border-[#223345]">
          <CardTitle className="text-base font-bold text-white flex items-center gap-2">
            <History className="w-5 h-5 text-[#E8913A]" />
            Immutable Audit Trail & System Events
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-[#0E1724]">
                <TableRow className="border-[#223345] text-xs">
                  <TableHead className="w-8"></TableHead>
                  <TableHead className="text-slate-300 font-semibold">Timestamp</TableHead>
                  <TableHead className="text-slate-300 font-semibold">User / Operator</TableHead>
                  <TableHead className="text-slate-300 font-semibold">Action</TableHead>
                  <TableHead className="text-slate-300 font-semibold">Target Entity</TableHead>
                  <TableHead className="text-slate-300 font-semibold">Entity ID</TableHead>
                  <TableHead className="text-slate-300 font-semibold">Details Summary</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-slate-400">
                      No audit logs match the current filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLogs.map(log => {
                    const isExpanded = expandedId === log.id;
                    const dateFormatted = log.created_at 
                      ? format(new Date(log.created_at), 'dd MMM yyyy, HH:mm:ss')
                      : '—';

                    return (
                      <tbody key={log.id}>
                        <TableRow 
                          onClick={() => setExpandedId(isExpanded ? null : log.id)}
                          className="border-[#1E2D3D] hover:bg-[#1A2839]/60 cursor-pointer text-xs transition-colors"
                        >
                          <TableCell className="text-slate-500 py-3 pl-3">
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-amber-400" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-slate-500" />
                            )}
                          </TableCell>

                          <TableCell className="font-mono text-slate-400 whitespace-nowrap">
                            {dateFormatted}
                          </TableCell>

                          <TableCell className="font-medium text-white">
                            <div>{log.profiles?.full_name || 'System'}</div>
                            <span className="text-[10px] text-slate-400 block">{log.profiles?.email}</span>
                          </TableCell>

                          <TableCell>
                            <span className={`px-2 py-0.5 rounded-md font-mono text-[11px] font-bold border ${getActionBadgeColor(log.action)}`}>
                              {log.action}
                            </span>
                          </TableCell>

                          <TableCell className="text-slate-300 uppercase font-semibold text-[11px]">
                            {log.entity_type}
                          </TableCell>

                          <TableCell className="font-mono text-amber-300 text-xs max-w-[140px] truncate" title={log.entity_id || ''}>
                            {log.entity_id || '—'}
                          </TableCell>

                          <TableCell className="font-mono text-slate-400 text-[11px] max-w-xs truncate" title={JSON.stringify(log.details)}>
                            {JSON.stringify(log.details)}
                          </TableCell>
                        </TableRow>

                        {/* Expandable JSON details row */}
                        {isExpanded && (
                          <TableRow className="bg-[#0A1420] border-[#1E2D3D]">
                            <TableCell colSpan={7} className="p-4 pl-12 text-xs">
                              <div className="space-y-2">
                                <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">
                                  Full Event Payload (JSON):
                                </span>
                                <pre className="p-3 bg-[#060D15] rounded-xl border border-[#1E3347] font-mono text-slate-300 text-[11px] overflow-x-auto whitespace-pre-wrap">
                                  {JSON.stringify(log.details, null, 2)}
                                </pre>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </tbody>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
