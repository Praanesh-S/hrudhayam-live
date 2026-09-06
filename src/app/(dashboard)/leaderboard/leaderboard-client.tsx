'use client';

import { useState } from 'react';
import { AuthUser } from '@/lib/auth/session';
import { takePrizeSnapshot } from './actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Trophy, 
  Users, 
  Camera, 
  Search, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  Calendar
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface LeaderboardClientProps {
  individual: any[];
  groups: any[];
  snapshots: any[];
  currentUser: AuthUser;
}

export function LeaderboardClient({
  individual,
  groups,
  snapshots,
  currentUser,
}: LeaderboardClientProps) {
  const [activeTab, setActiveTab] = useState<'teams' | 'individual' | 'snapshots'>('teams');
  const [searchQuery, setSearchQuery] = useState('');

  // Snapshot taking modal
  const [showSnapshotModal, setShowSnapshotModal] = useState(false);
  const [snapshotName, setSnapshotName] = useState('');
  const [isTakingSnapshot, setIsTakingSnapshot] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Selected snapshot to view
  const [selectedSnapshot, setSelectedSnapshot] = useState<any | null>(null);

  const isSuperOrSystemAdmin = currentUser.role === 'super_admin' || currentUser.role === 'system_admin';

  const handleTakeSnapshot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!snapshotName.trim()) return;

    setIsTakingSnapshot(true);
    setStatusMessage(null);

    const res = await takePrizeSnapshot(snapshotName);
    setIsTakingSnapshot(false);

    if (res.success) {
      setStatusMessage({ type: 'success', text: `Snapshot "${snapshotName}" captured and frozen successfully!` });
      setSnapshotName('');
      setShowSnapshotModal(false);
    } else {
      setStatusMessage({ type: 'error', text: res.error || 'Failed to capture snapshot.' });
    }
  };

  const filteredIndividual = individual.filter(
    (m) =>
      m.member_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.group_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {statusMessage && (
        <Alert className={statusMessage.type === 'success' ? 'bg-emerald-950/70 border-emerald-800 text-emerald-100' : 'bg-red-950/70 border-red-800 text-red-100'}>
          {statusMessage.type === 'success' ? <CheckCircle2 className="h-5 w-5 text-emerald-400" /> : <AlertCircle className="h-5 w-5 text-red-400" />}
          <AlertTitle className="text-base font-bold">{statusMessage.type === 'success' ? 'Snapshot Frozen' : 'Error'}</AlertTitle>
          <AlertDescription className="text-sm">{statusMessage.text}</AlertDescription>
        </Alert>
      )}

      {/* Tabs & Controls */}
      <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3.5">
        <div className="flex overflow-x-auto no-scrollbar gap-1.5 p-1.5 bg-[#131F2E] border border-slate-800 rounded-2xl max-w-full">
          <button
            type="button"
            onClick={() => { setActiveTab('teams'); setSelectedSnapshot(null); }}
            className={`flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm whitespace-nowrap transition-all shrink-0 ${
              activeTab === 'teams' ? 'bg-[#E8913A] text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4 shrink-0" /> Team Standings
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('individual'); setSelectedSnapshot(null); }}
            className={`flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm whitespace-nowrap transition-all shrink-0 ${
              activeTab === 'individual' ? 'bg-[#E8913A] text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Trophy className="w-4 h-4 shrink-0" /> Individual Standings
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('snapshots')}
            className={`flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm whitespace-nowrap transition-all shrink-0 ${
              activeTab === 'snapshots' ? 'bg-[#E8913A] text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Camera className="w-4 h-4 shrink-0" /> Prize Snapshots
          </button>
        </div>

        {isSuperOrSystemAdmin && (
          <Button
            onClick={() => setShowSnapshotModal(true)}
            className="bg-[#1A2839] hover:bg-[#253950] border border-slate-700 text-white font-bold h-11 px-5 rounded-xl shrink-0 self-start md:self-auto"
          >
            <Camera className="w-4 h-4 mr-2 text-[#E8913A]" /> Freeze Prize Snapshot
          </Button>
        )}
      </div>

      {/* Snapshot Modal */}
      {showSnapshotModal && (
        <form onSubmit={handleTakeSnapshot} className="bg-[#131F2E] border-2 border-amber-500/50 p-6 rounded-3xl space-y-4 shadow-2xl">
          <div>
            <h3 className="text-xl font-black text-white">Capture Immutable Prize Snapshot (§19.8)</h3>
            <p className="text-slate-400 text-xs mt-0.5">
              Freezes current standings permanently for award ceremonies. Subsequent sales or member moves will not alter this snapshot.
            </p>
          </div>
          <div className="space-y-2">
            <Input
              placeholder="e.g. Grand Finale Final Cutoff - 8 PM"
              value={snapshotName}
              onChange={(e) => setSnapshotName(e.target.value)}
              className="h-12 bg-[#1A2839] border-slate-700 text-white rounded-xl"
              required
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowSnapshotModal(false)}
              className="bg-[#1A2839] border-slate-700 text-white rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isTakingSnapshot || !snapshotName.trim()}
              className="bg-[#E8913A] hover:bg-[#D97706] text-slate-950 font-black rounded-xl"
            >
              {isTakingSnapshot ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Confirm & Freeze Snapshot
            </Button>
          </div>
        </form>
      )}

      {/* TAB 1: TEAM STANDINGS */}
      {activeTab === 'teams' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            {groups.map((g) => {
              const isTop3 = g.rank <= 3;
              const rankColor =
                g.rank === 1
                  ? 'border-amber-500 bg-amber-500/10'
                  : g.rank === 2
                  ? 'border-slate-400 bg-slate-400/10'
                  : g.rank === 3
                  ? 'border-amber-700 bg-amber-700/10'
                  : 'border-slate-800 bg-[#131F2E]';

              return (
                <div
                  key={g.group_id}
                  className={`p-6 rounded-2xl border-2 ${rankColor} flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-all`}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center font-black text-2xl font-mono text-white">
                      {g.rank === 1 ? '🥇' : g.rank === 2 ? '🥈' : g.rank === 3 ? '🥉' : `#${g.rank}`}
                    </div>
                    <div>
                      <h3 className="text-2xl font-black text-white">{g.group_name}</h3>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400 mt-1">
                        <span>Passes: <strong className="text-white font-mono">{g.tickets_count}</strong></span>
                        <span>Passes ₹: <strong className="text-white font-mono">₹{g.tickets_amount.toLocaleString('en-IN')}</strong></span>
                        <span>Sponsors ₹: <strong className="text-white font-mono">₹{g.sponsors_amount.toLocaleString('en-IN')}</strong></span>
                      </div>
                    </div>
                  </div>

                  <div className="text-left sm:text-right w-full sm:w-auto border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-800">
                    <span className="text-xs uppercase tracking-wider text-slate-400">Total Funds Raised</span>
                    <div className="text-3xl font-black text-[#E8913A] font-mono">
                      ₹{g.total_raised.toLocaleString('en-IN')}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: INDIVIDUAL STANDINGS */}
      {activeTab === 'individual' && (
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3.5 top-3.5 h-5 w-5 text-slate-400" />
            <Input
              placeholder="Search member name or team..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-11 h-12 bg-[#131F2E] border-slate-800 text-white rounded-xl text-base"
            />
          </div>

          <div className="space-y-3">
            {filteredIndividual.map((m) => (
              <div
                key={m.member_id}
                className="p-4 sm:p-5 bg-[#131F2E] border border-slate-800 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center font-bold text-sm font-mono text-white">
                    {m.rank === 1 ? '🥇' : m.rank === 2 ? '🥈' : m.rank === 3 ? '🥉' : `#${m.rank}`}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-lg text-white">{m.member_name}</span>
                      {m.is_group_admin && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                          Coordinator
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {m.group_name} • {m.tickets_count} passes (₹{m.tickets_amount.toLocaleString('en-IN')}) • Sponsors (₹{m.sponsors_amount.toLocaleString('en-IN')})
                    </div>
                  </div>
                </div>

                <div className="text-left sm:text-right w-full sm:w-auto border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-800">
                  <span className="text-xl font-black text-[#E8913A] font-mono">
                    ₹{m.total_raised.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: PRIZE SNAPSHOTS (§19.8) */}
      {activeTab === 'snapshots' && (
        <div className="space-y-6">
          {selectedSnapshot ? (
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-[#131F2E] border border-slate-800 p-4 rounded-2xl">
                <div>
                  <h3 className="text-xl font-black text-white">{selectedSnapshot.name}</h3>
                  <p className="text-xs text-slate-400">
                    Captured on {new Date(selectedSnapshot.taken_at).toLocaleString('en-IN')}
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setSelectedSnapshot(null)}
                  className="bg-[#1A2839] border-slate-700 text-white rounded-xl"
                >
                  Back to Snapshots List
                </Button>
              </div>

              <div className="space-y-3">
                <h4 className="font-bold text-white text-lg">Frozen Team Standings</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {selectedSnapshot.snapshot_data?.groups?.map((g: any) => (
                    <div key={g.group_id} className="p-4 bg-[#131F2E] border border-slate-800 rounded-xl flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-white text-base">#{g.rank}</span>
                        <span className="font-bold text-white">{g.group_name}</span>
                      </div>
                      <span className="font-mono font-black text-[#E8913A]">
                        ₹{g.total_raised?.toLocaleString('en-IN')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {snapshots.length === 0 ? (
                <div className="p-12 text-center bg-[#131F2E] border border-slate-800 rounded-3xl text-slate-400">
                  <Camera className="w-12 h-12 mx-auto mb-3 text-slate-600" />
                  <h3 className="text-lg font-bold text-white">No Snapshots Captured Yet</h3>
                  <p className="text-sm mt-1">
                    Super Admins can capture a snapshot anytime to freeze award standings.
                  </p>
                </div>
              ) : (
                snapshots.map((s) => (
                  <div
                    key={s.id}
                    className="p-5 bg-[#131F2E] border border-slate-800 rounded-2xl flex justify-between items-center"
                  >
                    <div>
                      <h4 className="font-bold text-lg text-white">{s.name}</h4>
                      <p className="text-xs text-slate-400 flex items-center gap-1 mt-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {new Date(s.taken_at).toLocaleString('en-IN')}
                      </p>
                    </div>

                    <Button
                      onClick={() => setSelectedSnapshot(s)}
                      className="bg-[#1A2839] hover:bg-[#223345] border border-slate-700 text-white rounded-xl text-sm"
                    >
                      View Standings
                    </Button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
