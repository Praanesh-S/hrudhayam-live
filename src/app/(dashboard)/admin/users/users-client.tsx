'use client';

import { useState } from 'react';
import { AuthUser } from '@/lib/auth/session';
import { 
  makeTechCoordinatorAction, 
  removeTechCoordinatorAction, 
  addTeamMemberAction, 
  updateMemberDetailsAction,
  createUserAccount,
  updateUserAccount,
  resetUserPassword,
  toggleUserActive,
  deleteUserAccount
} from '../actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { 
  Users, 
  ShieldCheck, 
  UserPlus, 
  Edit2, 
  AlertCircle, 
  Loader2, 
  Check, 
  Trash2,
  Shield,
  Smartphone,
  Key,
  Lock,
  Eye,
  EyeOff,
  UserCheck,
  RefreshCw,
  Power,
  UserX,
  Plus
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { StatusDialog } from '@/components/ui/status-dialog';
import { cn } from '@/lib/utils';

interface UsersClientProps {
  groups: any[];
  members: any[];
  initialUsers: any[];
  currentUser: AuthUser;
}

export function UsersClient({ groups, members: initialMembers, initialUsers = [], currentUser }: UsersClientProps) {
  const [members, setMembers] = useState(initialMembers);
  const [users, setUsers] = useState<any[]>(initialUsers);

  // Unmissable status dialog
  const [dialogState, setDialogState] = useState<{
    open: boolean;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string | React.ReactNode;
    actionText?: string;
  } | null>(null);

  // Inline add member form state per group: { [groupId]: { name: string, phone: string } }
  const [addFormState, setAddFormState] = useState<Record<number, { name: string; phone: string }>>({});
  const [isAddingMemberForGroup, setIsAddingMemberForGroup] = useState<number | null>(null);

  // "Grant / Create Login" Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createAccountType, setCreateAccountType] = useState<'member' | 'non_member'>('member');
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);
  const [createFullName, setCreateFullName] = useState('');
  const [createLoginId, setCreateLoginId] = useState('');
  const [createPassword, setCreatePassword] = useState('Welcome@2026');
  const [createRole, setCreateRole] = useState<'super_admin' | 'group_admin' | 'tech_coordinator' | 'system_admin'>('group_admin');
  const [createMustChangePass, setCreateMustChangePass] = useState(true);
  const [showPasswordText, setShowPasswordText] = useState(false);
  const [isCreatingUser, setIsCreatingUser] = useState(false);

  // "Manage User / Reset Password" Modal State
  const [managingUser, setManagingUser] = useState<any | null>(null);
  const [manageLoginId, setManageLoginId] = useState('');
  const [manageFullName, setManageFullName] = useState('');
  const [manageRole, setManageRole] = useState<'super_admin' | 'group_admin' | 'tech_coordinator' | 'system_admin'>('group_admin');
  const [managePassword, setManagePassword] = useState('');
  const [manageIsActive, setManageIsActive] = useState(true);
  const [isUpdatingUser, setIsUpdatingUser] = useState(false);

  // "Make Tech Coordinator" Modal State
  const [promotingMember, setPromotingMember] = useState<any | null>(null);
  const [techMobile, setTechMobile] = useState<string>('');
  const [isPromoting, setIsPromoting] = useState<boolean>(false);

  // "Remove Tech Role" Modal State
  const [demotingMember, setDemotingMember] = useState<any | null>(null);
  const [isDemoting, setIsDemoting] = useState<boolean>(false);

  // "Edit Member" Modal State
  const [editingMember, setEditingMember] = useState<any | null>(null);
  const [editName, setEditName] = useState<string>('');
  const [editPhone, setEditPhone] = useState<string>('');
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);

  // Non-member users
  const nonMemberUsers = users.filter((u) => u.member_id === null);

  // Open Create Modal prefilled for a member
  const handleOpenCreateForMember = (member: any) => {
    setCreateAccountType('member');
    setSelectedMemberId(member.id);
    setCreateFullName(member.full_name);
    const cleanDigits = (member.phone_raw || '').replace(/\D/g, '').slice(-10);
    setCreateLoginId(cleanDigits || member.full_name.toLowerCase().replace(/[^a-z0-9]/g, ''));
    setCreatePassword('Welcome@2026');
    setCreateRole(member.is_tech_coord ? 'tech_coordinator' : 'group_admin');
    setCreateMustChangePass(true);
    setShowCreateModal(true);
  };

  // Open Create Modal for a new non-member
  const handleOpenCreateNonMember = () => {
    setCreateAccountType('non_member');
    setSelectedMemberId(null);
    setCreateFullName('');
    setCreateLoginId('');
    setCreatePassword('Welcome@2026');
    setCreateRole('tech_coordinator');
    setCreateMustChangePass(true);
    setShowCreateModal(true);
  };

  // Handle Create User Account
  const handleConfirmCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createLoginId.trim()) {
      toast.error('Login ID is required.');
      return;
    }
    if (!createPassword || createPassword.length < 6) {
      toast.error('Password must be at least 6 characters.');
      return;
    }

    setIsCreatingUser(true);
    try {
      const res = await createUserAccount({
        loginId: createLoginId.trim(),
        password: createPassword,
        role: createRole,
        memberId: createAccountType === 'member' ? selectedMemberId : null,
        fullName: createAccountType === 'non_member' ? createFullName.trim() : (members.find(m => m.id === selectedMemberId)?.full_name || null),
        mustChangePassword: createMustChangePass,
      });

      if (res.success && res.user) {
        setUsers((prev) => [...prev.filter((u) => u.id !== res.user.id), res.user]);
        if (createAccountType === 'member' && selectedMemberId) {
          setMembers((prev) =>
            prev.map((m) =>
              m.id === selectedMemberId
                ? {
                    ...m,
                    has_login: true,
                    is_tech_coord: createRole === 'tech_coordinator' ? true : m.is_tech_coord,
                  }
                : m
            )
          );
        }
        setShowCreateModal(false);
        setDialogState({
          open: true,
          type: 'success',
          title: 'Login Account Created',
          message: `Login credentials successfully created for "${res.user.login_id}" with role ${createRole.toUpperCase()}. Default password: "${createPassword}".`,
          actionText: 'OK, Great',
        });
      } else {
        setDialogState({
          open: true,
          type: 'error',
          title: 'Account Creation Failed',
          message: res.error || 'Could not create account.',
        });
      }
    } catch (err: any) {
      setDialogState({
        open: true,
        type: 'error',
        title: 'System Error',
        message: err.message || 'Error occurred while creating account.',
      });
    } finally {
      setIsCreatingUser(false);
    }
  };

  // Open Manage User Modal
  const handleOpenManageUser = (user: any) => {
    setManagingUser(user);
    setManageLoginId(user.login_id);
    setManageFullName(user.full_name || '');
    setManageRole(user.role);
    setManagePassword('');
    setManageIsActive(user.is_active !== false);
  };

  // Handle Save User Changes (login_id, full_name, role, password, active)
  const handleSaveManageUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!managingUser) return;

    setIsUpdatingUser(true);
    try {
      const res = await updateUserAccount({
        userId: managingUser.id,
        loginId: manageLoginId.trim(),
        fullName: manageFullName.trim() || null,
        role: manageRole,
        password: managePassword.trim() ? managePassword.trim() : undefined,
        isActive: manageIsActive,
      });

      if (res.success) {
        setUsers((prev) =>
          prev.map((u) =>
            u.id === managingUser.id
              ? {
                  ...u,
                  login_id: manageLoginId.trim(),
                  full_name: manageFullName.trim() || null,
                  role: manageRole,
                  is_active: manageIsActive,
                }
              : u
          )
        );

        if (managingUser.member_id) {
          setMembers((prev) =>
            prev.map((m) =>
              m.id === managingUser.member_id
                ? {
                    ...m,
                    is_tech_coord: manageRole === 'tech_coordinator',
                  }
                : m
            )
          );
        }

        setManagingUser(null);
        setDialogState({
          open: true,
          type: 'success',
          title: 'Account Updated',
          message: `User account "${manageLoginId.trim()}" has been updated successfully.${managePassword.trim() ? ' Password was reset.' : ''}`,
          actionText: 'OK',
        });
      } else {
        setDialogState({
          open: true,
          type: 'error',
          title: 'Update Failed',
          message: res.error || 'Failed to update account.',
        });
      }
    } catch (err: any) {
      setDialogState({
        open: true,
        type: 'error',
        title: 'System Error',
        message: err.message || 'Error occurred while updating account.',
      });
    } finally {
      setIsUpdatingUser(false);
    }
  };

  // Handle Delete User Account
  const handleDeleteUser = async (userId: string, loginId: string) => {
    if (!confirm(`Are you sure you want to remove login access for "${loginId}"?`)) return;

    try {
      const res = await deleteUserAccount(userId);
      if (res.success) {
        const deletedUser = users.find((u) => u.id === userId);
        setUsers((prev) => prev.filter((u) => u.id !== userId));
        if (deletedUser?.member_id) {
          setMembers((prev) =>
            prev.map((m) =>
              m.id === deletedUser.member_id
                ? { ...m, has_login: false, is_tech_coord: false }
                : m
            )
          );
        }
        setManagingUser(null);
        setDialogState({
          open: true,
          type: 'success',
          title: 'Account Removed',
          message: res.message || `Login account for "${loginId}" has been deleted.`,
        });
      } else {
        setDialogState({
          open: true,
          type: 'error',
          title: 'Delete Failed',
          message: res.error || 'Could not delete user account.',
        });
      }
    } catch (err: any) {
      toast.error(err.message || 'Error deleting account.');
    }
  };

  // Handle Toggle Active
  const handleToggleActive = async (userId: string, currentStatus: boolean, loginId: string) => {
    const newStatus = !currentStatus;
    try {
      const res = await toggleUserActive(userId, newStatus);
      if (res.success) {
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, is_active: newStatus } : u))
        );
        toast.success(`Account "${loginId}" is now ${newStatus ? 'active' : 'deactivated'}.`);
      } else {
        toast.error(res.error || 'Failed to toggle status.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error updating status.');
    }
  };

  // Handle Make Tech Coordinator
  const handleOpenPromote = (m: any) => {
    setPromotingMember(m);
    setTechMobile(m.phone_raw || '');
  };

  const handleConfirmPromote = async () => {
    if (!promotingMember) return;
    if (!techMobile.trim()) {
      toast.error('Mobile number is required.');
      return;
    }
    setIsPromoting(true);
    try {
      const res = await makeTechCoordinatorAction(promotingMember.id, techMobile.trim());
      if (res.success) {
        toast.success(`${promotingMember.full_name} is now Tech Coordinator!`);
        setMembers((prev) =>
          prev.map((m) => {
            if (m.group_id === promotingMember.group_id) {
              if (m.id === promotingMember.id) {
                return { ...m, is_tech_coord: true, has_login: true, phone_raw: techMobile.trim() };
              }
              if (m.is_tech_coord) {
                return { ...m, is_tech_coord: false, has_login: false };
              }
            }
            return m;
          })
        );
        // Refresh users state with new tech coordinator login
        const digits = techMobile.replace(/\D/g, '').slice(-10);
        setUsers((prev) => {
          const filtered = prev.filter((u) => u.member_id !== promotingMember.id);
          return [
            ...filtered,
            {
              id: 'temp-' + Date.now(),
              login_id: digits,
              role: 'tech_coordinator',
              member_id: promotingMember.id,
              full_name: promotingMember.full_name,
              is_active: true,
            },
          ];
        });
        setPromotingMember(null);
      } else {
        toast.error(res.error || 'Failed to promote member.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error promoting member.');
    } finally {
      setIsPromoting(false);
    }
  };

  // Handle Remove Tech Coordinator
  const handleConfirmDemote = async () => {
    if (!demotingMember) return;
    setIsDemoting(true);
    try {
      const res = await removeTechCoordinatorAction(demotingMember.id);
      if (res.success) {
        toast.success(`Removed Tech Coordinator role from ${demotingMember.full_name}.`);
        setMembers((prev) =>
          prev.map((m) =>
            m.id === demotingMember.id
              ? { ...m, is_tech_coord: false, has_login: false }
              : m
          )
        );
        setUsers((prev) => prev.filter((u) => u.member_id !== demotingMember.id));
        setDemotingMember(null);
      } else {
        toast.error(res.error || 'Failed to remove tech role.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error removing tech role.');
    } finally {
      setIsDemoting(false);
    }
  };

  // Handle Add Member
  const handleAddMember = async (groupId: number) => {
    const form = addFormState[groupId] || { name: '', phone: '' };
    if (!form.name.trim() || !form.phone.trim()) {
      toast.error('Please enter both name and mobile number.');
      return;
    }
    setIsAddingMemberForGroup(groupId);
    try {
      const res = await addTeamMemberAction(groupId, form.name.trim(), form.phone.trim());
      if (res.success && res.member) {
        toast.success(`Added ${res.member.full_name} to Team ${groupId}.`);
        setMembers((prev) => [...prev, res.member]);
        setAddFormState((prev) => ({
          ...prev,
          [groupId]: { name: '', phone: '' },
        }));
      } else {
        toast.error(res.error || 'Failed to add member.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error adding member.');
    } finally {
      setIsAddingMemberForGroup(null);
    }
  };

  // Handle Save Edit
  const handleSaveEdit = async () => {
    if (!editingMember) return;
    if (!editName.trim() || !editPhone.trim()) {
      toast.error('Name and mobile are required.');
      return;
    }
    setIsSavingEdit(true);
    try {
      const res = await updateMemberDetailsAction(editingMember.id, editName.trim(), editPhone.trim());
      if (res.success) {
        toast.success('Member details updated.');
        setMembers((prev) =>
          prev.map((m) =>
            m.id === editingMember.id
              ? { ...m, full_name: editName.trim(), phone_raw: editPhone.trim() }
              : m
          )
        );
        setEditingMember(null);
      } else {
        toast.error(res.error || 'Failed to update member.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error updating member.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* Unmissable Status Dialog */}
      {dialogState && (
        <StatusDialog
          open={dialogState.open}
          onOpenChange={(open) => !open && setDialogState(null)}
          type={dialogState.type}
          title={dialogState.title}
          message={dialogState.message}
          actionText={dialogState.actionText}
        />
      )}

      {/* Header with Prominent Create Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
            Groups, Members & Logins
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Administration · {currentUser.fullName} ({currentUser.role === 'super_admin' ? 'Super Admin' : 'Admin'})
          </p>
        </div>

        {/* Big Elder-friendly Create Login Button */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            onClick={handleOpenCreateNonMember}
            className="h-12 px-5 bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-slate-950 font-black text-sm rounded-xl shadow-lg shadow-teal-950/40 flex items-center gap-2 transition-all transform active:scale-95"
          >
            <Key className="w-5 h-5 text-slate-950 shrink-0" />
            <span>+ Create Login Credentials</span>
          </Button>
        </div>
      </div>

      {/* Top Banner Box */}
      <div className="border-l-4 border-amber-500 bg-[#102030] p-5 rounded-r-2xl border-y border-r border-slate-800 text-slate-300 text-sm leading-relaxed shadow-lg">
        Super Admin can grant login credentials to <strong className="text-white">Rotary Members</strong> (Team Coordinators, Tech Coordinators, or Sellers) and <strong className="text-white">Non-Members / External Staff</strong> (Gate Managers, Auditors, System Operators). Passes and payments entered by any user are automatically tracked for full accountability.
      </div>

      {/* Role Badges Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs bg-[#0E1825] p-3 rounded-xl border border-slate-800">
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 rounded bg-purple-500/20 text-purple-400 border border-purple-500/30 font-bold text-[11px] uppercase tracking-wider">
            SUPER ADMIN
          </span>
          <span className="text-slate-400">full master access</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold text-[11px] uppercase tracking-wider">
            GROUP ADMIN
          </span>
          <span className="text-slate-400">team coordinator</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 rounded bg-teal-500/20 text-teal-400 border border-teal-500/30 font-bold text-[11px] uppercase tracking-wider">
            TECH COORDINATOR
          </span>
          <span className="text-slate-400">team tech helper</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30 font-bold text-[11px] uppercase tracking-wider">
            SYSTEM ADMIN
          </span>
          <span className="text-slate-400">technical support</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 font-bold text-[11px] uppercase tracking-wider">
            MEMBER
          </span>
          <span className="text-slate-400">registry only</span>
        </div>
      </div>

      {/* SECTION 1: SYSTEM & NON-MEMBER LOGIN ACCOUNTS */}
      <div className="bg-[#102030] border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-teal-400" />
              System & Non-Member Logins
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Login accounts not linked to standard club roster members ({nonMemberUsers.length} active account{nonMemberUsers.length !== 1 ? 's' : ''})
            </p>
          </div>

          <Button
            type="button"
            size="sm"
            onClick={handleOpenCreateNonMember}
            className="h-8 px-3 bg-teal-500/20 text-teal-300 hover:bg-teal-500/30 border border-teal-500/40 text-xs font-bold rounded-lg self-start sm:self-auto"
          >
            + Add Non-Member Login
          </Button>
        </div>

        {nonMemberUsers.length === 0 ? (
          <p className="text-xs text-slate-500 py-2">
            No non-member accounts created yet. Click above to add non-member staff or administrators.
          </p>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {nonMemberUsers.map((u) => {
              const isSelf = currentUser.id === u.id;
              const roleColor =
                u.role === 'super_admin'
                  ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                  : u.role === 'system_admin'
                  ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                  : u.role === 'tech_coordinator'
                  ? 'bg-teal-500/20 text-teal-300 border-teal-500/30'
                  : 'bg-amber-500/20 text-amber-300 border-amber-500/30';

              return (
                <div
                  key={u.id}
                  className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                      <span className="font-bold text-white text-base">
                        {u.full_name || u.login_id}
                      </span>
                      {isSelf && (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                          YOU
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-400 font-mono">
                      <span>Login ID: <strong className="text-slate-200">{u.login_id}</strong></span>
                      <span>·</span>
                      <span className={u.is_active ? 'text-emerald-400' : 'text-red-400'}>
                        {u.is_active ? '● Active' : '○ Inactive'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center flex-wrap gap-2">
                    <span className={cn('px-2.5 py-0.5 rounded border font-bold text-[10px] uppercase tracking-wider', roleColor)}>
                      {u.role.replace('_', ' ')}
                    </span>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenManageUser(u)}
                      className="h-7 px-2.5 border-slate-800 bg-[#0B1724] hover:bg-slate-800 text-slate-200 text-xs font-medium rounded-lg"
                    >
                      Manage Login
                    </Button>

                    {!isSelf && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggleActive(u.id, u.is_active, u.login_id)}
                        className={cn(
                          'h-7 px-2 border-slate-800 bg-[#0B1724] text-xs font-medium rounded-lg',
                          u.is_active
                            ? 'hover:bg-amber-950/40 hover:text-amber-300 hover:border-amber-800 text-slate-400'
                            : 'hover:bg-emerald-950/40 hover:text-emerald-300 hover:border-emerald-800 text-emerald-400'
                        )}
                        title={u.is_active ? 'Deactivate account' : 'Reactivate account'}
                      >
                        <Power className="w-3.5 h-3.5" />
                      </Button>
                    )}

                    {!isSelf && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteUser(u.id, u.login_id)}
                        className="h-7 px-2 border-slate-800 bg-[#0B1724] hover:bg-red-950/40 hover:text-red-300 hover:border-red-800 text-slate-400 text-xs font-medium rounded-lg"
                        title="Delete account"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SECTION 2: TEAM CARDS (GROUPS 1 TO 8) */}
      <div className="space-y-6 pt-2">
        <div className="border-b border-slate-800 pb-2">
          <h2 className="text-xl font-black text-white">Rotary Club Team Rosters & Logins</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Grant login access, assign Tech Coordinators, or update member phone numbers.
          </p>
        </div>

        {groups.map((group) => {
          const groupMembers = members.filter((m) => m.group_id === group.id);
          const groupAdmin = groupMembers.find((m) => m.is_group_admin);
          const techCoord = groupMembers.find((m) => m.is_tech_coord);

          const formState = addFormState[group.id] || { name: '', phone: '' };

          return (
            <div
              key={group.id}
              className="bg-[#102030] border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4 shadow-xl"
            >
              {/* Team Card Header */}
              <div className="border-b border-slate-800 pb-3">
                <h3 className="text-lg sm:text-xl font-black text-white">
                  {group.name}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {groupMembers.length} member{groupMembers.length !== 1 ? 's' : ''} · {groupAdmin ? `Captain: ${groupAdmin.full_name}` : 'No Captain assigned'} · {techCoord ? `Tech: ${techCoord.full_name}` : 'No Tech Coordinator'}
                </p>
              </div>

              {/* Members List */}
              <div className="divide-y divide-slate-800/60">
                {groupMembers.map((member) => {
                  const isGA = member.is_group_admin;
                  const isTC = member.is_tech_coord;
                  // Look up user account
                  const userAccount = users.find((u) => u.member_id === member.id);

                  return (
                    <div
                      key={member.id}
                      className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      {/* Name, Phone, and Login Status */}
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                        <span className="font-bold text-white text-sm sm:text-base">
                          {member.full_name}
                        </span>
                        <span className="text-xs font-mono text-slate-400">
                          {member.phone_raw || 'No phone'}
                        </span>

                        {/* Login Credential Tag */}
                        {userAccount ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono font-bold">
                            <Key className="w-3 h-3 text-emerald-400" />
                            <span>Login: {userAccount.login_id}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 text-[10px] font-mono">
                            No Login
                          </span>
                        )}
                      </div>

                      {/* Role Chips & Action Buttons */}
                      <div className="flex items-center flex-wrap gap-2">
                        {isGA && (
                          <span className="px-2.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold text-[10px] uppercase tracking-wider">
                            GROUP ADMIN
                          </span>
                        )}

                        {isTC && (
                          <>
                            <span className="px-2.5 py-0.5 rounded bg-teal-500/20 text-teal-400 border border-teal-500/30 font-bold text-[10px] uppercase tracking-wider">
                              TECH COORDINATOR
                            </span>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setDemotingMember(member)}
                              className="h-7 px-2.5 border-slate-800 bg-[#0B1724] hover:bg-red-950/40 hover:text-red-300 hover:border-red-800 text-slate-400 text-xs font-medium rounded-lg"
                            >
                              Remove tech role
                            </Button>
                          </>
                        )}

                        {!isGA && !isTC && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenPromote(member)}
                            className="h-7 px-2.5 border-slate-800 bg-[#0B1724] hover:bg-teal-950/40 hover:text-teal-300 hover:border-teal-700 text-slate-400 text-xs font-medium rounded-lg"
                          >
                            Make Tech Coordinator
                          </Button>
                        )}

                        {/* Grant or Manage Login Button */}
                        {userAccount ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenManageUser(userAccount)}
                            className="h-7 px-2.5 border-emerald-800/60 bg-emerald-950/30 hover:bg-emerald-900/50 text-emerald-300 text-xs font-medium rounded-lg"
                          >
                            <Key className="w-3 h-3 mr-1" />
                            Manage Login
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenCreateForMember(member)}
                            className="h-7 px-2.5 border-teal-700/60 bg-teal-950/30 hover:bg-teal-900/50 text-teal-300 text-xs font-medium rounded-lg"
                          >
                            <Plus className="w-3 h-3 mr-1" />
                            Grant Login
                          </Button>
                        )}

                        {/* Edit Member Details */}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditingMember(member);
                            setEditName(member.full_name);
                            setEditPhone(member.phone_raw || '');
                          }}
                          className="h-7 px-2.5 border-slate-800 bg-[#0B1724] hover:bg-slate-800 text-slate-300 text-xs font-medium rounded-lg"
                        >
                          Edit
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Inline Add Member Row */}
              <div className="pt-2 border-t border-slate-800/80">
                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <Input
                    placeholder="New member name"
                    value={formState.name}
                    onChange={(e) =>
                      setAddFormState((prev) => ({
                        ...prev,
                        [group.id]: { ...formState, name: e.target.value },
                      }))
                    }
                    className="h-11 bg-[#0B1724] border-slate-800 rounded-xl text-white text-sm"
                  />

                  <Input
                    placeholder="Mobile number"
                    value={formState.phone}
                    onChange={(e) =>
                      setAddFormState((prev) => ({
                        ...prev,
                        [group.id]: { ...formState, phone: e.target.value },
                      }))
                    }
                    className="h-11 bg-[#0B1724] border-slate-800 rounded-xl text-white text-sm"
                  />

                  <Button
                    type="button"
                    disabled={isAddingMemberForGroup === group.id}
                    onClick={() => handleAddMember(group.id)}
                    className="w-full sm:w-auto h-11 px-5 bg-[#E58327] hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl shrink-0 transition-colors shadow-md shadow-amber-950/30"
                  >
                    {isAddingMemberForGroup === group.id ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-1" />
                    ) : (
                      <span className="mr-1">+</span>
                    )}
                    <span>Add member</span>
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* DIALOG 1: GRANT / CREATE LOGIN CREDENTIALS */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="bg-[#102030] border border-slate-800 text-white max-w-lg rounded-2xl">
          <form onSubmit={handleConfirmCreateUser} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="text-xl font-black text-white flex items-center gap-2">
                <Key className="w-5 h-5 text-teal-400" />
                Grant Login Credentials
              </DialogTitle>
              <DialogDescription className="text-slate-400 text-xs mt-0.5">
                Create a password-protected login account for a Rotary member or external staff member.
              </DialogDescription>
            </DialogHeader>

            {/* Account Type Toggle */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-300">Account Type</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setCreateAccountType('member');
                    if (members.length > 0 && !selectedMemberId) {
                      setSelectedMemberId(members[0].id);
                      setCreateFullName(members[0].full_name);
                      const digits = (members[0].phone_raw || '').replace(/\D/g, '').slice(-10);
                      setCreateLoginId(digits || members[0].full_name.toLowerCase().replace(/[^a-z0-9]/g, ''));
                    }
                  }}
                  className={cn(
                    'py-2.5 px-3 rounded-xl border text-xs font-bold transition-all text-center',
                    createAccountType === 'member'
                      ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-md'
                      : 'bg-[#0B1724] border-slate-800 text-slate-400 hover:text-white'
                  )}
                >
                  Rotary Member
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCreateAccountType('non_member');
                    setSelectedMemberId(null);
                    setCreateFullName('');
                    setCreateLoginId('');
                  }}
                  className={cn(
                    'py-2.5 px-3 rounded-xl border text-xs font-bold transition-all text-center',
                    createAccountType === 'non_member'
                      ? 'bg-teal-500/20 border-teal-500 text-teal-300 shadow-md'
                      : 'bg-[#0B1724] border-slate-800 text-slate-400 hover:text-white'
                  )}
                >
                  Non-Member / External Staff
                </button>
              </div>
            </div>

            {/* If Member: Select member */}
            {createAccountType === 'member' && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-300">Select Member <span className="text-red-400">*</span></Label>
                <select
                  value={selectedMemberId || ''}
                  onChange={(e) => {
                    const id = Number(e.target.value);
                    setSelectedMemberId(id);
                    const m = members.find((mem) => mem.id === id);
                    if (m) {
                      setCreateFullName(m.full_name);
                      const digits = (m.phone_raw || '').replace(/\D/g, '').slice(-10);
                      setCreateLoginId(digits || m.full_name.toLowerCase().replace(/[^a-z0-9]/g, ''));
                    }
                  }}
                  className="w-full h-11 bg-[#0B1724] border border-slate-800 rounded-xl px-3 text-white text-sm focus:outline-none focus:border-amber-500"
                >
                  <option value="" disabled>Select a member</option>
                  {members.map((m) => {
                    const group = groups.find((g) => g.id === m.group_id);
                    const hasUser = users.some((u) => u.member_id === m.id);
                    return (
                      <option key={m.id} value={m.id}>
                        {m.full_name} ({group?.name || `Team ${m.group_id}`}) {hasUser ? '· [Already has login]' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}

            {/* Full Name for Non-Members */}
            {createAccountType === 'non_member' && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-300">Full Name / Description <span className="text-red-400">*</span></Label>
                <Input
                  placeholder="e.g. Kiru / Concert Gate Supervisor"
                  value={createFullName}
                  onChange={(e) => setCreateFullName(e.target.value)}
                  className="h-11 bg-[#0B1724] border-slate-800 text-white rounded-xl"
                  required
                />
              </div>
            )}

            {/* Login ID */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-300">
                Login ID / Username <span className="text-red-400">*</span>
              </Label>
              <Input
                placeholder="e.g. 9841012345 or username"
                value={createLoginId}
                onChange={(e) => setCreateLoginId(e.target.value)}
                className="h-11 bg-[#0B1724] border-slate-800 text-white font-mono rounded-xl"
                required
              />
              <p className="text-[11px] text-slate-500">
                For members, this defaults to their 10-digit mobile number. Minimum 3 characters.
              </p>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <Label className="text-xs font-semibold text-slate-300">Initial Password <span className="text-red-400">*</span></Label>
                <button
                  type="button"
                  onClick={() => setCreatePassword('Welcome@2026')}
                  className="text-[11px] text-teal-400 hover:underline"
                >
                  Use Default (Welcome@2026)
                </button>
              </div>
              <div className="relative">
                <Input
                  type={showPasswordText ? 'text' : 'password'}
                  value={createPassword}
                  onChange={(e) => setCreatePassword(e.target.value)}
                  placeholder="Enter initial password"
                  className="h-11 bg-[#0B1724] border-slate-800 text-white pr-10 rounded-xl font-mono text-sm"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPasswordText(!showPasswordText)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-white"
                >
                  {showPasswordText ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Role Select */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-300">Role / Access Level <span className="text-red-400">*</span></Label>
              <select
                value={createRole}
                onChange={(e) => setCreateRole(e.target.value as any)}
                className="w-full h-11 bg-[#0B1724] border border-slate-800 rounded-xl px-3 text-white text-sm focus:outline-none focus:border-teal-500"
              >
                <option value="group_admin">Group Admin — Team coordinator with sales & reports access</option>
                <option value="tech_coordinator">Tech Coordinator — Team tech coordinator helping enter sales</option>
                <option value="super_admin">Super Admin — Full master access to all financial & system settings</option>
                <option value="system_admin">System Admin — Technical administrator</option>
              </select>
            </div>

            {/* Force change password */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="createMustChange"
                checked={createMustChangePass}
                onChange={(e) => setCreateMustChangePass(e.target.checked)}
                className="rounded border-slate-700 bg-[#0B1724] text-teal-600 focus:ring-teal-500 w-4 h-4"
              />
              <label htmlFor="createMustChange" className="text-xs text-slate-300 cursor-pointer">
                Require user to change password on first login
              </label>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCreateModal(false)}
                className="border-slate-800 bg-[#0B1724] text-slate-300 hover:bg-slate-800 rounded-xl text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isCreatingUser || !createLoginId.trim() || !createPassword}
                className="bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-xl text-xs px-5"
              >
                {isCreatingUser ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                Create Account
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIALOG 2: MANAGE USER LOGIN & PASSWORD RESET */}
      <Dialog open={!!managingUser} onOpenChange={(open) => !open && setManagingUser(null)}>
        <DialogContent className="bg-[#102030] border border-slate-800 text-white max-w-md rounded-2xl">
          <form onSubmit={handleSaveManageUser} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="text-lg font-black text-white flex items-center gap-2">
                <Key className="w-5 h-5 text-teal-400" />
                Manage Login: {managingUser?.login_id}
              </DialogTitle>
              <DialogDescription className="text-slate-400 text-xs mt-0.5">
                Reset password, modify username/role, or manage active status.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-1">
              {/* Full Name */}
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-300">Name / Description</Label>
                <Input
                  value={manageFullName}
                  onChange={(e) => setManageFullName(e.target.value)}
                  className="h-10 bg-[#0B1724] border-slate-800 text-white rounded-xl text-sm"
                />
              </div>

              {/* Login ID */}
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-300">Login ID</Label>
                <Input
                  value={manageLoginId}
                  onChange={(e) => setManageLoginId(e.target.value)}
                  className="h-10 bg-[#0B1724] border-slate-800 text-white font-mono rounded-xl text-sm"
                  required
                />
              </div>

              {/* Reset Password */}
              <div className="space-y-1 pt-1">
                <div className="flex justify-between items-center">
                  <Label className="text-xs font-semibold text-slate-300">Reset Password (Optional)</Label>
                  <button
                    type="button"
                    onClick={() => setManagePassword('Welcome@2026')}
                    className="text-[11px] text-teal-400 hover:underline"
                  >
                    Set to Welcome@2026
                  </button>
                </div>
                <Input
                  type="text"
                  placeholder="Leave blank to keep unchanged"
                  value={managePassword}
                  onChange={(e) => setManagePassword(e.target.value)}
                  className="h-10 bg-[#0B1724] border-slate-800 text-white font-mono rounded-xl text-sm"
                />
                <p className="text-[10px] text-slate-500">
                  Entering a new password immediately terminates all existing sessions for this user.
                </p>
              </div>

              {/* Role */}
              <div className="space-y-1 pt-1">
                <Label className="text-xs font-semibold text-slate-300">Role</Label>
                <select
                  value={manageRole}
                  onChange={(e) => setManageRole(e.target.value as any)}
                  className="w-full h-10 bg-[#0B1724] border border-slate-800 rounded-xl px-3 text-white text-xs focus:outline-none focus:border-teal-500"
                >
                  <option value="group_admin">Group Admin</option>
                  <option value="tech_coordinator">Tech Coordinator</option>
                  <option value="super_admin">Super Admin</option>
                  <option value="system_admin">System Admin</option>
                </select>
              </div>

              {/* Active Toggle */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="manageActive"
                  checked={manageIsActive}
                  onChange={(e) => setManageIsActive(e.target.checked)}
                  className="rounded border-slate-700 bg-[#0B1724] text-teal-600 focus:ring-teal-500 w-4 h-4"
                />
                <label htmlFor="manageActive" className="text-xs text-slate-300 cursor-pointer">
                  Account is Active (can log in)
                </label>
              </div>
            </div>

            <DialogFooter className="flex justify-between items-center sm:justify-between pt-2">
              {currentUser.id !== managingUser?.id ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleDeleteUser(managingUser.id, managingUser.login_id)}
                  className="border-red-900/60 bg-red-950/30 text-red-400 hover:bg-red-900/50 rounded-xl text-xs"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" />
                  Delete Account
                </Button>
              ) : <div />}

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setManagingUser(null)}
                  className="border-slate-800 bg-[#0B1724] text-slate-300 hover:bg-slate-800 rounded-xl text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isUpdatingUser || !manageLoginId.trim()}
                  className="bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-xl text-xs px-4"
                >
                  {isUpdatingUser ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                  Save Changes
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIALOG 3: MAKE TECH COORDINATOR */}
      <Dialog open={!!promotingMember} onOpenChange={(open) => !open && setPromotingMember(null)}>
        <DialogContent className="bg-[#102030] border border-slate-800 text-white max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-teal-400" />
              Make Tech Coordinator
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs mt-1">
              Promote {promotingMember?.full_name} to Tech Coordinator?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs text-slate-300">
            <p>
              They will be able to log in with this mobile number via password, sell passes for anyone in their team, view group reports, and manage entries.
            </p>

            {members.some((m) => m.group_id === promotingMember?.group_id && m.is_tech_coord) && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>
                  This team already has a Tech Coordinator ({members.find((m) => m.group_id === promotingMember?.group_id && m.is_tech_coord)?.full_name}). Promoting {promotingMember?.full_name} will replace them.
                </span>
              </div>
            )}

            <div className="space-y-1.5 pt-1">
              <Label className="text-xs font-semibold text-slate-200">
                Tech Coordinator Mobile Number <span className="text-red-400">*</span>
              </Label>
              <Input
                value={techMobile}
                onChange={(e) => setTechMobile(e.target.value)}
                placeholder="e.g. 98410 22222"
                className="h-11 bg-[#0B1724] border-slate-800 text-white font-mono rounded-xl"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPromotingMember(null)}
              className="border-slate-800 bg-[#0B1724] text-slate-300 hover:bg-slate-800 rounded-xl text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={isPromoting || !techMobile.trim()}
              onClick={handleConfirmPromote}
              className="bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-xl text-xs"
            >
              {isPromoting ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
              Confirm Promotion
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG 4: DEMOTE TECH COORDINATOR */}
      <Dialog open={!!demotingMember} onOpenChange={(open) => !open && setDemotingMember(null)}>
        <DialogContent className="bg-[#102030] border border-slate-800 text-white max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-white">
              Remove Tech Role
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs mt-1">
              Remove Tech Coordinator access for {demotingMember?.full_name}?
            </DialogDescription>
          </DialogHeader>

          <p className="py-2 text-xs text-slate-300">
            They will remain a team member and keep all their sales credit, but will no longer be able to log in or enter passes for the team.
          </p>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDemotingMember(null)}
              className="border-slate-800 bg-[#0B1724] text-slate-300 hover:bg-slate-800 rounded-xl text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={isDemoting}
              onClick={handleConfirmDemote}
              className="bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-xs"
            >
              {isDemoting ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
              Remove Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG 5: EDIT MEMBER DETAILS */}
      <Dialog open={!!editingMember} onOpenChange={(open) => !open && setEditingMember(null)}>
        <DialogContent className="bg-[#102030] border border-slate-800 text-white max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-white">
              Edit Member Details
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs mt-1">
              Update name and phone number.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-200">Full Name</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="h-11 bg-[#0B1724] border-slate-800 text-white rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-200">Mobile Number</Label>
              <Input
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                className="h-11 bg-[#0B1724] border-slate-800 text-white font-mono rounded-xl"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditingMember(null)}
              className="border-slate-800 bg-[#0B1724] text-slate-300 hover:bg-slate-800 rounded-xl text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={isSavingEdit || !editName.trim()}
              onClick={handleSaveEdit}
              className="bg-[#E58327] hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs"
            >
              {isSavingEdit ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
