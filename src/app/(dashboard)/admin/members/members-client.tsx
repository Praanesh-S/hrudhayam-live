'use client';

import { useState } from 'react';
import { AuthUser } from '@/lib/auth/session';
import { updateMemberPhone, moveMemberToGroup, reassignSuperAdmin } from '../actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Users, 
  Search, 
  Phone, 
  ArrowRightLeft, 
  Crown, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  ShieldCheck,
  Edit2
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface MembersAdminClientProps {
  groups: any[];
  members: any[];
  usersList: any[];
  currentUser: AuthUser;
}

export function MembersAdminClient({
  groups,
  members,
  usersList,
  currentUser,
}: MembersAdminClientProps) {
  const [selectedTeam, setSelectedTeam] = useState<number | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Edit Phone modal
  const [editingMember, setEditingMember] = useState<any | null>(null);
  const [newPhone, setNewPhone] = useState('');

  // Move Team modal
  const [movingMember, setMovingMember] = useState<any | null>(null);
  const [targetTeamId, setTargetTeamId] = useState<number>(1);

  // Super Admin reassignment modal
  const [showSuperAdminModal, setShowSuperAdminModal] = useState(false);
  const [selectedSuperUser, setSelectedSuperUser] = useState<string>('');

  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Handle Edit Phone
  const handleSavePhone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember) return;

    setIsLoading(true);
    setStatusMessage(null);

    const res = await updateMemberPhone(editingMember.id, newPhone);
    setIsLoading(false);

    if (res.success) {
      setStatusMessage({ type: 'success', text: `Phone number updated for ${editingMember.full_name}.` });
      setEditingMember(null);
    } else {
      setStatusMessage({ type: 'error', text: res.error || 'Failed to update phone.' });
    }
  };

  // Handle Move Member
  const handleConfirmMove = async () => {
    if (!movingMember) return;

    setIsLoading(true);
    setStatusMessage(null);

    const res = await moveMemberToGroup(movingMember.id, targetTeamId);
    setIsLoading(false);

    if (res.success) {
      setStatusMessage({
        type: 'success',
        text: `Moved ${movingMember.full_name} to ${res.toGroupName}. Moved ${res.passesMoved} passes (₹${(res.amountMoved || 0).toLocaleString('en-IN')}).`,
      });
      setMovingMember(null);
    } else {
      setStatusMessage({ type: 'error', text: res.error || 'Failed to move member.' });
    }
  };

  // Handle Super Admin Reassignment
  const handleReassignSuperAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSuperUser) return;

    setIsLoading(true);
    setStatusMessage(null);

    const res = await reassignSuperAdmin(selectedSuperUser);
    setIsLoading(false);

    if (res.success) {
      setStatusMessage({ type: 'success', text: res.message || 'Super Admin reassigned successfully.' });
      setShowSuperAdminModal(false);
    } else {
      setStatusMessage({ type: 'error', text: res.error || 'Failed to reassign Super Admin.' });
    }
  };

  const filteredMembers = members.filter((m) => {
    const matchTeam = selectedTeam === 'all' || m.group_id === selectedTeam;
    const matchSearch =
      m.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.phone_raw && m.phone_raw.includes(searchQuery));
    return matchTeam && matchSearch;
  });

  return (
    <div className="space-y-6">
      {statusMessage && (
        <Alert className={statusMessage.type === 'success' ? 'bg-emerald-950/70 border-emerald-800 text-emerald-100' : 'bg-red-950/70 border-red-800 text-red-100'}>
          {statusMessage.type === 'success' ? <CheckCircle2 className="h-5 w-5 text-emerald-400" /> : <AlertCircle className="h-5 w-5 text-red-400" />}
          <AlertTitle className="text-base font-bold">{statusMessage.type === 'success' ? 'Success' : 'Error'}</AlertTitle>
          <AlertDescription className="text-sm">{statusMessage.text}</AlertDescription>
        </Alert>
      )}

      {/* Top Banner: Super Admin Reassignment Option */}
      <div className="p-4 bg-[#131F2E] border border-amber-500/30 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-[#E8913A]">
            <Crown className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-white text-base">Super Admin Role Assignment</h3>
            <p className="text-xs text-slate-400">
              Praanesh / System Admin authority: Reassign or designate the primary Super Admin organizer.
            </p>
          </div>
        </div>
        <Button
          onClick={() => setShowSuperAdminModal(true)}
          className="bg-[#1A2839] hover:bg-[#223345] border border-amber-500/40 text-amber-300 font-bold h-9 text-xs rounded-xl"
        >
          Change Super Admin
        </Button>
      </div>

      {/* Reassign Super Admin Modal */}
      {showSuperAdminModal && (
        <form onSubmit={handleReassignSuperAdmin} className="p-6 bg-[#131F2E] border-2 border-amber-500 rounded-3xl space-y-4 shadow-2xl">
          <h3 className="text-xl font-black text-white flex items-center gap-2">
            <Crown className="w-6 h-6 text-[#E8913A]" /> Transfer Super Admin Role
          </h3>
          <p className="text-xs text-slate-400">
            Select the account to designate as Super Admin. This account will have full access to club settings, quotas, and prize snapshots.
          </p>

          <div className="space-y-2">
            <Label className="text-sm font-bold text-white">Select User Account</Label>
            <select
              value={selectedSuperUser}
              onChange={(e) => setSelectedSuperUser(e.target.value)}
              className="w-full h-12 bg-[#1A2839] border border-slate-700 text-white rounded-xl px-3 text-sm"
              required
            >
              <option value="">-- Choose Account --</option>
              {usersList.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.login_id} ({u.role.replace('_', ' ').toUpperCase()})
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowSuperAdminModal(false)}
              className="bg-[#1A2839] border-slate-700 text-white rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !selectedSuperUser}
              className="bg-[#E8913A] hover:bg-[#D97706] text-slate-950 font-bold rounded-xl"
            >
              Confirm Super Admin Assignment
            </Button>
          </div>
        </form>
      )}

      {/* Team Filter Pills */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setSelectedTeam('all')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            selectedTeam === 'all'
              ? 'bg-[#E8913A] text-slate-950 shadow-md'
              : 'bg-[#131F2E] border border-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          All Teams ({members.length})
        </button>
        {groups.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => setSelectedTeam(g.id)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              selectedTeam === g.id
                ? 'bg-[#E8913A] text-slate-950 shadow-md'
                : 'bg-[#131F2E] border border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            {g.name}
          </button>
        ))}
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3.5 top-3.5 h-5 w-5 text-slate-400" />
        <Input
          placeholder="Search member name or phone..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-11 h-12 bg-[#131F2E] border-slate-800 text-white rounded-xl text-base"
        />
      </div>

      {/* Edit Phone Modal */}
      {editingMember && (
        <form onSubmit={handleSavePhone} className="p-6 bg-[#131F2E] border-2 border-amber-500/60 rounded-3xl space-y-4 shadow-2xl">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Phone className="w-5 h-5 text-[#E8913A]" /> Edit Phone Number — {editingMember.full_name}
          </h3>
          <p className="text-xs text-slate-400">
            Current: <span className="font-mono text-white">{editingMember.phone_raw}</span> ({editingMember.phone_status})
          </p>

          <div className="space-y-1">
            <Label className="text-xs font-bold text-slate-300">New Mobile Number</Label>
            <Input
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              placeholder="e.g. +91 9841012345 or foreign +1 240..."
              className="h-11 bg-[#1A2839] border-slate-700 text-white rounded-xl font-mono text-base"
              required
              autoFocus
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditingMember(null)}
              className="bg-[#1A2839] border-slate-700 text-white rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !newPhone.trim()}
              className="bg-[#E8913A] hover:bg-[#D97706] text-slate-950 font-bold rounded-xl"
            >
              Save Phone Number
            </Button>
          </div>
        </form>
      )}

      {/* Move Member Modal */}
      {movingMember && (
        <div className="p-6 bg-[#131F2E] border-2 border-amber-500/60 rounded-3xl space-y-4 shadow-2xl">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-amber-500" /> Move Member to Another Team
          </h3>
          
          <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl space-y-2">
            <p className="text-sm font-bold text-amber-300">
              ⚠️ Re-attribution Impact (§10):
            </p>
            <p className="text-xs text-slate-300 leading-relaxed">
              Moving <strong className="text-white">{movingMember.full_name}</strong> will move{' '}
              <strong className="text-amber-400">{movingMember.sales_count} passes</strong> totaling{' '}
              <strong className="text-amber-400">₹{movingMember.sales_amount?.toLocaleString('en-IN')}</strong> from{' '}
              <strong className="text-white">{movingMember.groups?.name}</strong> to the new team. The leaderboard will recompute live.
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-bold text-slate-300">Select Destination Team</Label>
            <select
              value={targetTeamId}
              onChange={(e) => setTargetTeamId(Number(e.target.value))}
              className="w-full h-11 bg-[#1A2839] border border-slate-700 text-white rounded-xl px-3 text-sm font-bold"
            >
              {groups
                .filter((g) => g.id !== movingMember.group_id)
                .map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setMovingMember(null)}
              className="bg-[#1A2839] border-slate-700 text-white rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={isLoading}
              onClick={handleConfirmMove}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Confirm Move
            </Button>
          </div>
        </div>
      )}

      {/* Members List */}
      <div className="space-y-3">
        {filteredMembers.map((m) => (
          <div
            key={m.id}
            className="p-4 sm:p-5 bg-[#131F2E] border border-slate-800 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3"
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base sm:text-lg text-white">{m.full_name}</span>
                {m.is_group_admin && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    Coordinator
                  </span>
                )}
                <span className="text-xs text-slate-500 font-mono">[{m.groups?.name}]</span>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 mt-1">
                <span className="font-mono flex items-center gap-1">
                  <Phone className="w-3 h-3 text-slate-500" /> {m.phone_raw}
                  {m.phone_status === 'foreign' && ' (US)'}
                  {m.phone_status === 'missing' && ' (Missing)'}
                </span>
                <span className="text-[#E8913A] font-mono">
                  {m.sales_count} passes • ₹{m.sales_amount?.toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-800 flex-wrap sm:flex-nowrap">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditingMember(m);
                  setNewPhone(m.phone_raw || '');
                }}
                className="bg-[#1A2839] border-slate-700 text-slate-300 hover:text-white rounded-xl text-xs h-9 shrink-0"
              >
                <Edit2 className="w-3.5 h-3.5 mr-1" /> Edit Phone
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setMovingMember(m);
                  const otherGroup = groups.find((g) => g.id !== m.group_id);
                  if (otherGroup) setTargetTeamId(otherGroup.id);
                }}
                className="bg-[#1A2839] border-slate-700 text-amber-400 hover:text-white rounded-xl text-xs h-9 shrink-0"
              >
                <ArrowRightLeft className="w-3.5 h-3.5 mr-1" /> Move Team
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
