'use client';

import { useState } from 'react';
import Link from 'next/link';
import { 
  Users, 
  Plus, 
  Trash2, 
  Edit3, 
  Ticket, 
  Send, 
  AlertTriangle,
  CheckCircle2,
  Phone,
  Mail,
  Search,
  ArrowRightLeft,
  XCircle,
  FolderKanban
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { formatINR } from '@/lib/constants';
import type { Group, Seat, Profile } from '@/lib/types';
import { 
  createGroup, 
  updateGroup, 
  deleteGroup, 
  assignSeatsToGroup, 
  releaseGroupSeats 
} from './actions';

interface GroupsClientProps {
  groups: Group[];
  seats: Seat[];
  userProfile: Profile;
}

export function GroupsClient({ groups: initialGroups, seats, userProfile }: GroupsClientProps) {
  const [groups, setGroups] = useState(initialGroups);
  const [search, setSearch] = useState('');
  
  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [groupName, setGroupName] = useState('');
  const [leadName, setLeadName] = useState('');
  const [leadPhone, setLeadPhone] = useState('');
  const [leadEmail, setLeadEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Seat Assignment Modal state
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>([]);
  const [seatSearch, setSeatSearch] = useState('');

  // Map seats to group
  const seatsByGroup = new Map<string, Seat[]>();
  for (const s of seats) {
    if (s.group_id) {
      const list = seatsByGroup.get(s.group_id) || [];
      list.push(s);
      seatsByGroup.set(s.group_id, list);
    }
  }

  // Open Create Dialog
  const openCreateDialog = () => {
    setEditingGroup(null);
    setGroupName('');
    setLeadName('');
    setLeadPhone('');
    setLeadEmail('');
    setNotes('');
    setDialogOpen(true);
  };

  // Open Edit Dialog
  const openEditDialog = (group: Group) => {
    setEditingGroup(group);
    setGroupName(group.group_name);
    setLeadName(group.lead_contact_name);
    setLeadPhone(group.lead_contact_phone || '');
    setLeadEmail(group.lead_contact_email || '');
    setNotes(group.notes || '');
    setDialogOpen(true);
  };

  // Save Group
  const handleSaveGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim() || !leadName.trim()) {
      toast.error('Group name and lead contact name are required');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        group_name: groupName.trim(),
        lead_contact_name: leadName.trim(),
        lead_contact_phone: leadPhone.trim(),
        lead_contact_email: leadEmail.trim(),
        notes: notes.trim(),
      };

      if (editingGroup) {
        const res = await updateGroup(editingGroup.id, payload);
        if (res.error) throw new Error(res.error);
        toast.success(`Group "${groupName}" updated`);
      } else {
        const res = await createGroup(payload);
        if (res.error) throw new Error(res.error);
        toast.success(`Group "${groupName}" created`);
      }
      setDialogOpen(false);
      window.location.reload();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save group');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Group
  const handleDeleteGroup = async (group: Group) => {
    if (!confirm(`Are you sure you want to delete group "${group.group_name}"? Assigned seats will be unlinked.`)) {
      return;
    }

    try {
      const res = await deleteGroup(group.id);
      if (res.error) throw new Error(res.error);
      toast.success(`Group "${group.group_name}" deleted`);
      setGroups(g => g.filter(x => x.id !== group.id));
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete group');
    }
  };

  // Release entire group seats as a unit
  const handleReleaseGroupSeats = async (group: Group) => {
    if (!confirm(`Release all seats for group "${group.group_name}" as a single unit? This clears guest information and frees the seats.`)) {
      return;
    }

    try {
      const res = await releaseGroupSeats(group.id);
      if (res.error) throw new Error(res.error);
      toast.success(`All seats for "${group.group_name}" released successfully`);
      window.location.reload();
    } catch (err: any) {
      toast.error(err.message || 'Failed to release group seats');
    }
  };

  // Open Seat Assignment Modal
  const openAssignModal = (group: Group) => {
    setSelectedGroup(group);
    const currentSeats = seats.filter(s => s.group_id === group.id).map(s => s.id);
    setSelectedSeatIds(currentSeats);
    setAssignModalOpen(true);
  };

  // Check adjacency of selected seats
  const checkAdjacency = (selectedIds: string[]): boolean => {
    if (selectedIds.length <= 1) return true;
    const selectedSeatObjs = seats.filter(s => selectedIds.includes(s.id));
    
    // Group by row
    const byRow = new Map<string, number[]>();
    for (const s of selectedSeatObjs) {
      const key = `${s.section}-${s.row_label}`;
      const list = byRow.get(key) || [];
      list.push(s.seat_no);
      byRow.set(key, list);
    }

    // If split across multiple rows, they're not contiguous
    if (byRow.size > 1) return false;

    const seatNos = Array.from(byRow.values())[0].sort((a, b) => a - b);
    for (let i = 1; i < seatNos.length; i++) {
      if (seatNos[i] !== seatNos[i - 1] + 1) return false;
    }
    return true;
  };

  // Save Seat Assignment
  const handleSaveSeatAssignment = async () => {
    if (!selectedGroup) return;
    setIsSubmitting(true);

    try {
      // Soft warning if seats are not adjacent
      const isAdjacent = checkAdjacency(selectedSeatIds);
      if (!isAdjacent && selectedSeatIds.length > 1) {
        toast.warning('Notice: The selected seats are not contiguous/adjacent in the same row.', {
          duration: 5000
        });
      }

      const res = await assignSeatsToGroup(selectedGroup.id, selectedSeatIds);
      if (res.error) throw new Error(res.error);

      toast.success(`Assigned ${selectedSeatIds.length} seats to ${selectedGroup.group_name}`);
      setAssignModalOpen(false);
      window.location.reload();
    } catch (err: any) {
      toast.error(err.message || 'Failed to assign seats');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredGroups = groups.filter(g => 
    g.group_name.toLowerCase().includes(search.toLowerCase()) ||
    g.lead_contact_name.toLowerCase().includes(search.toLowerCase()) ||
    (g.lead_contact_phone && g.lead_contact_phone.includes(search))
  );

  return (
    <div className="space-y-6">
      {/* 1. Header with Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <FolderKanban className="w-6 h-6 text-[#E8913A]" />
            Group & Family Seating
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Manage bulk/family reservations as single units with consolidated lead contact ticketing.
          </p>
        </div>

        <Button 
          onClick={openCreateDialog}
          className="bg-[#E8913A] hover:bg-[#D97706] text-slate-950 font-bold text-xs shadow-md shadow-amber-950/20"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Create New Group
        </Button>
      </div>

      {/* 2. Search & Info Bar */}
      <Card className="bg-[#131F2E] border-[#223345] rounded-2xl p-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search group name or lead contact..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-9 text-xs bg-[#1A2839] border-[#2A3F55] text-white"
            />
          </div>

          <div className="text-xs text-slate-400">
            Total Groups: <strong className="text-white">{groups.length}</strong> • 
            Assigned Seats: <strong className="text-amber-400 mx-1">
              {Array.from(seatsByGroup.values()).reduce((acc, list) => acc + list.length, 0)}
            </strong>
          </div>
        </div>
      </Card>

      {/* 3. Groups Table */}
      <Card className="bg-[#131F2E] border-[#223345] rounded-2xl shadow-xl overflow-hidden">
        <Table>
          <TableHeader className="bg-[#0E1724]">
            <TableRow className="border-[#223345]">
              <TableHead className="text-slate-300 font-semibold">Group / Family Name</TableHead>
              <TableHead className="text-slate-300 font-semibold">Lead Contact Person</TableHead>
              <TableHead className="text-slate-300 font-semibold text-center">Seats Assigned</TableHead>
              <TableHead className="text-slate-300 font-semibold">Seating Coordinates</TableHead>
              <TableHead className="text-slate-300 font-semibold text-center">Admitted Status</TableHead>
              <TableHead className="text-slate-300 font-semibold text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredGroups.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-slate-400">
                  No groups created yet. Click "Create New Group" to get started.
                </TableCell>
              </TableRow>
            ) : (
              filteredGroups.map(group => {
                const groupSeats = seatsByGroup.get(group.id) || [];
                const seatCount = groupSeats.length;
                const checkedInCount = groupSeats.filter(s => s.checked_in).length;
                const rows = [...new Set(groupSeats.map(s => s.row_label))].join(', ');
                const isContiguous = checkAdjacency(groupSeats.map(s => s.id));

                return (
                  <TableRow key={group.id} className="border-[#223345] hover:bg-[#1A2839]/60 transition-colors">
                    <TableCell className="font-bold text-white">
                      <div>{group.group_name}</div>
                      {group.notes && (
                        <span className="text-[10px] text-slate-400 block truncate max-w-xs">{group.notes}</span>
                      )}
                    </TableCell>

                    <TableCell className="text-xs text-slate-300">
                      <div className="font-medium text-white">{group.lead_contact_name}</div>
                      <div className="text-[11px] text-slate-400">
                        {group.lead_contact_phone} {group.lead_contact_email && `• ${group.lead_contact_email}`}
                      </div>
                    </TableCell>

                    <TableCell className="text-center">
                      <div className="inline-flex items-center gap-1">
                        <Badge className="bg-[#1A2839] text-amber-300 border-[#2A3F55] font-mono text-xs">
                          {seatCount} Seats
                        </Badge>
                        {!isContiguous && seatCount > 1 && (
                          <span title="Seats are not contiguous in one row">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                          </span>
                        )}
                      </div>
                    </TableCell>

                    <TableCell className="text-xs font-mono text-slate-300">
                      {seatCount === 0 ? (
                        <span className="text-slate-500 italic">No seats assigned</span>
                      ) : (
                        <div>
                          <span className="text-amber-400 font-bold">{groupSeats[0]?.section}</span>
                          <span className="text-slate-400 ml-1">Row {rows} (#{groupSeats.map(s => s.seat_no).join(', ')})</span>
                        </div>
                      )}
                    </TableCell>

                    <TableCell className="text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-mono font-bold ${
                        checkedInCount === seatCount && seatCount > 0
                          ? 'bg-sky-950 text-sky-300 border border-sky-800'
                          : checkedInCount > 0
                          ? 'bg-amber-950 text-amber-300 border border-amber-800'
                          : 'bg-slate-800 text-slate-400'
                      }`}>
                        {checkedInCount} / {seatCount} Admitted
                      </span>
                    </TableCell>

                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-1">
                        <Button
                          size="xs"
                          variant="outline"
                          className="bg-[#1A2839] border-[#2A3F55] hover:bg-[#223345] text-amber-300 text-xs"
                          onClick={() => openAssignModal(group)}
                          title="Assign / Reassign Seats"
                        >
                          <Users className="w-3 h-3 mr-1" />
                          Assign Seats
                        </Button>

                        {seatCount > 0 && (
                          <Button
                            size="xs"
                            variant="outline"
                            className="bg-[#1A2839] border-red-900/60 hover:bg-red-950/40 text-red-300 text-xs"
                            onClick={() => handleReleaseGroupSeats(group)}
                            title="Release All Group Seats"
                          >
                            <XCircle className="w-3 h-3 mr-1" />
                            Release Unit
                          </Button>
                        )}

                        <Button
                          size="xs"
                          variant="ghost"
                          className="text-slate-400 hover:text-white"
                          onClick={() => openEditDialog(group)}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </Button>

                        <Button
                          size="xs"
                          variant="ghost"
                          className="text-red-400 hover:text-red-300 hover:bg-red-950/40"
                          onClick={() => handleDeleteGroup(group)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {/* 4. Create / Edit Group Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-[#131F2E] border-[#223345] text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-white">
              {editingGroup ? `Edit Group: ${editingGroup.group_name}` : 'Create Group / Family Unit'}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Groups move and release as single units. The lead contact receives the consolidated pass.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveGroup} className="space-y-3 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-300 font-medium">Group / Family Name *</Label>
              <Input
                required
                placeholder="e.g. Ramesh Family / Rotary Club Chennai"
                value={groupName}
                onChange={e => setGroupName(e.target.value)}
                className="bg-[#1A2839] border-[#2A3F55] text-white text-xs h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-300 font-medium">Lead Contact Full Name *</Label>
              <Input
                required
                placeholder="e.g. Ramesh Sundaram"
                value={leadName}
                onChange={e => setLeadName(e.target.value)}
                className="bg-[#1A2839] border-[#2A3F55] text-white text-xs h-9"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300 font-medium">Lead Phone</Label>
                <Input
                  placeholder="e.g. 9876543210"
                  value={leadPhone}
                  onChange={e => setLeadPhone(e.target.value)}
                  className="bg-[#1A2839] border-[#2A3F55] text-white text-xs h-9"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300 font-medium">Lead Email</Label>
                <Input
                  type="email"
                  placeholder="ramesh@example.com"
                  value={leadEmail}
                  onChange={e => setLeadEmail(e.target.value)}
                  className="bg-[#1A2839] border-[#2A3F55] text-white text-xs h-9"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-300 font-medium">Notes</Label>
              <Input
                placeholder="Optional notes regarding seating preferences"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="bg-[#1A2839] border-[#2A3F55] text-white text-xs h-9"
              />
            </div>

            <DialogFooter className="pt-3 border-t border-[#223345]">
              <Button
                type="button"
                variant="ghost"
                className="text-slate-400"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-[#E8913A] hover:bg-[#D97706] text-slate-950 font-bold text-xs"
              >
                {editingGroup ? 'Save Changes' : 'Create Group'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 5. Assign Seats Modal */}
      <Dialog open={assignModalOpen} onOpenChange={setAssignModalOpen}>
        <DialogContent className="bg-[#131F2E] border-[#223345] text-white max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-[#E8913A]" />
              Assign Seats to Group: {selectedGroup?.group_name}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Select seats for this group. Lead contact ({selectedGroup?.lead_contact_name}) will be applied across all seats.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 flex-1 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between gap-3">
              <Input
                placeholder="Filter seats by row or ID (e.g. GF-B or BAL-D)..."
                value={seatSearch}
                onChange={e => setSeatSearch(e.target.value.toUpperCase())}
                className="bg-[#1A2839] border-[#2A3F55] text-white text-xs h-9"
              />
              <Badge className="bg-[#1A2839] text-amber-300 border-[#2A3F55] text-xs font-mono shrink-0">
                Selected: {selectedSeatIds.length} seats
              </Badge>
            </div>

            {/* Seat Selection Grid */}
            <div className="flex-1 overflow-y-auto border border-[#223345] rounded-xl p-3 bg-[#0E1724] space-y-3">
              {['Ground Floor', 'Balcony'].map(section => {
                const sectionSeats = seats.filter(s => {
                  if (s.section !== section) return false;
                  if (seatSearch && !s.id.includes(seatSearch) && !s.row_label.includes(seatSearch)) return false;
                  return true;
                });

                if (sectionSeats.length === 0) return null;

                return (
                  <div key={section} className="space-y-1.5">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                      {section}
                    </span>
                    <div className="grid grid-cols-6 sm:grid-cols-10 gap-1">
                      {sectionSeats.slice(0, 120).map(seat => {
                        const isSelected = selectedSeatIds.includes(seat.id);
                        const isOtherGroup = seat.group_id && seat.group_id !== selectedGroup?.id;

                        return (
                          <button
                            key={seat.id}
                            type="button"
                            onClick={() => {
                              setSelectedSeatIds(prev => 
                                isSelected ? prev.filter(id => id !== seat.id) : [...prev, seat.id]
                              );
                            }}
                            className={`p-1 rounded text-[10px] font-mono font-bold transition-all ${
                              isSelected
                                ? 'bg-[#E8913A] text-slate-950 shadow-md ring-1 ring-amber-300'
                                : isOtherGroup
                                ? 'bg-indigo-950/60 text-indigo-300 border border-indigo-800/40'
                                : 'bg-[#1A2839] text-slate-300 hover:bg-[#223345]'
                            }`}
                            title={`${seat.id} ${seat.guest_name ? `(${seat.guest_name})` : ''}`}
                          >
                            {seat.row_label}-{seat.seat_no}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <DialogFooter className="pt-3 border-t border-[#223345]">
            <Button
              type="button"
              variant="ghost"
              className="text-slate-400"
              onClick={() => setAssignModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSaveSeatAssignment}
              disabled={isSubmitting}
              className="bg-[#E8913A] hover:bg-[#D97706] text-slate-950 font-bold text-xs"
            >
              Assign Selected Seats ({selectedSeatIds.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
