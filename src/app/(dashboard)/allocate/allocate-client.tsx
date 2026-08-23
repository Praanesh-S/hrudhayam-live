"use client";

import { useState } from "react";
import { Profile, AccessRequest, VenueRow, TeamMemberStats, SeatSection, AppRole } from "@/lib/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { allocateRows, releaseSeats, approveRequest, rejectRequest, inviteUser } from "./actions";
import { formatINR } from "@/lib/constants";
import { getRowsInRange } from "@/lib/seat-utils";
import { Users, UserPlus, AlertTriangle, CheckCircle2, XCircle, Clock, Trash2, ArrowRight, Shield, RefreshCw } from "lucide-react";

export function AllocateClient({ 
  subAdmins, 
  requests, 
  venueRows,
  rowOwners = {},
  currentAllocations 
}: { 
  subAdmins: Profile[], 
  requests: AccessRequest[], 
  venueRows: VenueRow[],
  rowOwners?: Record<string, { ownerId: string; ownerName: string; count: number }[]>,
  currentAllocations: TeamMemberStats[]
}) {
  const [loading, setLoading] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState("");
  const [selectedSection, setSelectedSection] = useState<SeatSection>("Ground Floor");
  const [fromRow, setFromRow] = useState("");
  const [toRow, setToRow] = useState("");
  
  // Conflict confirmation modal state
  const [conflictModalOpen, setConflictModalOpen] = useState(false);
  const [pendingConflictData, setPendingConflictData] = useState<{
    adminId: string;
    adminName: string;
    section: SeatSection;
    rows: string[];
    conflictText: string;
  } | null>(null);

  // Release confirmation state
  const [releaseModalOpen, setReleaseModalOpen] = useState(false);
  const [pendingReleaseData, setPendingReleaseData] = useState<{
    userId: string;
    userName: string;
    rows: string[];
  } | null>(null);

  // Invite user state
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [invitePhone, setInvitePhone] = useState("");
  const [inviteRole, setInviteRole] = useState<AppRole>("sub_admin");
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);

  const sectionRows = venueRows.filter(r => r.section === selectedSection);
  
  // Compute selected rows range and check for conflicts
  const selectedRowsRange = (fromRow && toRow) ? getRowsInRange(selectedSection, fromRow, toRow) : [];
  
  const detectedConflicts: { rowLabel: string; owners: string[] }[] = [];
  for (const rLabel of selectedRowsRange) {
    const key = `${selectedSection}:${rLabel}`;
    const owners = rowOwners[key] || [];
    // Filter owners other than the currently selected admin
    const otherOwners = owners.filter(o => o.ownerId !== selectedAdmin);
    if (otherOwners.length > 0) {
      detectedConflicts.push({
        rowLabel: rLabel,
        owners: otherOwners.map(o => `${o.ownerName} (${o.count} seats)`)
      });
    }
  }

  const handleAllocateClick = async () => {
    if (!selectedAdmin || !selectedSection || !fromRow || !toRow) return;
    
    const targetAdmin = subAdmins.find(a => a.id === selectedAdmin);
    const adminName = targetAdmin?.full_name || "Selected Member";

    if (detectedConflicts.length > 0) {
      const conflictSummary = detectedConflicts
        .map(c => `Row ${c.rowLabel}: currently owned by ${c.owners.join(", ")}`)
        .join("\n");

      setPendingConflictData({
        adminId: selectedAdmin,
        adminName,
        section: selectedSection,
        rows: selectedRowsRange,
        conflictText: conflictSummary
      });
      setConflictModalOpen(true);
      return;
    }

    executeAllocation(selectedAdmin, selectedSection, selectedRowsRange, false);
  };

  const executeAllocation = async (adminId: string, section: SeatSection, rows: string[], force: boolean) => {
    setLoading(true);
    const res = await allocateRows(adminId, section, rows, force);
    
    if (res.error) {
      if ((res as any).isConflict) {
        toast.error((res as any).error);
      } else {
        toast.error(res.error);
      }
    } else {
      toast.success(`Successfully allocated ${res.allocated} seats.`);
      setConflictModalOpen(false);
      setPendingConflictData(null);
      window.location.reload();
    }
    setLoading(false);
  };

  const handleReleaseClick = (userId: string, rows: string[]) => {
    const targetAdmin = subAdmins.find(a => a.id === userId);
    setPendingReleaseData({
      userId,
      userName: targetAdmin?.full_name || "Team Member",
      rows
    });
    setReleaseModalOpen(true);
  };

  const executeRelease = async (force: boolean) => {
    if (!pendingReleaseData) return;
    setLoading(true);
    const res = await releaseSeats(pendingReleaseData.userId, pendingReleaseData.rows, force);
    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success("Seats released successfully");
      setReleaseModalOpen(false);
      setPendingReleaseData(null);
      window.location.reload();
    }
    setLoading(false);
  };

  const handleApprove = async (req: AccessRequest) => {
    setLoading(true);
    const res = await approveRequest(req.id);
    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success("Request approved");
      window.location.reload();
    }
    setLoading(false);
  };

  const handleReject = async (req: AccessRequest) => {
    const notes = prompt("Reason for rejection?");
    if (notes === null) return;
    setLoading(true);
    const res = await rejectRequest(req.id, notes);
    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success("Request rejected");
      window.location.reload();
    }
    setLoading(false);
  };

  const handleInvite = async () => {
    setLoading(true);
    const res = await inviteUser(inviteEmail, inviteName, inviteRole, invitePhone);
    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success("User invited successfully");
      setInviteDialogOpen(false);
      window.location.reload();
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#131F2E] p-5 rounded-2xl border border-[#223345] shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            Team Row Allocations & Access
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Assign venue rows to team members with strict conflict protection. Once allocated, rows are secured.
          </p>
        </div>

        <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
          <DialogTrigger render={
            <Button className="bg-[#E8913A] hover:bg-[#D97706] text-slate-950 font-bold text-xs gap-1.5 shadow-md shadow-amber-950/20">
              <UserPlus className="w-4 h-4" />
              <span>Invite Team Member</span>
            </Button>
          } />
          <DialogContent className="sm:max-w-md bg-[#131F2E] rounded-2xl border border-[#223345] text-white shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-white">Invite Team Member</DialogTitle>
            </DialogHeader>
            <div className="space-y-3.5 py-3">
              <div className="space-y-1">
                <Label className="text-xs font-medium text-slate-300">Full Name</Label>
                <Input placeholder="John Doe" value={inviteName} onChange={e => setInviteName(e.target.value)} className="h-9 text-xs bg-[#1A2839] border-[#2A3F55] text-white" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium text-slate-300">Email Address</Label>
                <Input type="email" placeholder="name@example.com" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} className="h-9 text-xs bg-[#1A2839] border-[#2A3F55] text-white" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium text-slate-300">Phone Number (Optional)</Label>
                <Input placeholder="10-digit mobile number" value={invitePhone} onChange={e => setInvitePhone(e.target.value)} className="h-9 text-xs bg-[#1A2839] border-[#2A3F55] text-white" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium text-slate-300">Role</Label>
                <Select value={inviteRole} onValueChange={(v) => { if (v) setInviteRole(v as AppRole); }}>
                  <SelectTrigger className="h-9 text-xs bg-[#1A2839] border-[#2A3F55] text-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-[#131F2E] border-[#223345] text-white">
                    <SelectItem value="sub_admin">Sub-Admin (Team Member)</SelectItem>
                    <SelectItem value="super_admin">Super Admin (Full Access)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full h-10 bg-[#E8913A] hover:bg-[#D97706] text-slate-950 font-bold text-xs mt-2" onClick={handleInvite} disabled={loading || !inviteName || !inviteEmail}>
                Send Member Invitation
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="allocate" className="space-y-4">
        <TabsList className="bg-[#131F2E] border border-[#223345] p-1 rounded-xl">
          <TabsTrigger value="allocate" className="text-xs font-semibold text-slate-300 data-[state=active]:bg-[#1A2839] data-[state=active]:text-white">
            Assign Rows
          </TabsTrigger>
          <TabsTrigger value="status" className="text-xs font-semibold text-slate-300 data-[state=active]:bg-[#1A2839] data-[state=active]:text-white">
            Row Inventory Status
          </TabsTrigger>
          <TabsTrigger value="requests" className="text-xs font-semibold text-slate-300 data-[state=active]:bg-[#1A2839] data-[state=active]:text-white">
            Pending Requests ({requests.length})
          </TabsTrigger>
          <TabsTrigger value="current" className="text-xs font-semibold text-slate-300 data-[state=active]:bg-[#1A2839] data-[state=active]:text-white">
            Current Allocations
          </TabsTrigger>
        </TabsList>
        
        {/* Tab 1: Assign Rows */}
        <TabsContent value="allocate">
          <Card className="bg-[#131F2E] border-[#223345] rounded-2xl shadow-xs overflow-hidden">
            <CardHeader className="bg-[#0E1724] pb-3 border-b border-[#223345]">
              <CardTitle className="text-base font-bold text-white flex items-center justify-between">
                <span>Allocate Row Range to Team Member</span>
                <Badge variant="outline" className="text-xs text-amber-400 border-amber-500/30 bg-amber-500/10">
                  Conflict-Protected
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs text-slate-400">
                Select a sub-admin and assign an inclusive row range. Overlapping rows will prompt for explicit transfer confirmation.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-300">Team Member</Label>
                  <Select value={selectedAdmin} onValueChange={(v) => { if (v) setSelectedAdmin(v); }}>
                    <SelectTrigger className="h-9 text-xs bg-[#1A2839] border-[#2A3F55] text-white">
                      <SelectValue placeholder="Select team member" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#131F2E] border-[#223345] text-white">
                      {subAdmins.map(admin => (
                        <SelectItem key={admin.id} value={admin.id}>{admin.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-300">Section</Label>
                  <Select value={selectedSection} onValueChange={(v) => { if (v) setSelectedSection(v as SeatSection); }}>
                    <SelectTrigger className="h-9 text-xs bg-[#1A2839] border-[#2A3F55] text-white"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-[#131F2E] border-[#223345] text-white">
                      <SelectItem value="Ground Floor">Ground Floor</SelectItem>
                      <SelectItem value="Balcony">Balcony</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-300">From Row</Label>
                  <Select value={fromRow} onValueChange={(v) => { if (v) setFromRow(v); }}>
                    <SelectTrigger className="h-9 text-xs bg-[#1A2839] border-[#2A3F55] text-white"><SelectValue placeholder="Start row" /></SelectTrigger>
                    <SelectContent className="bg-[#131F2E] border-[#223345] text-white">
                      {sectionRows.map(r => {
                        const owners = rowOwners[`${selectedSection}:${r.row_label}`] || [];
                        const isTaken = owners.length > 0;
                        return (
                          <SelectItem key={r.id} value={r.row_label}>
                            Row {r.row_label} ({r.seat_count}s) {isTaken ? `• ${owners.map(o => o.ownerName).join(", ")}` : "• Free"}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-300">To Row</Label>
                  <Select value={toRow} onValueChange={(v) => { if (v) setToRow(v); }}>
                    <SelectTrigger className="h-9 text-xs bg-[#1A2839] border-[#2A3F55] text-white"><SelectValue placeholder="End row" /></SelectTrigger>
                    <SelectContent className="bg-[#131F2E] border-[#223345] text-white">
                      {sectionRows.map(r => {
                        const owners = rowOwners[`${selectedSection}:${r.row_label}`] || [];
                        const isTaken = owners.length > 0;
                        return (
                          <SelectItem key={r.id} value={r.row_label}>
                            Row {r.row_label} ({r.seat_count}s) {isTaken ? `• ${owners.map(o => o.ownerName).join(", ")}` : "• Free"}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Conflict Warning Preview */}
              {detectedConflicts.length > 0 && (
                <div className="p-4 bg-amber-950/40 border border-amber-600/50 rounded-xl flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-xs space-y-1">
                    <p className="font-bold text-amber-300">
                      Row Ownership Conflict Detected ({detectedConflicts.length} row(s) already assigned)
                    </p>
                    <ul className="list-disc list-inside text-amber-200/80 space-y-0.5">
                      {detectedConflicts.map(c => (
                        <li key={c.rowLabel}>
                          Row {c.rowLabel} is currently assigned to: {c.owners.join(", ")}
                        </li>
                      ))}
                    </ul>
                    <p className="text-slate-400 text-[11px] pt-1">
                      Proceeding will prompt for a Super Admin override to transfer ownership from the existing members.
                    </p>
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-2 border-t border-[#223345]">
                <Button 
                  className="bg-[#E8913A] hover:bg-[#D97706] text-slate-950 font-bold text-xs px-6 h-9 shadow-md shadow-amber-950/20" 
                  onClick={handleAllocateClick} 
                  disabled={loading || !selectedAdmin || !fromRow || !toRow}
                >
                  {detectedConflicts.length > 0 ? "Review & Allocate Overrides" : "Allocate Selected Rows"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Row Inventory Status */}
        <TabsContent value="status">
          <Card className="bg-[#131F2E] border-[#223345] rounded-2xl shadow-xs overflow-hidden">
            <CardHeader className="bg-[#0E1724] pb-3 border-b border-[#223345]">
              <CardTitle className="text-base font-bold text-white">
                Venue Row Availability & Assignment Map
              </CardTitle>
              <CardDescription className="text-xs text-slate-400">
                Complete overview of which rows are currently free vs assigned across the Ground Floor and Balcony.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-[#0E1724] border-b border-[#223345]">
                  <TableRow className="text-slate-400 text-xs">
                    <TableHead className="text-slate-300">Section</TableHead>
                    <TableHead className="text-slate-300">Row Label</TableHead>
                    <TableHead className="text-slate-300">Seats</TableHead>
                    <TableHead className="text-slate-300">Tier</TableHead>
                    <TableHead className="text-slate-300">Lock Status</TableHead>
                    <TableHead className="text-slate-300">Assigned Team Member(s)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {venueRows.map(row => {
                    const key = `${row.section}:${row.row_label}`;
                    const owners = rowOwners[key] || [];
                    const isAssigned = owners.length > 0;

                    return (
                      <TableRow key={row.id} className="border-b border-[#1E2D3D] hover:bg-[#1A2839]/60">
                        <TableCell className="text-xs font-semibold text-slate-300">{row.section}</TableCell>
                        <TableCell className="font-mono font-bold text-amber-400 text-xs">{row.row_label}</TableCell>
                        <TableCell className="font-mono text-xs text-slate-400">{row.seat_count}</TableCell>
                        <TableCell className="font-mono text-xs text-slate-300">
                          {row.tier ? `₹${row.tier.toLocaleString()}` : "Default"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-[10px] ${
                            row.lock_status === 'Locked' 
                              ? 'border-red-800 text-red-300 bg-red-950/40' 
                              : 'border-emerald-800 text-emerald-300 bg-emerald-950/40'
                          }`}>
                            {row.lock_status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {isAssigned ? (
                            <div className="flex flex-wrap gap-1">
                              {owners.map(o => (
                                <Badge key={o.ownerId} variant="secondary" className="text-[11px] bg-[#1A2839] text-white border border-[#2A3F55]">
                                  {o.ownerName} ({o.count} seats)
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-emerald-400 font-medium">✓ Unassigned (Available)</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Pending Requests */}
        <TabsContent value="requests">
          <Card className="bg-[#131F2E] border-[#223345] rounded-2xl shadow-xs overflow-hidden">
            <CardHeader className="bg-[#0E1724] pb-3 border-b border-[#223345]">
              <CardTitle className="text-base font-bold text-white">
                Access & Row Requests
              </CardTitle>
              <CardDescription className="text-xs text-slate-400">
                Review onboarding requests from volunteers and team members.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {requests.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs">
                  No pending access requests.
                </div>
              ) : (
                <Table>
                  <TableHeader className="bg-[#0E1724] border-b border-[#223345]">
                    <TableRow className="text-slate-400 text-xs">
                      <TableHead className="text-slate-300">User Name</TableHead>
                      <TableHead className="text-slate-300">Email</TableHead>
                      <TableHead className="text-slate-300">Requested Role</TableHead>
                      <TableHead className="text-slate-300">Notes</TableHead>
                      <TableHead className="text-right pr-6 text-slate-300">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requests.map(req => (
                      <TableRow key={req.id} className="border-b border-[#1E2D3D] hover:bg-[#1A2839]/60">
                        <TableCell className="font-semibold text-xs text-white">
                          {req.profile?.full_name || "Unknown"}
                        </TableCell>
                        <TableCell className="text-xs text-slate-400">
                          {req.profile?.email || "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs capitalize text-slate-300 border-slate-700">
                            {req.requested_role?.replace("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-slate-400">
                          {req.notes || "-"}
                        </TableCell>
                        <TableCell className="text-right pr-6">
                          <div className="flex items-center justify-end gap-2">
                            <Button size="xs" variant="default" className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px]" onClick={() => handleApprove(req)} disabled={loading}>
                              Approve
                            </Button>
                            <Button size="xs" variant="outline" className="text-red-400 border-red-900/60 bg-red-950/30 hover:bg-red-900/50 text-[11px]" onClick={() => handleReject(req)} disabled={loading}>
                              Reject
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 4: Current Allocations */}
        <TabsContent value="current">
          <Card className="bg-[#131F2E] border-[#223345] rounded-2xl shadow-xs overflow-hidden">
            <CardHeader className="bg-[#0E1724] pb-3 border-b border-[#223345]">
              <CardTitle className="text-base font-bold text-white">
                Team Member Seat Holdings
              </CardTitle>
              <CardDescription className="text-xs text-slate-400">
                Current breakdown of seats, fills, and revenue per assigned member.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {currentAllocations.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs">
                  No row allocations made yet.
                </div>
              ) : (
                <Table>
                  <TableHeader className="bg-[#0E1724] border-b border-[#223345]">
                    <TableRow className="text-slate-400 text-xs">
                      <TableHead className="text-slate-300">Member</TableHead>
                      <TableHead className="text-slate-300">Assigned Rows</TableHead>
                      <TableHead className="text-slate-300">Seats Held</TableHead>
                      <TableHead className="text-slate-300">Filled</TableHead>
                      <TableHead className="text-slate-300">Paid</TableHead>
                      <TableHead className="text-slate-300">Total Value</TableHead>
                      <TableHead className="text-slate-300">Received</TableHead>
                      <TableHead className="text-right pr-6 text-slate-300">Release</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentAllocations.map(alloc => (
                      <TableRow key={alloc.userId} className="border-b border-[#1E2D3D] hover:bg-[#1A2839]/60">
                        <TableCell className="font-semibold text-xs text-white">
                          {alloc.name}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            {alloc.rows.map(r => (
                              <Badge key={r} variant="secondary" className="text-[10px] font-mono bg-[#1A2839] text-amber-400 border border-[#2A3F55]">
                                {r}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs font-semibold text-white">{alloc.seatsHeld}</TableCell>
                        <TableCell className="font-mono text-xs text-slate-300">{alloc.seatsFilled}</TableCell>
                        <TableCell className="font-mono text-xs text-emerald-400 font-bold">{alloc.seatsPaid}</TableCell>
                        <TableCell className="font-mono text-xs text-slate-300">{formatINR(alloc.value)}</TableCell>
                        <TableCell className="font-mono text-xs font-bold text-emerald-400">{formatINR(alloc.received)}</TableCell>
                        <TableCell className="text-right pr-6">
                          <Button size="xs" variant="ghost" className="text-red-400 hover:bg-red-950/40 hover:text-red-300 text-xs" onClick={() => handleReleaseClick(alloc.userId, alloc.rows)} disabled={loading}>
                            <Trash2 className="w-3.5 h-3.5 mr-1" /> Release
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Conflict Override Confirmation Dialog */}
      <Dialog open={conflictModalOpen} onOpenChange={setConflictModalOpen}>
        <DialogContent className="sm:max-w-lg bg-[#131F2E] rounded-2xl border border-[#223345] text-white shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-amber-400 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              Super Admin Override: Reassign Rows?
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              The selected row range contains seats currently allocated to other team members.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="p-3.5 bg-[#1A2839] rounded-xl border border-[#2A3F55] text-xs space-y-2">
              <p className="font-semibold text-slate-200">
                Target Recipient: <span className="text-white font-bold">{pendingConflictData?.adminName}</span>
              </p>
              <div className="space-y-1">
                <p className="text-slate-400 font-medium">Conflicting Allocations:</p>
                <div className="font-mono text-[11px] text-amber-300 whitespace-pre-line bg-[#0E1724] p-2.5 rounded-lg border border-[#223345]">
                  {pendingConflictData?.conflictText}
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-300">
              Are you sure you want to transfer ownership of these rows to <span className="text-amber-400 font-bold">{pendingConflictData?.adminName}</span>?
            </p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" className="bg-[#1A2839] border-[#2A3F55] text-slate-300" onClick={() => setConflictModalOpen(false)}>
              Cancel
            </Button>
            <Button 
              className="bg-[#E8913A] hover:bg-[#D97706] text-slate-950 font-bold" 
              onClick={() => {
                if (pendingConflictData) {
                  executeAllocation(
                    pendingConflictData.adminId,
                    pendingConflictData.section,
                    pendingConflictData.rows,
                    true
                  );
                }
              }}
              disabled={loading}
            >
              Confirm Transfer & Allocate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Release Confirmation Dialog */}
      <Dialog open={releaseModalOpen} onOpenChange={setReleaseModalOpen}>
        <DialogContent className="sm:max-w-md bg-[#131F2E] rounded-2xl border border-[#223345] text-white shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-400" />
              Release Rows from {pendingReleaseData?.userName}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              This will free row(s) {pendingReleaseData?.rows.join(", ")} back to the unallocated pool.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 text-xs text-slate-300 space-y-2">
            <p>
              If guests have already been assigned to these seats, releasing will clear their pass allocations and return the seats to available inventory.
            </p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" className="bg-[#1A2839] border-[#2A3F55] text-slate-300" onClick={() => setReleaseModalOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive"
              className="bg-red-600 hover:bg-red-700 text-white font-bold" 
              onClick={() => executeRelease(true)}
              disabled={loading}
            >
              Release Rows & Free Seats
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
