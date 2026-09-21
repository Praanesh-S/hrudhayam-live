'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Database,
  Download,
  Cloud,
  Clock,
  ShieldCheck,
  RefreshCw,
  Loader2,
  FileJson,
  CheckCircle2,
  AlertCircle,
  HardDrive
} from 'lucide-react';
import { toast } from 'sonner';
import { StoredBackupItem, triggerManualDatabaseBackupAction, listDatabaseBackupsAction } from '../actions';
import { AuthUser } from '@/lib/auth/session';

interface BackupClientProps {
  initialBackups: StoredBackupItem[];
  currentUser: AuthUser;
}

export function BackupClient({ initialBackups, currentUser }: BackupClientProps) {
  const [backups, setBackups] = useState<StoredBackupItem[]>(initialBackups);
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [isRefreshingList, setIsRefreshingList] = useState(false);

  const handleCreateSnapshot = async () => {
    setIsCreatingBackup(true);
    try {
      const res = await triggerManualDatabaseBackupAction();
      if (res.success) {
        toast.success(`Cloud snapshot created: ${res.file}`);
        // Refresh backups list
        const updated = await listDatabaseBackupsAction();
        if (updated.success && updated.backups) {
          setBackups(updated.backups);
        }
      } else {
        toast.error(res.error || 'Failed to create snapshot');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error creating cloud snapshot');
    } finally {
      setIsCreatingBackup(false);
    }
  };

  const handleRefreshList = async () => {
    setIsRefreshingList(true);
    try {
      const res = await listDatabaseBackupsAction();
      if (res.success && res.backups) {
        setBackups(res.backups);
        toast.success('Backups list refreshed');
      } else {
        toast.error(res.error || 'Failed to refresh backups');
      }
    } catch (err: any) {
      toast.error('Error refreshing backups');
    } finally {
      setIsRefreshingList(false);
    }
  };

  const handleDirectDownload = () => {
    window.location.href = '/api/admin/backup';
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white flex items-center gap-3">
            <Database className="w-8 h-8 text-amber-500" />
            Database Backups & Cloud Snapshots
          </h1>
          <p className="text-slate-400 text-sm sm:text-base mt-1">
            Automated recurring cloud snapshots and 1-click downloads of passes, payments, seating, sponsors, and audit logs.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={handleRefreshList}
            disabled={isRefreshingList}
            variant="outline"
            className="bg-[#131F2E] border-slate-800 text-slate-300 hover:text-white rounded-xl text-xs h-10"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isRefreshingList ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button
            onClick={handleDirectDownload}
            className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl h-10 shadow-lg shadow-amber-950/40"
          >
            <Download className="w-4 h-4 mr-1.5" />
            1-Click Live Download (.json)
          </Button>
        </div>
      </div>

      {/* Info & Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: 1-Click Direct Download */}
        <Card className="bg-[#0B1724] border-[#1D3249] shadow-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-slate-300 flex items-center justify-between">
              <span>Instant Download</span>
              <HardDrive className="w-4 h-4 text-amber-400" />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-slate-400 leading-relaxed">
              Export the entire database right now to your device. Dumps all 11 tables including passes, payments, seats, and audit records.
            </p>
            <Button
              onClick={handleDirectDownload}
              className="w-full bg-[#131F2E] hover:bg-[#1A2A3E] text-amber-400 border border-amber-500/30 hover:border-amber-500/60 font-bold text-xs rounded-xl h-10"
            >
              <Download className="w-4 h-4 mr-1.5" />
              Download JSON Now
            </Button>
          </CardContent>
        </Card>

        {/* Card 2: Manual Cloud Snapshot */}
        <Card className="bg-[#0B1724] border-[#1D3249] shadow-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-slate-300 flex items-center justify-between">
              <span>Cloud Snapshot</span>
              <Cloud className="w-4 h-4 text-sky-400" />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-slate-400 leading-relaxed">
              Trigger a timestamped snapshot directly into private Supabase Storage without downloading. Viewable in the archive below.
            </p>
            <Button
              onClick={handleCreateSnapshot}
              disabled={isCreatingBackup}
              className="w-full bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs rounded-xl h-10 shadow-lg shadow-sky-950/40"
            >
              {isCreatingBackup ? (
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              ) : (
                <Cloud className="w-4 h-4 mr-1.5" />
              )}
              {isCreatingBackup ? 'Saving Snapshot...' : 'Save Cloud Snapshot Now'}
            </Button>
          </CardContent>
        </Card>

        {/* Card 3: Automated Vercel Cron Status */}
        <Card className="bg-[#0B1724] border-[#1D3249] shadow-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-slate-300 flex items-center justify-between">
              <span>Automated Schedule</span>
              <Clock className="w-4 h-4 text-emerald-400" />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Vercel Cron Active</span>
            </div>
            <p className="text-slate-400">
              Runs daily at <strong className="text-white">02:00 UTC (07:30 AM IST)</strong> via <code className="text-amber-400 text-[11px]">/api/admin/backup?cron=true</code>.
            </p>
            <p className="text-[11px] text-slate-500 pt-1 border-t border-[#1D3249]">
              Destination: Private Supabase Storage bucket (<code className="text-slate-400">backups</code>).
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Cloud Archive Table */}
      <div className="bg-[#0B1724] rounded-2xl border border-[#1D3249] overflow-hidden shadow-xl">
        <div className="p-4 border-b border-[#1D3249] flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Cloud className="w-4 h-4 text-amber-500" />
              Stored Cloud Backups Archive ({backups.length})
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Historical snapshots stored in private Supabase Storage. Click Download to retrieve any version.
            </p>
          </div>
        </div>

        {backups.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs">
            <FileJson className="w-12 h-12 mx-auto mb-2 text-slate-600" />
            <p className="font-bold text-slate-400 text-sm">No cloud backups archived yet</p>
            <p className="mt-1">Click "Save Cloud Snapshot Now" or wait for the daily automated Vercel Cron.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#07111C] text-slate-400 border-b border-[#1D3249]">
                  <th className="p-3 pl-4">Snapshot File</th>
                  <th className="p-3">Source</th>
                  <th className="p-3">Date & Time</th>
                  <th className="p-3 text-right">File Size</th>
                  <th className="p-3 pr-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1D3249]/60 text-slate-200">
                {backups.map((b) => {
                  const sizeKB = Math.round(b.size / 1024);
                  const isAuto = b.is_auto || b.name.includes('_auto_');
                  const dateStr = b.created_at ? new Date(b.created_at).toLocaleString('en-IN', {
                    dateStyle: 'medium',
                    timeStyle: 'medium',
                  }) : '-';

                  return (
                    <tr key={b.name} className="hover:bg-[#0E2032] transition-colors">
                      <td className="p-3 pl-4">
                        <div className="font-mono font-bold text-white flex items-center gap-2">
                          <FileJson className="w-4 h-4 text-amber-400 shrink-0" />
                          <span>{b.name}</span>
                        </div>
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            isAuto
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                          }`}
                        >
                          {isAuto ? 'AUTOMATED CRON' : 'MANUAL SNAPSHOT'}
                        </span>
                      </td>
                      <td className="p-3 text-slate-300 font-mono text-[11px]">
                        {dateStr}
                      </td>
                      <td className="p-3 text-right font-mono text-slate-300">
                        {sizeKB > 1024 ? `${(sizeKB / 1024).toFixed(2)} MB` : `${sizeKB} KB`}
                      </td>
                      <td className="p-3 pr-4 text-right">
                        {b.download_url ? (
                          <a
                            href={b.download_url}
                            download={b.name}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#131F2E] hover:bg-[#1A2A3E] text-amber-400 hover:text-amber-300 border border-slate-700 text-xs font-bold transition-all no-underline"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Download</span>
                          </a>
                        ) : (
                          <span className="text-slate-500 italic text-[11px]">URL expired</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Scope & Recovery Guide Card */}
      <Card className="bg-[#0B1724]/80 border-[#1D3249]">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold text-slate-300 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-amber-400" />
            Backup Scope & Data Integrity
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs text-slate-400 leading-relaxed">
          <p>
            Each backup snapshot captures a full point-in-time state of 11 database tables:
            <strong className="text-slate-200"> passes, payments, seats, rows, bands, sponsors, participating_clubs, members, groups, protected_blocks,</strong> and <strong className="text-slate-200">audit_logs</strong>.
          </p>
          <p>
            User login credentials (passwords) are excluded from the export for strict security. Backups are stored in a private Supabase Storage bucket accessible only to Super Admins and System Admins.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
