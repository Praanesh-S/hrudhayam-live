'use client';

import { useState } from 'react';
import { AuthUser } from '@/lib/auth/session';
import { 
  updateMemberPhone, 
  moveMemberToGroup, 
  reassignSuperAdmin,
  createUserAccount,
  provisionAllCoordinators,
  resetUserPassword,
  toggleUserActive,
  deleteUserAccount
} from '../actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  Edit2,
  Key,
  UserPlus,
  Zap,
  Trash2,
  Power,
  Shield,
  Check,
  Copy,
  ExternalLink,
  UserCheck
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
  // Navigation tabs: 'accounts' | 'members'
  const [activeTab, setActiveTab] = useState<'accounts' | 'members'>('accounts');

  const [selectedTeam, setSelectedTeam] = useState<number | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [accountSearchQuery, setAccountSearchQuery] = useState('');

  // Modals state
  const [editingMember, setEditingMember] = useState<any | null>(null);
  const [newPhone, setNewPhone] = useState('');

  const [movingMember, setMovingMember] = useState<any | null>(null);
  const [targetTeamId, setTargetTeamId] = useState<number>(1);

  const [showSuperAdminModal, setShowSuperAdminModal] = useState(false);
  const [selectedSuperUser, setSelectedSuperUser] = useState<string>('');

  // Create User Account modal state
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [createMemberId, setCreateMemberId] = useState<string>('');
  const [createLoginId, setCreateLoginId] = useState<string>('');
  const [createPassword, setCreatePassword] = useState<string>('Welcome@2026');
  const [createRole, setCreateRole] = useState<'group_admin' | 'system_admin' | 'super_admin'>('group_admin');
  const [createMustChange, setCreateMustChange] = useState<boolean>(true);

  // Reset Password modal state
  const [showResetModal, setShowResetModal] = useState(false);
  const [userToReset, setUserToReset] = useState<any | null>(null);
  const [resetPasswordVal, setResetPasswordVal] = useState<string>('Welcome@2026');
  const [resetForceChange, setResetForceChange] = useState<boolean>(true);

  // Auto-provision summary modal state
  const [provisionSummary, setProvisionSummary] = useState<any | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Map member ID to active user account
  const memberUserMap = new Map<number, any>();
  for (const u of usersList) {
    if (u.member_id) {
      memberUserMap.set(u.member_id, u);
    }
  }

  // Count coordinators with account
  const coordinators = members.filter((m) => m.is_group_admin);
  const coordinatorsWithAccount = coordinators.filter((m) => memberUserMap.has(m.id));

  // Copy helper
  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Pre-fill Create User modal for a specific member
  const openCreateModalForMember = (member: any) => {
    setCreateMemberId(String(member.id));
    const raw = member.phone_e164 || member.phone_raw || '';
    const digits = raw.replace(/\D/g, '');
    const cleanPhone = digits.length >= 10 ? digits.slice(-10) : digits;
    setCreateLoginId(cleanPhone);
    setCreateRole('group_admin');
    setCreatePassword('Welcome@2026');
    setCreateMustChange(true);
    setShowCreateUserModal(true);
  };

  // When dropdown selection changes in Create User modal
  const handleMemberSelectChange = (mId: string) => {
    setCreateMemberId(mId);
    if (!mId) {
      setCreateLoginId('');
      return;
    }
    const mem = members.find((m) => String(m.id) === mId);
    if (mem) {
      const raw = mem.phone_e164 || mem.phone_raw || '';
      const digits = raw.replace(/\D/g, '');
      const cleanPhone = digits.length >= 10 ? digits.slice(-10) : digits;
      setCreateLoginId(cleanPhone);
      setCreateRole(mem.is_group_admin ? 'group_admin' : 'group_admin');
    }
  };

  // Handle Create User Account
  const handleCreateAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createLoginId.trim() || !createPassword.trim()) return;

    setIsLoading(true);
    setStatusMessage(null);

    const res = await createUserAccount({
      loginId: createLoginId.trim(),
      password: createPassword.trim(),
      role: createRole,
      memberId: createMemberId ? Number(createMemberId) : null,
      mustChangePassword: createMustChange,
    });

    setIsLoading(false);

    if (res.success) {
      setStatusMessage({
        type: 'success',
        text: `User account "${createLoginId}" created successfully with role ${createRole.replace('_', ' ').toUpperCase()}.`,
      });
      setShowCreateUserModal(false);
      setCreateMemberId('');
      setCreateLoginId('');
    } else {
      setStatusMessage({ type: 'error', text: res.error || 'Failed to create user account.' });
    }
  };

  // Handle 1-Click Provision of all 8 Coordinators
  const handleAutoProvisionCoordinators = async () => {
    if (!confirm('This will create login accounts for all 8 Team Coordinators using their 10-digit mobile number as Login ID and "Welcome@2026" as initial password. Continue?')) {
      return;
    }

    setIsLoading(true);
    setStatusMessage(null);

    const res = await provisionAllCoordinators('Welcome@2026');
    setIsLoading(false);

    if (res.success) {
      setProvisionSummary(res);
      setStatusMessage({
        type: 'success',
        text: `Provisioning complete! Created ${res.createdCount} new coordinator account(s). (${res.skippedCount} already existed).`,
      });
    } else {
      setStatusMessage({ type: 'error', text: res.error || 'Failed to auto-provision coordinators.' });
    }
  };

  // Handle Reset Password
  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userToReset || !resetPasswordVal.trim()) return;

    setIsLoading(true);
    setStatusMessage(null);

    const res = await resetUserPassword(userToReset.id, resetPasswordVal.trim(), resetForceChange);
    setIsLoading(false);

    if (res.success) {
      setStatusMessage({
        type: 'success',
        text: `Password for "${userToReset.login_id}" reset to "${resetPasswordVal.trim()}". Active sessions terminated.`,
      });
      setShowResetModal(false);
      setUserToReset(null);
    } else {
      setStatusMessage({ type: 'error', text: res.error || 'Failed to reset password.' });
    }
  };

  // Handle Toggle Active Status
  const handleToggleActive = async (user: any) => {
    const newStatus = !user.is_active;
    const actionWord = newStatus ? 'activate' : 'deactivate';
    if (!confirm(`Are you sure you want to ${actionWord} the account "${user.login_id}"?`)) return;

    setIsLoading(true);
    setStatusMessage(null);

    const res = await toggleUserActive(user.id, newStatus);
    setIsLoading(false);

    if (res.success) {
      setStatusMessage({
        type: 'success',
        text: `Account "${user.login_id}" has been ${newStatus ? 'activated' : 'deactivated'}.`,
      });
    } else {
      setStatusMessage({ type: 'error', text: res.error || 'Failed to update account status.' });
    }
  };

  // Handle Delete Account
  const handleDeleteAccount = async (user: any) => {
    if (!confirm(`Are you sure you want to remove the login account "${user.login_id}"? (The member roster profile will remain intact).`)) return;

    setIsLoading(true);
    setStatusMessage(null);

    const res = await deleteUserAccount(user.id);
    setIsLoading(false);

    if (res.success) {
      setStatusMessage({
        type: 'success',
        text: res.message || `Account "${user.login_id}" deleted successfully.`,
      });
    } else {
      setStatusMessage({ type: 'error', text: res.error || 'Failed to delete account.' });
    }
  };

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

  const filteredUsers = usersList.filter((u) => {
    const term = accountSearchQuery.toLowerCase();
    const loginMatch = u.login_id?.toLowerCase().includes(term);
    const roleMatch = u.role?.toLowerCase().includes(term);
    const memberName = u.members?.full_name?.toLowerCase() || '';
    const memberMatch = memberName.includes(term);
    return loginMatch || roleMatch || memberMatch;
  });

  return (
    <div className="space-y-6">
      {statusMessage && (
        <Alert className={statusMessage.type === 'success' ? 'bg-emerald-950/70 border-emerald-800 text-emerald-100' : 'bg-red-950/70 border-red-800 text-red-100'}>
          {statusMessage.type === 'success' ? <CheckCircle2 className="h-5 w-5 text-emerald-400" /> : <AlertCircle className="h-5 w-5 text-red-400" />}
          <AlertTitle className="text-base font-bold">{statusMessage.type === 'success' ? 'Success' : 'Notice'}</AlertTitle>
          <AlertDescription className="text-sm">{statusMessage.text}</AlertDescription>
        </Alert>
      )}

      {/* ─────────────────────────────────────────────────────────────
          1. STATS & QUICK PROVISIONING HERO BANNER
      ───────────────────────────────────────────────────────────── */}
      <div className="p-5 bg-gradient-to-r from-[#131F2E] via-[#162538] to-[#131F2E] border-2 border-amber-500/30 rounded-3xl shadow-xl space-y-4">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/30">
                Access & Security
              </span>
              <span className="text-xs text-slate-400 font-mono">Rule R2 & §10</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white mt-1">
              Sub-Admin & User Account Management
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 mt-0.5 max-w-2xl">
              Create logins for the 8 Team Coordinators and members to sell passes. Team Coordinators log in at{' '}
              <span className="font-mono text-amber-300 font-bold">/login</span> using their mobile number as Login ID.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
            <Button
              onClick={handleAutoProvisionCoordinators}
              disabled={isLoading}
              className="bg-gradient-to-r from-amber-500 to-[#E8913A] hover:from-amber-600 hover:to-[#D97706] text-slate-950 font-black rounded-xl h-11 px-4 shadow-lg shadow-amber-500/20 text-xs sm:text-sm flex items-center gap-1.5"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4 fill-slate-950" />}
              ⚡ Auto-Provision 8 Coordinators
            </Button>

            <Button
              onClick={() => {
                setCreateMemberId('');
                setCreateLoginId('');
                setCreatePassword('Welcome@2026');
                setCreateRole('group_admin');
                setCreateMustChange(true);
                setShowCreateUserModal(true);
              }}
              className="bg-[#1A2839] hover:bg-[#223345] border border-amber-500/40 text-amber-300 font-bold rounded-xl h-11 px-4 text-xs sm:text-sm flex items-center gap-1.5"
            >
              <UserPlus className="w-4 h-4" />
              + Create Account
            </Button>

            <Button
              onClick={() => setShowSuperAdminModal(true)}
              variant="outline"
              className="bg-[#1A2839] hover:bg-[#223345] border-slate-700 text-slate-300 font-bold rounded-xl h-11 px-3 text-xs flex items-center gap-1.5"
            >
              <Crown className="w-3.5 h-3.5 text-amber-400" />
              Super Admin
            </Button>
          </div>
        </div>

        {/* Live Status Indicators */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-800/80">
          <div className="p-3 bg-[#0E1722] rounded-2xl border border-slate-800">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Active Logins</p>
            <p className="text-xl sm:text-2xl font-black text-white mt-0.5">
              {usersList.filter((u) => u.is_active).length}{' '}
              <span className="text-xs font-normal text-slate-400">/ {usersList.length}</span>
            </p>
          </div>

          <div className="p-3 bg-[#0E1722] rounded-2xl border border-slate-800">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Coordinators Provisioned</p>
            <p className="text-xl sm:text-2xl font-black text-amber-400 mt-0.5">
              {coordinatorsWithAccount.length}{' '}
              <span className="text-xs font-normal text-slate-400">/ {coordinators.length}</span>
            </p>
          </div>

          <div className="p-3 bg-[#0E1722] rounded-2xl border border-slate-800">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Roster Members</p>
            <p className="text-xl sm:text-2xl font-black text-slate-200 mt-0.5">
              {members.length}
            </p>
          </div>

          <div className="p-3 bg-[#0E1722] rounded-2xl border border-slate-800">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Default Password</p>
            <div className="flex items-center justify-between mt-0.5">
              <span className="text-xs font-mono font-bold text-amber-300">Welcome@2026</span>
              <button
                type="button"
                onClick={() => handleCopy('Welcome@2026', 'default_pass')}
                className="text-slate-400 hover:text-white text-xs"
                title="Copy temporary password"
              >
                {copiedKey === 'default_pass' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. VIEW SELECTOR TABS (Accounts vs Roster)
      ───────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('accounts')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
            activeTab === 'accounts'
              ? 'bg-[#E8913A] text-slate-950 shadow-md'
              : 'bg-[#131F2E] text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Key className="w-4 h-4" />
          Sub-Admin & User Logins ({usersList.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('members')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
            activeTab === 'members'
              ? 'bg-[#E8913A] text-slate-950 shadow-md'
              : 'bg-[#131F2E] text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          Club Members Roster ({members.length})
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          3. TAB CONTENT: SUB-ADMIN & USER ACCOUNTS LIST
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'accounts' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Filter by login ID, name, or role..."
                value={accountSearchQuery}
                onChange={(e) => setAccountSearchQuery(e.target.value)}
                className="pl-10 h-10 bg-[#131F2E] border-slate-800 text-white rounded-xl text-sm"
              />
            </div>
            <p className="text-xs text-slate-400">
              Showing {filteredUsers.length} user account(s)
            </p>
          </div>

          <div className="space-y-3">
            {filteredUsers.map((u) => {
              const linkedMember = u.members;
              const isCurrentUser = u.id === currentUser.id;

              return (
                <div
                  key={u.id}
                  className={`p-4 sm:p-5 bg-[#131F2E] border rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-all ${
                    !u.is_active
                      ? 'border-red-900/40 opacity-70 bg-[#161318]'
                      : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-black text-lg text-white tracking-wide">
                        {u.login_id}
                      </span>

                      {/* Role Badge */}
                      {u.role === 'super_admin' && (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                          <Crown className="w-3 h-3" /> Super Admin
                        </span>
                      )}
                      {u.role === 'system_admin' && (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center gap-1">
                          <Shield className="w-3 h-3" /> System Admin
                        </span>
                      )}
                      {u.role === 'group_admin' && (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                          <Users className="w-3 h-3" /> Sub-Admin (Team Lead)
                        </span>
                      )}

                      {/* Active / Inactive Status */}
                      {u.is_active ? (
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-950/60 text-emerald-400 border border-emerald-800 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Active
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-red-950/60 text-red-400 border border-red-800 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-400" /> Deactivated
                        </span>
                      )}

                      {/* Password Change Flag */}
                      {u.must_change_password ? (
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-950/50 text-amber-300 border border-amber-800/60">
                          First Login Pending
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-800/80 text-slate-300 border border-slate-700">
                          Password Set
                        </span>
                      )}

                      {isCurrentUser && (
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                          (You)
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                      {linkedMember ? (
                        <span className="flex items-center gap-1.5 text-slate-300">
                          <UserCheck className="w-3.5 h-3.5 text-[#E8913A]" />
                          <strong>{linkedMember.full_name}</strong>
                          <span className="text-slate-500">•</span>
                          <span className="text-amber-400 font-bold">{linkedMember.groups?.name || `Team ${linkedMember.group_id}`}</span>
                        </span>
                      ) : (
                        <span className="text-slate-500 italic">
                          Independent Admin Account (Not bound to specific member)
                        </span>
                      )}

                      {u.created_at && (
                        <span className="text-slate-500 font-mono text-[11px]">
                          Created: {new Date(u.created_at).toLocaleDateString('en-IN')}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions for User Account */}
                  <div className="flex flex-wrap items-center gap-2 w-full md:w-auto border-t md:border-t-0 pt-3 md:pt-0 border-slate-800">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setUserToReset(u);
                        setResetPasswordVal('Welcome@2026');
                        setResetForceChange(true);
                        setShowResetModal(true);
                      }}
                      className="bg-[#1A2839] hover:bg-[#223345] border-slate-700 text-amber-300 rounded-xl text-xs h-9"
                    >
                      <Key className="w-3.5 h-3.5 mr-1" /> Reset Password
                    </Button>

                    {!isCurrentUser && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleToggleActive(u)}
                          disabled={isLoading}
                          className={`rounded-xl text-xs h-9 ${
                            u.is_active
                              ? 'bg-[#1A2839] hover:bg-red-950/40 border-slate-700 text-slate-300 hover:text-red-400'
                              : 'bg-emerald-950/40 hover:bg-emerald-900/60 border-emerald-800 text-emerald-400'
                          }`}
                        >
                          <Power className="w-3.5 h-3.5 mr-1" />
                          {u.is_active ? 'Deactivate' : 'Reactivate'}
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeleteAccount(u)}
                          disabled={isLoading}
                          className="bg-[#1A2839] hover:bg-red-950/40 border-slate-700 text-red-400 hover:text-red-300 rounded-xl text-xs h-9"
                          title="Delete or revoke account"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          4. TAB CONTENT: MEMBERS ROSTER & PHONE / TEAM MANAGEMENT
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'members' && (
        <div className="space-y-4">
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

          {/* Members List */}
          <div className="space-y-3">
            {filteredMembers.map((m) => {
              const account = memberUserMap.get(m.id);

              return (
                <div
                  key={m.id}
                  className="p-4 sm:p-5 bg-[#131F2E] border border-slate-800 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-base sm:text-lg text-white">{m.full_name}</span>
                      {m.is_group_admin && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                          Coordinator
                        </span>
                      )}
                      <span className="text-xs text-slate-500 font-mono">[{m.groups?.name}]</span>

                      {/* Login Status Badge */}
                      {account ? (
                        <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                          <Key className="w-3 h-3" /> @{account.login_id}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800/80 text-slate-400 border border-slate-700">
                          No Login
                        </span>
                      )}
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
                    {!account ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openCreateModalForMember(m)}
                        className="bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/30 text-[#E8913A] rounded-xl text-xs h-9 shrink-0 font-bold"
                      >
                        <UserPlus className="w-3.5 h-3.5 mr-1" /> + Create Login
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setUserToReset(account);
                          setResetPasswordVal('Welcome@2026');
                          setResetForceChange(true);
                          setShowResetModal(true);
                        }}
                        className="bg-[#1A2839] border-slate-700 text-amber-300 hover:text-white rounded-xl text-xs h-9 shrink-0"
                      >
                        <Key className="w-3.5 h-3.5 mr-1" /> Reset Pass
                      </Button>
                    )}

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
              );
            })}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          5. MODAL: CREATE USER ACCOUNT
      ───────────────────────────────────────────────────────────── */}
      {showCreateUserModal && (
        <form onSubmit={handleCreateAccountSubmit} className="p-6 bg-[#131F2E] border-2 border-amber-500 rounded-3xl space-y-4 shadow-2xl">
          <div className="flex justify-between items-start">
            <h3 className="text-xl font-black text-white flex items-center gap-2">
              <UserPlus className="w-6 h-6 text-[#E8913A]" /> Provision User Login Account
            </h3>
            <button
              type="button"
              onClick={() => setShowCreateUserModal(false)}
              className="text-slate-400 hover:text-white text-sm"
            >
              ✕
            </button>
          </div>

          <p className="text-xs text-slate-400">
            Create an account for a team coordinator, club member, or administrative staff to log in and sell passes.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Member selector */}
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs font-bold text-slate-300">Link to Club Member (Optional)</Label>
              <select
                value={createMemberId}
                onChange={(e) => handleMemberSelectChange(e.target.value)}
                className="w-full h-11 bg-[#1A2839] border border-slate-700 text-white rounded-xl px-3 text-sm"
              >
                <option value="">-- Custom Admin / Staff (No Member Roster Link) --</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.full_name} ({m.groups?.name}) {m.is_group_admin ? '★ Coordinator' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Login ID */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-300">
                Login ID (10-Digit Mobile or Username) *
              </Label>
              <Input
                value={createLoginId}
                onChange={(e) => setCreateLoginId(e.target.value)}
                placeholder="e.g. 9841068826 or krithiga"
                className="h-11 bg-[#1A2839] border-slate-700 text-white font-mono rounded-xl text-sm"
                required
              />
              <p className="text-[11px] text-slate-500">
                Coordinators will type this into the login screen.
              </p>
            </div>

            {/* Role */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-300">Account Role *</Label>
              <select
                value={createRole}
                onChange={(e) => setCreateRole(e.target.value as any)}
                className="w-full h-11 bg-[#1A2839] border border-slate-700 text-white rounded-xl px-3 text-sm font-bold"
              >
                <option value="group_admin">👥 Group Admin / Sub-Admin (Team Scoped)</option>
                <option value="system_admin">🛡️ System Admin (Operations & Audit)</option>
                <option value="super_admin">👑 Super Admin (Full Authority)</option>
              </select>
            </div>

            {/* Password */}
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs font-bold text-slate-300">Initial Password *</Label>
              <div className="flex gap-2">
                <Input
                  value={createPassword}
                  onChange={(e) => setCreatePassword(e.target.value)}
                  placeholder="Password"
                  className="h-11 bg-[#1A2839] border-slate-700 text-white font-mono rounded-xl text-sm"
                  required
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreatePassword('Welcome@2026')}
                  className="bg-[#1A2839] border-slate-700 text-amber-300 rounded-xl text-xs whitespace-nowrap"
                >
                  Use Welcome@2026
                </Button>
              </div>
            </div>

            {/* Must Change Password */}
            <div className="sm:col-span-2 flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="createMustChange"
                checked={createMustChange}
                onChange={(e) => setCreateMustChange(e.target.checked)}
                className="w-4 h-4 rounded text-[#E8913A] focus:ring-amber-500 bg-[#1A2839] border-slate-700"
              />
              <label htmlFor="createMustChange" className="text-xs text-slate-300 cursor-pointer">
                <strong>Force password change on first login</strong> (Recommended for member privacy)
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowCreateUserModal(false)}
              className="bg-[#1A2839] border-slate-700 text-white rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !createLoginId.trim() || !createPassword.trim()}
              className="bg-[#E8913A] hover:bg-[#D97706] text-slate-950 font-black rounded-xl"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Create Account
            </Button>
          </div>
        </form>
      )}

      {/* ─────────────────────────────────────────────────────────────
          6. MODAL: RESET PASSWORD
      ───────────────────────────────────────────────────────────── */}
      {showResetModal && userToReset && (
        <form onSubmit={handleResetPasswordSubmit} className="p-6 bg-[#131F2E] border-2 border-amber-500/80 rounded-3xl space-y-4 shadow-2xl">
          <div className="flex justify-between items-start">
            <h3 className="text-xl font-black text-white flex items-center gap-2">
              <Key className="w-6 h-6 text-[#E8913A]" /> Reset Password — @{userToReset.login_id}
            </h3>
            <button
              type="button"
              onClick={() => {
                setShowResetModal(false);
                setUserToReset(null);
              }}
              className="text-slate-400 hover:text-white text-sm"
            >
              ✕
            </button>
          </div>

          <p className="text-xs text-slate-400">
            Setting a new password will terminate any active login sessions for this account immediately.
          </p>

          <div className="space-y-2">
            <Label className="text-xs font-bold text-slate-300">New Password *</Label>
            <div className="flex gap-2">
              <Input
                value={resetPasswordVal}
                onChange={(e) => setResetPasswordVal(e.target.value)}
                placeholder="New password (min 6 characters)"
                className="h-11 bg-[#1A2839] border-slate-700 text-white font-mono rounded-xl text-sm"
                required
                autoFocus
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => setResetPasswordVal('Welcome@2026')}
                className="bg-[#1A2839] border-slate-700 text-amber-300 rounded-xl text-xs whitespace-nowrap"
              >
                Use Welcome@2026
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="resetForceChange"
              checked={resetForceChange}
              onChange={(e) => setResetForceChange(e.target.checked)}
              className="w-4 h-4 rounded text-[#E8913A] focus:ring-amber-500 bg-[#1A2839] border-slate-700"
            />
            <label htmlFor="resetForceChange" className="text-xs text-slate-300 cursor-pointer">
              Require user to change this password on next login
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowResetModal(false);
                setUserToReset(null);
              }}
              className="bg-[#1A2839] border-slate-700 text-white rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !resetPasswordVal.trim()}
              className="bg-[#E8913A] hover:bg-[#D97706] text-slate-950 font-black rounded-xl"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Confirm Password Reset
            </Button>
          </div>
        </form>
      )}

      {/* ─────────────────────────────────────────────────────────────
          7. MODAL: AUTO-PROVISION SUMMARY
      ───────────────────────────────────────────────────────────── */}
      {provisionSummary && (
        <div className="p-6 bg-[#131F2E] border-2 border-emerald-500 rounded-3xl space-y-4 shadow-2xl">
          <div className="flex justify-between items-start">
            <h3 className="text-xl font-black text-white flex items-center gap-2">
              <CheckCircle2 className="w-6 h-6 text-emerald-400" /> Auto-Provisioning Complete!
            </h3>
            <button
              type="button"
              onClick={() => setProvisionSummary(null)}
              className="text-slate-400 hover:text-white text-sm"
            >
              ✕
            </button>
          </div>

          <p className="text-xs text-slate-300">
            All 8 team coordinators can now sign in at <strong className="text-white font-mono">/login</strong> using their 10-digit phone number and default password <strong className="text-amber-300 font-mono">{provisionSummary.defaultPassword}</strong>.
          </p>

          <div className="overflow-x-auto max-h-60 rounded-xl border border-slate-800 bg-[#0E1722]">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-[#162538] text-slate-400 font-bold uppercase text-[10px]">
                <tr>
                  <th className="p-2.5">Team</th>
                  <th className="p-2.5">Coordinator Name</th>
                  <th className="p-2.5">Login ID (Mobile)</th>
                  <th className="p-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {(provisionSummary.summary || []).map((item: any, idx: number) => (
                  <tr key={idx} className="hover:bg-[#131F2E]">
                    <td className="p-2.5 font-bold text-amber-400">Team {item.team}</td>
                    <td className="p-2.5 font-medium text-white">{item.name}</td>
                    <td className="p-2.5 font-mono text-emerald-400">{item.loginId}</td>
                    <td className="p-2.5">
                      {item.status === 'created' ? (
                        <span className="text-emerald-400 font-bold">✓ Created</span>
                      ) : (
                        <span className="text-slate-400">Existing</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              onClick={() => setProvisionSummary(null)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs"
            >
              Close Summary
            </Button>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          8. MODAL: REASSIGN SUPER ADMIN
      ───────────────────────────────────────────────────────────── */}
      {showSuperAdminModal && (
        <form onSubmit={handleReassignSuperAdmin} className="p-6 bg-[#131F2E] border-2 border-amber-500 rounded-3xl space-y-4 shadow-2xl">
          <h3 className="text-xl font-black text-white flex items-center gap-2">
            <Crown className="w-6 h-6 text-[#E8913A]" /> Transfer Super Admin Role
          </h3>
          <p className="text-xs text-slate-400">
            Select the account to designate as Super Admin. This account will have master control over all quotas, rules, and exports.
          </p>

          <div className="space-y-2">
            <Label className="text-sm font-bold text-white">Select User Account</Label>
            <select
              value={selectedSuperUser}
              onChange={(e) => setSelectedSuperUser(e.target.value)}
              className="w-full h-12 bg-[#1A2839] border border-slate-700 text-white rounded-xl px-3 text-sm font-bold"
              required
            >
              <option value="">-- Choose Account --</option>
              {usersList.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.login_id} ({u.role.replace('_', ' ').toUpperCase()}) {u.members ? `— ${u.members.full_name}` : ''}
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

      {/* ─────────────────────────────────────────────────────────────
          9. MODAL: EDIT PHONE
      ───────────────────────────────────────────────────────────── */}
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

      {/* ─────────────────────────────────────────────────────────────
          10. MODAL: MOVE MEMBER TEAM
      ───────────────────────────────────────────────────────────── */}
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
    </div>
  );
}
