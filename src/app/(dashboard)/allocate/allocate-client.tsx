"use client";

import { useState } from "react";
import { Profile, AccessRequest, VenueRow, TeamMemberStats, SeatSection, AppRole } from "@/lib/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { allocateRows, releaseSeats, approveRequest, rejectRequest, inviteUser } from "./actions";
import { formatINR } from "@/lib/constants";
import { getRowsInRange } from "@/lib/seat-utils";
import { Users, UserPlus, CheckCircle2, XCircle, Clock, Trash2, ArrowRight, Shield } from "lucide-react";

export function AllocateClient({ 
  subAdmins, 
  requests, 
  venueRows,
  currentAllocations 
}: { 
  subAdmins: Profile[], 
  requests: AccessRequest[], 
  venueRows: VenueRow[],
  currentAllocations: TeamMemberStats[]
}) {
  const [loading, setLoading] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState("");
  const [selectedSection, setSelectedSection] = useState<SeatSection>("Ground Floor");
  const [fromRow, setFromRow] = useState("");
  const [toRow, setToRow] = useState("");
  
  // Invite user state
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [invitePhone, setInvitePhone] = useState("");
  const [inviteRole, setInviteRole] = useState<AppRole>("sub_admin");
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);

  const sectionRows = venueRows.filter(r => r.section === selectedSection);
  
  const handleAllocate = async () => {
    if (!selectedAdmin || !selectedSection || !fromRow || !toRow) return;
    
    setLoading(true);
    const rowsToAllocate = getRowsInRange(selectedSection, fromRow, toRow);
    const res = await allocateRows(selectedAdmin, selectedSection, rowsToAllocate);
    
    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success(`Allocated ${res.allocated} seats successfully.`);
      window.location.reload();
    }
    setLoading(false);
  };

  const handleRelease = async (userId: string, rows: string[], force: boolean = false) => {
    setLoading(true);
    const res = await releaseSeats(userId, rows, force);
    if (res.error) {
      if (res.error.includes("guests assigned") && !force) {
        if (confirm("There are guests assigned to these seats. Do you want to force release them?")) {
          await handleRelease(userId, rows, true);
        }
      } else {
        toast.error(res.error);
      }
    } else {
      toast.success("Seats released");
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#131F2E] p-5 rounded-2xl border border-[#223345] shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            Team Row Allocations & Access
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Assign venue rows to team members, review pending requests, and manage block ownership.
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

      <Tabs defaultValue="allocate" className="space-y-4">
        <TabsList className="bg-[#131F2E] border border-[#223345] p-1 rounded-xl">
          <TabsTrigger value="allocate" className="text-xs font-semibold text-slate-300 data-[state=active]:bg-[#1A2839] data-[state=active]:text-white">
            Assign Rows
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
              <CardTitle className="text-base font-bold text-white">
                Allocate Row Range to Team Member
              </CardTitle>
              <CardDescription className="text-xs text-slate-400">
                Select a sub-admin and assign an inclusive row range (e.g. Ground Floor Rows A–D).
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
                      {sectionRows.map(r => (
                        <SelectItem key={r.id} value={r.row_label}>Row {r.row_label} ({r.seat_count} seats)</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-300">To Row</Label>
                  <Select value={toRow} onValueChange={(v) => { if (v) setToRow(v); }}>
                    <SelectTrigger className="h-9 text-xs bg-[#1A2839] border-[#2A3F55] text-white"><SelectValue placeholder="End row" /></SelectTrigger>
                    <SelectContent className="bg-[#131F2E] border-[#223345] text-white">
                      {sectionRows.map(r => (
                        <SelectItem key={r.id} value={r.row_label}>Row {r.row_label} ({r.seat_count} seats)</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end pt-2 border-t border-[#223345]">
                <Button 
                  className="bg-[#E8913A] hover:bg-[#D97706] text-slate-950 font-bold text-xs px-6 h-9 shadow-md shadow-amber-950/20" 
                  onClick={handleAllocate} 
                  disabled={loading || !selectedAdmin || !fromRow || !toRow}
                >
                  Allocate Selected Rows
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Pending Requests */}
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

        {/* Tab 3: Current Allocations */}
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
                          <Button size="xs" variant="ghost" className="text-red-400 hover:bg-red-950/40 hover:text-red-300 text-xs" onClick={() => handleRelease(alloc.userId, alloc.rows)} disabled={loading}>
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
    </div>
  );
}
