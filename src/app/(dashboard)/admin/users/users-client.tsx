'use client';

import { useState } from 'react';
import { AuthUser } from '@/lib/auth/session';
import { 
  makeTechCoordinatorAction, 
  removeTechCoordinatorAction, 
  addTeamMemberAction, 
  updateMemberDetailsAction 
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
  Smartphone
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface UsersClientProps {
  groups: any[];
  members: any[];
  currentUser: AuthUser;
}

export function UsersClient({ groups, members: initialMembers, currentUser }: UsersClientProps) {
  const [members, setMembers] = useState(initialMembers);

  // Inline add member form state per group: { [groupId]: { name: string, phone: string } }
  const [addFormState, setAddFormState] = useState<Record<number, { name: string; phone: string }>>({});
  const [isAddingMemberForGroup, setIsAddingMemberForGroup] = useState<number | null>(null);

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
        // Update local state: unset old tech coord in this group, set new one
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
      {/* Header (matches Image 4) */}
      <div>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
          Groups, Members & Logins
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Administration · {currentUser.fullName} ({currentUser.role === 'super_admin' ? 'Super Admin' : 'Admin'})
        </p>
      </div>

      {/* Top Banner Box (matches Image 4) */}
      <div className="border-l-4 border-amber-500 bg-[#102030] p-5 rounded-r-2xl border-y border-r border-slate-800 text-slate-300 text-sm leading-relaxed shadow-lg">
        Each group has a <strong className="text-white">Group Admin</strong> (the team coordinator) and can have <strong className="text-white">one Tech Coordinator</strong> — a tech-savvy member who helps operate the system when the Group Admin (often 60+) prefers not to. The Tech Coordinator has the <strong className="text-white">same access as the Group Admin, for their group only</strong>. Sales they enter are credited to the actual seller; the app records them as "entered by".
      </div>

      {/* Role Badges Legend (matches Image 4) */}
      <div className="flex flex-wrap items-center gap-4 text-xs">
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold text-[11px] uppercase tracking-wider">
            GROUP ADMIN
          </span>
          <span className="text-slate-400">logs in · sells · manages group</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 rounded bg-teal-500/20 text-teal-400 border border-teal-500/30 font-bold text-[11px] uppercase tracking-wider">
            TECH COORDINATOR
          </span>
          <span className="text-slate-400">same access, helps operate</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 font-bold text-[11px] uppercase tracking-wider">
            MEMBER
          </span>
          <span className="text-slate-400">registry only · gets sale credit</span>
        </div>
      </div>

      {/* Team Cards (matches Image 4) */}
      <div className="space-y-6 pt-2">
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
                <h2 className="text-lg sm:text-xl font-black text-white">
                  {group.name}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {groupMembers.length} member{groupMembers.length !== 1 ? 's' : ''} · {groupAdmin ? '1 Group Admin' : 'no Group Admin'} · {techCoord ? '1 Tech Coordinator' : 'no Tech Coordinator yet'}
                </p>
              </div>

              {/* Members List */}
              <div className="divide-y divide-slate-800/60">
                {groupMembers.map((member) => {
                  const isGA = member.is_group_admin;
                  const isTC = member.is_tech_coord;

                  return (
                    <div
                      key={member.id}
                      className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      {/* Name & Phone */}
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-white text-sm sm:text-base">
                          {member.full_name}
                        </span>
                        <span className="text-xs font-mono text-slate-400">
                          {member.phone_raw || 'No phone'}
                        </span>
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
                            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 font-bold text-[10px] uppercase tracking-wider">
                              MEMBER
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
                          <>
                            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 font-bold text-[10px] uppercase tracking-wider">
                              MEMBER
                            </span>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenPromote(member)}
                              className="h-7 px-2.5 border-slate-800 bg-[#0B1724] hover:bg-teal-950/40 hover:text-teal-300 hover:border-teal-700 text-slate-400 text-xs font-medium rounded-lg"
                            >
                              Make Tech Coordinator
                            </Button>
                          </>
                        )}

                        {/* Edit Button */}
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

              {/* Inline Add Member Row (matches Image 4) */}
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

      {/* Promotion Dialog */}
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
              They will be able to log in with this mobile number via OTP/password, sell passes for anyone in their team, view group reports, and verify gate entries.
            </p>

            {/* Warning if team already has a tech coordinator */}
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

      {/* Demotion Dialog */}
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

      {/* Edit Member Dialog */}
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
