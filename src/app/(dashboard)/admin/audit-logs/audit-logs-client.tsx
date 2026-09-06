'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { 
  Search, 
  ChevronDown, 
  ChevronRight, 
  History
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
    const actorName = log.actor_name || '';
    const loginId = log.actor_login_id || '';
    const entityId = log.entity_id || '';
    const detailsStr = JSON.stringify(log.after_json || log.before_json || {});

    const matchesSearch = 
      actorName.toLowerCase().includes(search.toLowerCase()) ||
      loginId.toLowerCase().includes(search.toLowerCase()) ||
      entityId.toLowerCase().includes(search.toLowerCase()) ||
      detailsStr.toLowerCase().includes(search.toLowerCase());

    const matchesAction = actionFilter === 'all' || log.action === actionFilter;

    return matchesSearch && matchesAction;
  });

  const getActionBadgeColor = (action: string) => {
    if (action.includes('CANCEL')) return 'bg-red-500/10 text-red-400 border-red-500/30';
    if (action.includes('MOVE')) return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
    if (action.includes('PASS_ISSUE')) return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    if (action.includes('CHECKIN')) return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
    if (action.includes('SPONSOR')) return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
    return 'bg-slate-800 text-slate-300 border-slate-700';
  };

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <Card className="bg-[#0B1724] border-[#1D3249]">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
              <Input
                placeholder="Search action, actor, ID, or JSON payload..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-[#07111C] border-[#1D3249] text-white text-xs h-10"
              />
            </div>

            <Select value={actionFilter} onValueChange={(v) => v && setActionFilter(v)}>
              <SelectTrigger className="bg-[#07111C] border-[#1D3249] text-white text-xs h-10">
                <SelectValue placeholder="All Actions" />
              </SelectTrigger>
              <SelectContent className="bg-[#0B1724] border-[#1D3249] text-white">
                <SelectItem value="all">All Action Types</SelectItem>
                {actionTypes.map((act) => (
                  <SelectItem key={act} value={act}>
                    {act}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <div className="bg-[#0B1724] rounded-2xl border border-[#1D3249] overflow-hidden shadow-xl">
        <div className="p-4 border-b border-[#1D3249] flex items-center justify-between">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <History className="w-4 h-4 text-amber-400" />
            <span>Activity Events</span>
            <span className="px-2 py-0.5 rounded-full bg-[#07111C] text-slate-300 border border-[#1D3249] text-[11px]">
              {filteredLogs.length} events
            </span>
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#07111C] text-slate-400 border-b border-[#1D3249]">
                <th className="p-3 pl-4 w-8"></th>
                <th className="p-3 whitespace-nowrap">Timestamp</th>
                <th className="p-3">Actor</th>
                <th className="p-3">Action</th>
                <th className="p-3">Entity</th>
                <th className="p-3">Entity ID</th>
                <th className="p-3 pr-4">Payload Summary</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1D3249]/60 text-slate-200">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-slate-500 text-xs">
                    No audit records match your filters.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const isExpanded = expandedId === log.id;
                  const dateFormatted = log.at 
                    ? format(new Date(log.at), 'dd MMM yyyy, HH:mm:ss')
                    : '—';
                  const payload = log.after_json || log.before_json || {};

                  return (
                    <tbody key={log.id} className="border-b border-[#1D3249]/40">
                      <tr 
                        onClick={() => setExpandedId(isExpanded ? null : log.id)}
                        className="hover:bg-[#0E2032] cursor-pointer transition-colors"
                      >
                        <td className="p-3 pl-4 text-slate-500">
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-amber-400" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-slate-500" />
                          )}
                        </td>

                        <td className="p-3 font-mono text-slate-400 whitespace-nowrap text-[11px]">
                          {dateFormatted}
                        </td>

                        <td className="p-3">
                          <div className="font-medium text-white">{log.actor_name || 'System'}</div>
                          {log.actor_login_id && (
                            <span className="text-[10px] text-slate-400 font-mono block">
                              @{log.actor_login_id}
                            </span>
                          )}
                        </td>

                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-bold border ${getActionBadgeColor(log.action)}`}>
                            {log.action}
                          </span>
                        </td>

                        <td className="p-3 uppercase font-semibold text-[10px] text-slate-300">
                          {log.entity}
                        </td>

                        <td className="p-3 font-mono text-amber-400 text-[11px] max-w-[140px] truncate" title={log.entity_id || ''}>
                          {log.entity_id || '—'}
                        </td>

                        <td className="p-3 pr-4 font-mono text-slate-400 text-[10px] max-w-xs truncate" title={JSON.stringify(payload)}>
                          {JSON.stringify(payload)}
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr className="bg-[#07111C]">
                          <td colSpan={7} className="p-4 pl-12">
                            <div className="space-y-3">
                              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">
                                Full Audit Payload (Before & After State):
                              </span>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className="p-3 bg-[#0B1724] rounded-xl border border-[#1D3249]">
                                  <span className="text-[10px] font-bold text-slate-400 block mb-1">Before State:</span>
                                  <pre className="font-mono text-slate-300 text-[10px] overflow-x-auto whitespace-pre-wrap">
                                    {JSON.stringify(log.before_json || {}, null, 2)}
                                  </pre>
                                </div>
                                <div className="p-3 bg-[#0B1724] rounded-xl border border-[#1D3249]">
                                  <span className="text-[10px] font-bold text-slate-400 block mb-1">After State:</span>
                                  <pre className="font-mono text-slate-300 text-[10px] overflow-x-auto whitespace-pre-wrap">
                                    {JSON.stringify(log.after_json || {}, null, 2)}
                                  </pre>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
