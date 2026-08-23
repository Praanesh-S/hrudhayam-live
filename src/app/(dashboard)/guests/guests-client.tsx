'use client';

import { useState, useTransition, useMemo } from 'react';
import { 
  issuePass, 
  revokePass, 
  updateGuest, 
  togglePayment, 
  sendTicket 
} from './actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card } from '@/components/ui/card';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter, 
  DialogDescription 
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Loader2, 
  Download, 
  Send, 
  CheckCircle2, 
  Search, 
  Ticket, 
  PlusCircle, 
  Trash2, 
  Edit, 
  Users, 
  User, 
  Phone, 
  Mail, 
  AlertTriangle,
  QrCode,
  Sparkles
} from 'lucide-react';
import { toast } from 'sonner';
import { formatINR } from '@/lib/constants';

export type Seat = {
  id: string;
  section: string;
  row_label: string;
  seat_no: number;
  tier: number | null;
  owner_id: string | null;
  guest_name: string | null;
  guest_email: string | null;
  guest_phone: string | null;
  pass_code?: string | null;
  qr_token?: string | null;
  ticket_sent: boolean;
  ticket_sent_at?: string | null;
  payment_status: 'pending' | 'received';
  checked_in?: boolean;
  checked_in_at?: string | null;
};

interface GroupedPass {
  passCode: string;
  guestName: string;
  guestEmail: string | null;
  guestPhone: string | null;
  section: string;
  rows: string[];
  seatNumbers: string;
  seatIds: string[];
  totalSeats: number;
  tier: number | null;
  totalValue: number;
  paymentStatus: 'pending' | 'received';
  ticketSent: boolean;
  checkedIn: boolean;
  ownerId: string | null;
  ownerName: string;
}

export function GuestsClient({ 
  initialSeats, 
  userRole, 
  userId,
  ownerMap = {},
  subAdmins = []
}: { 
  initialSeats: Seat[]; 
  userRole: string; 
  userId: string;
  ownerMap?: Record<string, string>;
  subAdmins?: { id: string; full_name: string; email: string }[];
}) {
  const [seats, setSeats] = useState<Seat[]>(initialSeats);
  const [isPending, startTransition] = useTransition();

  // Active Tab
  const [activeTab, setActiveTab] = useState<'issued' | 'inventory'>('issued');

  // Filters for Issued Passes
  const [search, setSearch] = useState('');
  const [sectionFilter, setSectionFilter] = useState<'All' | 'Ground Floor' | 'Balcony'>('All');
  const [paymentFilter, setPaymentFilter] = useState<'All' | 'pending' | 'received'>('All');
  const [passTypeFilter, setPassTypeFilter] = useState<'All' | 'Single' | 'Group'>('All');

  // Filters for Available Inventory
  const [invSearch, setInvSearch] = useState('');
  const [invSection, setInvSection] = useState<'All' | 'Ground Floor' | 'Balcony'>('All');
  const [invTier, setInvTier] = useState<string>('All');
  const [selectedInvSeats, setSelectedInvSeats] = useState<Set<string>>(new Set());

  // Unified Issue Pass Wizard Modal State
  const [wizardOpen, setWizardOpen] = useState(false);
  const [passMode, setPassMode] = useState<'single' | 'group'>('single');
  const [wizardSection, setWizardSection] = useState<'Ground Floor' | 'Balcony'>('Ground Floor');
  const [wizardTier, setWizardTier] = useState<string>('All');
  const [wizardSelectedSeats, setWizardSelectedSeats] = useState<string[]>([]);
  const [wizardSingleSeat, setWizardSingleSeat] = useState<string>('');
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'received'>('pending');

  // Edit Pass Modal State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingPass, setEditingPass] = useState<GroupedPass | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editPayment, setEditPayment] = useState<'pending' | 'received'>('pending');

  // Revoke Modal State
  const [revokeModalOpen, setRevokeModalOpen] = useState(false);
  const [revokingPass, setRevokingPass] = useState<GroupedPass | null>(null);

  // PDF Generation loading tracking
  const [generatingPdfPassCode, setGeneratingPdfPassCode] = useState<string | null>(null);

  // Derive Available vs Allocated Seats
  const availableSeats = useMemo(() => {
    return seats.filter(s => !s.guest_name || s.guest_name.trim() === '');
  }, [seats]);

  const allocatedSeats = useMemo(() => {
    return seats.filter(s => s.guest_name && s.guest_name.trim() !== '');
  }, [seats]);

  // Group allocated seats by pass_code (or seat ID if no pass_code)
  const groupedPasses = useMemo<GroupedPass[]>(() => {
    const map = new Map<string, Seat[]>();

    for (const s of allocatedSeats) {
      const code = s.pass_code || s.id;
      if (!map.has(code)) map.set(code, []);
      map.get(code)!.push(s);
    }

    const result: GroupedPass[] = [];

    for (const [code, group] of map.entries()) {
      const first = group[0];
      const rows = Array.from(new Set(group.map(g => g.row_label)));
      const seatNumbers = group.map(g => g.seat_no).sort((a, b) => a - b).join(', ');
      const totalValue = group.reduce((sum, g) => sum + (g.tier || 0), 0);
      const isPaid = group.every(g => g.payment_status === 'received');
      const isTicketSent = group.some(g => g.ticket_sent);
      const isCheckedIn = group.some(g => g.checked_in);
      const ownerName = first.owner_id ? (ownerMap[first.owner_id] || 'Team Member') : 'Unassigned';

      result.push({
        passCode: code,
        guestName: first.guest_name || 'Anonymous',
        guestEmail: first.guest_email,
        guestPhone: first.guest_phone,
        section: first.section,
        rows,
        seatNumbers,
        seatIds: group.map(g => g.id),
        totalSeats: group.length,
        tier: first.tier,
        totalValue,
        paymentStatus: isPaid ? 'received' : 'pending',
        ticketSent: isTicketSent,
        checkedIn: isCheckedIn,
        ownerId: first.owner_id,
        ownerName
      });
    }

    return result;
  }, [allocatedSeats, ownerMap]);

  // Overall Stats
  const totalRevenue = useMemo(() => {
    return allocatedSeats.reduce((acc, s) => acc + (s.tier || 0), 0);
  }, [allocatedSeats]);

  const paidRevenue = useMemo(() => {
    return allocatedSeats
      .filter(s => s.payment_status === 'received')
      .reduce((acc, s) => acc + (s.tier || 0), 0);
  }, [allocatedSeats]);

  // Filtered Issued Passes
  const filteredPasses = useMemo(() => {
    return groupedPasses.filter(p => {
      const q = search.toLowerCase();
      const matchesSearch = 
        p.guestName.toLowerCase().includes(q) ||
        (p.guestEmail || '').toLowerCase().includes(q) ||
        (p.guestPhone || '').includes(q) ||
        p.passCode.toLowerCase().includes(q) ||
        p.seatIds.some(id => id.toLowerCase().includes(q));

      const matchesSection = sectionFilter === 'All' || p.section === sectionFilter;
      const matchesPayment = paymentFilter === 'All' || p.paymentStatus === paymentFilter;
      const matchesType = passTypeFilter === 'All' || 
        (passTypeFilter === 'Single' && p.totalSeats === 1) ||
        (passTypeFilter === 'Group' && p.totalSeats > 1);

      return matchesSearch && matchesSection && matchesPayment && matchesType;
    });
  }, [groupedPasses, search, sectionFilter, paymentFilter, passTypeFilter]);

  // Filtered Available Inventory
  const filteredAvailableSeats = useMemo(() => {
    return availableSeats.filter(s => {
      const q = invSearch.toLowerCase();
      const matchesSearch = s.id.toLowerCase().includes(q) || s.row_label.toLowerCase().includes(q);
      const matchesSection = invSection === 'All' || s.section === invSection;
      const matchesTier = invTier === 'All' || String(s.tier) === invTier;
      return matchesSearch && matchesSection && matchesTier;
    });
  }, [availableSeats, invSearch, invSection, invTier]);

  // Available seats matching the Wizard modal filters
  const wizardFilteredAvailableSeats = useMemo(() => {
    return availableSeats.filter(s => {
      const matchesSection = s.section === wizardSection;
      const matchesTier = wizardTier === 'All' || String(s.tier) === wizardTier;
      return matchesSection && matchesTier;
    });
  }, [availableSeats, wizardSection, wizardTier]);

  // Open Issue Pass Wizard
  const openIssuePassWizard = (preselectedSeatIds: string[] = []) => {
    if (preselectedSeatIds.length === 1) {
      setPassMode('single');
      setWizardSingleSeat(preselectedSeatIds[0]);
      setWizardSelectedSeats([]);
      const s = seats.find(seat => seat.id === preselectedSeatIds[0]);
      if (s) {
        setWizardSection(s.section as any);
        setWizardTier(s.tier ? String(s.tier) : 'All');
      }
    } else if (preselectedSeatIds.length > 1) {
      setPassMode('group');
      setWizardSelectedSeats(preselectedSeatIds);
      setWizardSingleSeat('');
      const s = seats.find(seat => seat.id === preselectedSeatIds[0]);
      if (s) {
        setWizardSection(s.section as any);
        setWizardTier(s.tier ? String(s.tier) : 'All');
      }
    } else {
      setPassMode('single');
      setWizardSingleSeat('');
      setWizardSelectedSeats([]);
    }
    setGuestName('');
    setGuestEmail('');
    setGuestPhone('');
    setPaymentStatus('pending');
    setWizardOpen(true);
  };

  // Submit Issue Pass
  const handleIssuePass = async (action: 'issue' | 'download_pdf' | 'send_email') => {
    const targetSeatIds = passMode === 'single' 
      ? (wizardSingleSeat ? [wizardSingleSeat] : []) 
      : wizardSelectedSeats;

    if (targetSeatIds.length === 0) {
      toast.error("Please select at least one available seat.");
      return;
    }

    if (!guestName || guestName.trim() === '') {
      toast.error("Guest name is required.");
      return;
    }

    if (action === 'send_email' && (!guestEmail || guestEmail.trim() === '')) {
      toast.error("An email address is required to send e-tickets.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await issuePass({
          seatIds: targetSeatIds,
          guest_name: guestName.trim(),
          guest_email: guestEmail.trim() || undefined,
          guest_phone: guestPhone.trim() || undefined,
          payment_status: paymentStatus,
          send_email: action === 'send_email'
        });

        toast.success(`Pass ${res.passCode} issued for ${res.count} seat(s)!`);
        setWizardOpen(false);

        // Optimistically update seats
        setSeats(prev => prev.map(s => {
          if (targetSeatIds.includes(s.id)) {
            return {
              ...s,
              guest_name: guestName.trim(),
              guest_email: guestEmail.trim() || null,
              guest_phone: guestPhone.trim() || null,
              pass_code: res.passCode,
              payment_status: paymentStatus,
              ticket_sent: action === 'send_email'
            };
          }
          return s;
        }));

        // Trigger immediate PDF download if requested
        if (action === 'download_pdf') {
          handleDownloadPdf(targetSeatIds[0], res.passCode);
        }

        // Switch to Issued Passes tab
        setActiveTab('issued');
      } catch (err: any) {
        toast.error(err.message || "Failed to issue pass");
      }
    });
  };

  // Toggle Payment for an entire Pass
  const handlePaymentToggle = (pass: GroupedPass) => {
    const newStatus = pass.paymentStatus === 'pending' ? 'received' : 'pending';
    startTransition(async () => {
      try {
        await togglePayment(pass.passCode, newStatus);
        setSeats(prev => prev.map(s => {
          if (pass.seatIds.includes(s.id)) {
            return { ...s, payment_status: newStatus };
          }
          return s;
        }));
        toast.success(`Payment for Pass ${pass.passCode} marked as ${newStatus}`);
      } catch (err: any) {
        toast.error(err.message || "Failed to toggle payment");
      }
    });
  };

  // Send / Resend Ticket
  const handleSendTicket = (pass: GroupedPass) => {
    if (!pass.guestEmail) {
      toast.error("No email associated with this pass. Please edit and add an email.");
      return;
    }

    startTransition(async () => {
      try {
        await sendTicket(pass.seatIds[0]);
        setSeats(prev => prev.map(s => {
          if (pass.seatIds.includes(s.id)) {
            return { ...s, ticket_sent: true };
          }
          return s;
        }));
        toast.success(`E-Ticket sent to ${pass.guestEmail}`);
      } catch (err: any) {
        toast.error(err.message || "Failed to send ticket");
      }
    });
  };

  // Download PDF E-Ticket
  const handleDownloadPdf = async (seatId: string, passCode: string) => {
    setGeneratingPdfPassCode(passCode);
    try {
      const res = await fetch('/api/tickets/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seatId }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to generate PDF');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Hrudhayam-Pass-${passCode}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Ticket PDF downloaded');
    } catch (err: any) {
      toast.error(err.message || 'Failed to download PDF ticket');
    } finally {
      setGeneratingPdfPassCode(null);
    }
  };

  // Open Edit Modal
  const openEditModal = (pass: GroupedPass) => {
    setEditingPass(pass);
    setEditName(pass.guestName);
    setEditEmail(pass.guestEmail || '');
    setEditPhone(pass.guestPhone || '');
    setEditPayment(pass.paymentStatus);
    setEditModalOpen(true);
  };

  // Save Edited Pass
  const handleSaveEdit = async () => {
    if (!editingPass) return;
    if (!editName.trim()) {
      toast.error("Guest name cannot be empty");
      return;
    }

    startTransition(async () => {
      try {
        await updateGuest(editingPass.seatIds[0], {
          guest_name: editName.trim(),
          guest_email: editEmail.trim() || '',
          guest_phone: editPhone.trim() || ''
        });

        if (editPayment !== editingPass.paymentStatus) {
          await togglePayment(editingPass.passCode, editPayment);
        }

        setSeats(prev => prev.map(s => {
          if (editingPass.seatIds.includes(s.id)) {
            return {
              ...s,
              guest_name: editName.trim(),
              guest_email: editEmail.trim() || null,
              guest_phone: editPhone.trim() || null,
              payment_status: editPayment
            };
          }
          return s;
        }));

        toast.success("Pass details updated");
        setEditModalOpen(false);
        setEditingPass(null);
      } catch (err: any) {
        toast.error(err.message || "Failed to update pass");
      }
    });
  };

  // Open Revoke Modal
  const openRevokeModal = (pass: GroupedPass) => {
    setRevokingPass(pass);
    setRevokeModalOpen(true);
  };

  // Confirm Revoke
  const handleConfirmRevoke = async () => {
    if (!revokingPass) return;

    startTransition(async () => {
      try {
        await revokePass(revokingPass.passCode);
        
        // Optimistically clear seats back to available inventory
        setSeats(prev => prev.map(s => {
          if (revokingPass.seatIds.includes(s.id)) {
            return {
              ...s,
              guest_name: null,
              guest_email: null,
              guest_phone: null,
              pass_code: null,
              qr_token: null,
              ticket_sent: false,
              ticket_sent_at: null,
              payment_status: 'pending',
              checked_in: false,
              checked_in_at: null
            };
          }
          return s;
        }));

        toast.success(`Pass ${revokingPass.passCode} revoked. ${revokingPass.totalSeats} seat(s) moved to Available Inventory.`);
        setRevokeModalOpen(false);
        setRevokingPass(null);
      } catch (err: any) {
        toast.error(err.message || "Failed to revoke pass");
      }
    });
  };

  const getTierBadge = (tier: number | null) => {
    if (tier === 5000) return <Badge className="bg-[#B8860B]/30 text-[#FACC15] border border-[#B8860B]/60 text-[10px] font-mono font-bold">₹5,000</Badge>;
    if (tier === 3000) return <Badge className="bg-[#0D9488]/30 text-[#2DD4BF] border border-[#0D9488]/60 text-[10px] font-mono font-bold">₹3,000</Badge>;
    if (tier === 1500) return <Badge className="bg-slate-800 text-slate-300 border border-slate-600 text-[10px] font-mono font-bold">₹1,500</Badge>;
    return <Badge variant="outline" className="text-purple-400 border-purple-800/60 bg-purple-950/30 text-[10px]">VIP</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Top Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-[#131F2E] border-[#223345] rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Seats Managed</p>
              <p className="text-2xl font-black text-white mt-1">{seats.length}</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Ticket className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            {userRole === 'super_admin' ? 'Total Hall Capacity' : 'Your Assigned Allocation'}
          </p>
        </Card>

        <Card className="bg-[#131F2E] border-[#223345] rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Available Inventory</p>
              <p className="text-2xl font-black text-emerald-300 mt-1">{availableSeats.length}</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <PlusCircle className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            Ready to be assigned to donors & guests
          </p>
        </Card>

        <Card className="bg-[#131F2E] border-[#223345] rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Issued Passes</p>
              <p className="text-2xl font-black text-amber-300 mt-1">{groupedPasses.length} <span className="text-xs text-slate-400 font-normal">({allocatedSeats.length} seats)</span></p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <QrCode className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            Active QR codes issued for entry
          </p>
        </Card>

        <Card className="bg-[#131F2E] border-[#223345] rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Confirmed Collections</p>
              <p className="text-xl font-black text-emerald-400 mt-1">{formatINR(paidRevenue)}</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-emerald-950/60 border border-emerald-800 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            Pending: <span className="text-amber-400 font-semibold">{formatINR(totalRevenue - paidRevenue)}</span>
          </p>
        </Card>
      </div>

      {/* Main Action Header & Tab Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#131F2E] p-4 rounded-2xl border border-[#223345] shadow-xs">
        <div className="flex items-center gap-2">
          <Button 
            variant={activeTab === 'issued' ? 'default' : 'outline'}
            className={activeTab === 'issued' ? 'bg-[#1A2839] text-white border-[#2A3F55] font-semibold text-xs' : 'bg-transparent text-slate-400 border-transparent text-xs'}
            onClick={() => setActiveTab('issued')}
          >
            <QrCode className="w-3.5 h-3.5 mr-1.5 text-amber-400" />
            Issued Passes ({groupedPasses.length})
          </Button>

          <Button 
            variant={activeTab === 'inventory' ? 'default' : 'outline'}
            className={activeTab === 'inventory' ? 'bg-[#1A2839] text-white border-[#2A3F55] font-semibold text-xs' : 'bg-transparent text-slate-400 border-transparent text-xs'}
            onClick={() => setActiveTab('inventory')}
          >
            <Ticket className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
            Available Seats Inventory ({availableSeats.length})
          </Button>
        </div>

        <Button 
          className="bg-[#E8913A] hover:bg-[#D97706] text-slate-950 font-bold text-xs gap-1.5 shadow-md shadow-amber-950/20"
          onClick={() => openIssuePassWizard()}
        >
          <PlusCircle className="w-4 h-4" />
          <span>+ Issue New Pass</span>
        </Button>
      </div>

      {/* TAB 1: ISSUED PASSES */}
      {activeTab === 'issued' && (
        <div className="space-y-4">
          {/* Search & Filter Strip */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-[#131F2E] p-4 rounded-2xl border border-[#223345] shadow-xs">
            <div className="relative w-full max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <Input 
                placeholder="Search by Pass Code, Guest Name, Email, Phone, Seat..." 
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 h-9 text-xs bg-[#1A2839] border-[#2A3F55] text-white"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Type Filter */}
              <div className="inline-flex p-0.5 bg-[#0E1724] rounded-lg border border-[#223345] text-xs">
                {(['All', 'Single', 'Group'] as const).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setPassTypeFilter(t)}
                    className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                      passTypeFilter === t ? 'bg-[#1A2839] text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>

              {/* Section Filter */}
              <div className="inline-flex p-0.5 bg-[#0E1724] rounded-lg border border-[#223345] text-xs">
                {(['All', 'Ground Floor', 'Balcony'] as const).map(sec => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => setSectionFilter(sec)}
                    className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                      sectionFilter === sec ? 'bg-[#1A2839] text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {sec}
                  </button>
                ))}
              </div>

              {/* Payment Filter */}
              <div className="inline-flex p-0.5 bg-[#0E1724] rounded-lg border border-[#223345] text-xs">
                {(['All', 'received', 'pending'] as const).map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPaymentFilter(p)}
                    className={`px-2.5 py-1 rounded-md font-medium capitalize transition-all ${
                      paymentFilter === p ? 'bg-[#1A2839] text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {p === 'received' ? 'Paid' : p === 'pending' ? 'Pending' : 'All'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Passes Table */}
          <div className="bg-[#131F2E] rounded-2xl border border-[#223345] shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-[#0E1724] border-b border-[#223345]">
                  <TableRow className="text-slate-400 text-xs">
                    <TableHead className="w-28 text-slate-300">Pass Code</TableHead>
                    <TableHead className="min-w-[160px] text-slate-300">Guest / Group Name</TableHead>
                    <TableHead className="min-w-[160px] text-slate-300">Contact</TableHead>
                    <TableHead className="min-w-[180px] text-slate-300">Seating Coordinates</TableHead>
                    <TableHead className="w-24 text-slate-300">Tier / Value</TableHead>
                    <TableHead className="w-28 text-center text-slate-300">Payment</TableHead>
                    <TableHead className="w-24 text-center text-slate-300">Door Check-in</TableHead>
                    {userRole === 'super_admin' && (
                      <TableHead className="w-32 text-slate-300">Assigned Member</TableHead>
                    )}
                    <TableHead className="min-w-[200px] text-right pr-6 text-slate-300">Pass Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPasses.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={userRole === 'super_admin' ? 9 : 8} className="text-center py-16 text-slate-500 text-xs">
                        <div className="flex flex-col items-center justify-center space-y-2">
                          <Ticket className="w-8 h-8 text-slate-600" />
                          <p className="font-semibold text-slate-400">No issued passes found</p>
                          <p className="text-[11px] text-slate-500">
                            {search ? 'Try adjusting your search query or filters' : 'Click "+ Issue New Pass" to assign tickets from your available inventory.'}
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredPasses.map(pass => {
                      const isOwner = pass.ownerId === userId;
                      const canEdit = userRole === 'super_admin' || isOwner;

                      return (
                        <TableRow key={pass.passCode} className="hover:bg-[#1A2839]/60 transition-colors border-b border-[#1E2D3D]">
                          {/* Pass Code & Type Badge */}
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <span className="font-mono font-bold text-xs text-amber-400">
                                {pass.passCode}
                              </span>
                              <Badge variant="outline" className={`w-fit text-[9px] px-1.5 py-0 ${
                                pass.totalSeats > 1 
                                  ? 'bg-purple-950/60 text-purple-300 border-purple-800' 
                                  : 'bg-slate-900 text-slate-400 border-slate-700'
                              }`}>
                                {pass.totalSeats > 1 ? `Group (${pass.totalSeats})` : 'Single'}
                              </Badge>
                            </div>
                          </TableCell>

                          {/* Guest Name */}
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="font-semibold text-xs text-white">
                                {pass.guestName}
                              </span>
                            </div>
                          </TableCell>

                          {/* Contact Info */}
                          <TableCell>
                            <div className="flex flex-col gap-0.5 text-xs">
                              {pass.guestEmail ? (
                                <div className="flex items-center gap-1 text-slate-300 text-[11px]">
                                  <Mail className="w-3 h-3 text-slate-500 shrink-0" />
                                  <span className="truncate max-w-[140px]" title={pass.guestEmail}>{pass.guestEmail}</span>
                                </div>
                              ) : (
                                <span className="text-[11px] text-slate-500 italic">No email</span>
                              )}
                              {pass.guestPhone && (
                                <div className="flex items-center gap-1 text-slate-400 text-[11px]">
                                  <Phone className="w-3 h-3 text-slate-500 shrink-0" />
                                  <span>{pass.guestPhone}</span>
                                </div>
                              )}
                            </div>
                          </TableCell>

                          {/* Seating Info */}
                          <TableCell>
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1">
                                <Badge variant="secondary" className="text-[10px] bg-[#0E1724] text-slate-300 border border-[#223345]">
                                  {pass.section}
                                </Badge>
                                <span className="text-xs font-mono font-bold text-amber-400">
                                  Row {pass.rows.join(', ')}
                                </span>
                              </div>
                              <p className="text-[11px] font-mono text-slate-400">
                                Seats: <span className="text-white font-semibold">{pass.seatNumbers}</span>
                              </p>
                            </div>
                          </TableCell>

                          {/* Tier & Total Value */}
                          <TableCell>
                            <div className="flex flex-col gap-0.5">
                              {getTierBadge(pass.tier)}
                              <span className="text-[11px] font-mono font-bold text-emerald-400">
                                {formatINR(pass.totalValue)}
                              </span>
                            </div>
                          </TableCell>

                          {/* Payment Toggle */}
                          <TableCell className="text-center">
                            <button
                              type="button"
                              disabled={!canEdit || isPending}
                              onClick={() => handlePaymentToggle(pass)}
                              className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all ${
                                pass.paymentStatus === 'received'
                                  ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800 hover:bg-emerald-900'
                                  : 'bg-amber-950/80 text-amber-300 border border-amber-800 hover:bg-amber-900'
                              }`}
                            >
                              {pass.paymentStatus === 'received' ? '✓ Paid' : 'Pending'}
                            </button>
                          </TableCell>

                          {/* Check-in status */}
                          <TableCell className="text-center">
                            {pass.checkedIn ? (
                              <Badge className="bg-emerald-900/60 text-emerald-300 border border-emerald-700 text-[10px]">
                                Checked In
                              </Badge>
                            ) : (
                              <span className="text-[11px] text-slate-500">Not Scanned</span>
                            )}
                          </TableCell>

                          {/* Super Admin: Assigned Owner */}
                          {userRole === 'super_admin' && (
                            <TableCell>
                              <Badge variant="outline" className="text-[10px] text-slate-300 border-slate-700 bg-slate-900/50">
                                {pass.ownerName}
                              </Badge>
                            </TableCell>
                          )}

                          {/* Actions */}
                          <TableCell className="text-right pr-6">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* PDF Download */}
                              <Button
                                size="xs"
                                variant="outline"
                                className="h-7 px-2 text-slate-300 bg-[#1A2839] border-[#2A3F55] hover:bg-[#24364A] hover:text-white text-[11px] gap-1"
                                disabled={generatingPdfPassCode === pass.passCode}
                                onClick={() => handleDownloadPdf(pass.seatIds[0], pass.passCode)}
                                title="Download printable PDF E-Ticket"
                              >
                                {generatingPdfPassCode === pass.passCode ? (
                                  <Loader2 className="w-3 h-3 animate-spin text-[#E8913A]" />
                                ) : (
                                  <Download className="w-3 h-3 text-slate-400" />
                                )}
                                <span>PDF</span>
                              </Button>

                              {/* Send Email */}
                              <Button 
                                size="xs"
                                variant={pass.ticketSent ? "outline" : "default"}
                                className={`h-7 px-2.5 text-[11px] gap-1 font-medium ${
                                  pass.ticketSent 
                                    ? 'border-emerald-800 text-emerald-300 bg-emerald-950/60 hover:bg-emerald-900/80' 
                                    : 'bg-[#E8913A] hover:bg-[#D97706] text-slate-950 font-bold shadow-xs'
                                }`}
                                disabled={!canEdit || !pass.guestEmail || isPending}
                                onClick={() => handleSendTicket(pass)}
                                title={pass.guestEmail ? 'Send E-Ticket via Email' : 'Add email to send ticket'}
                              >
                                {pass.ticketSent ? (
                                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                ) : (
                                  <Send className="w-3 h-3" />
                                )}
                                <span>{pass.ticketSent ? 'Resend' : 'Send'}</span>
                              </Button>

                              {/* Edit Button */}
                              <Button
                                size="xs"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-slate-400 hover:text-white hover:bg-slate-800"
                                onClick={() => openEditModal(pass)}
                                disabled={!canEdit}
                                title="Edit Guest Details"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </Button>

                              {/* Revoke Button */}
                              <Button
                                size="xs"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-red-400 hover:text-red-300 hover:bg-red-950/50"
                                onClick={() => openRevokeModal(pass)}
                                disabled={!canEdit}
                                title="Revoke Pass & Return Seats to Inventory"
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
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: AVAILABLE SEATS INVENTORY */}
      {activeTab === 'inventory' && (
        <div className="space-y-4">
          {/* Inventory Filters & Bulk Assign Action */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-[#131F2E] p-4 rounded-2xl border border-[#223345] shadow-xs">
            <div className="relative w-full max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <Input 
                placeholder="Search by Seat ID, Row..." 
                value={invSearch}
                onChange={e => setInvSearch(e.target.value)}
                className="pl-9 h-9 text-xs bg-[#1A2839] border-[#2A3F55] text-white"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Section Filter */}
              <div className="inline-flex p-0.5 bg-[#0E1724] rounded-lg border border-[#223345] text-xs">
                {(['All', 'Ground Floor', 'Balcony'] as const).map(sec => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => setInvSection(sec)}
                    className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                      invSection === sec ? 'bg-[#1A2839] text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {sec}
                  </button>
                ))}
              </div>

              {/* Tier Filter */}
              <div className="inline-flex p-0.5 bg-[#0E1724] rounded-lg border border-[#223345] text-xs">
                {[
                  { label: 'All Tiers', val: 'All' },
                  { label: '₹5,000', val: '5000' },
                  { label: '₹3,000', val: '3000' },
                  { label: '₹1,500', val: '1500' }
                ].map(t => (
                  <button
                    key={t.val}
                    type="button"
                    onClick={() => setInvTier(t.val)}
                    className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                      invTier === t.val ? 'bg-[#1A2839] text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {selectedInvSeats.size > 0 && (
                <Button 
                  size="sm"
                  className="bg-[#E8913A] hover:bg-[#D97706] text-slate-950 font-bold text-xs"
                  onClick={() => openIssuePassWizard(Array.from(selectedInvSeats))}
                >
                  <Users className="w-3.5 h-3.5 mr-1" />
                  Issue Group Pass ({selectedInvSeats.size} Seats)
                </Button>
              )}
            </div>
          </div>

          {/* Available Seats Grid / Table */}
          <div className="bg-[#131F2E] rounded-2xl border border-[#223345] shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-[#0E1724] border-b border-[#223345]">
                  <TableRow className="text-slate-400 text-xs">
                    <TableHead className="w-10">
                      <input 
                        type="checkbox" 
                        checked={selectedInvSeats.size > 0 && selectedInvSeats.size === filteredAvailableSeats.length}
                        onChange={() => {
                          if (selectedInvSeats.size === filteredAvailableSeats.length) {
                            setSelectedInvSeats(new Set());
                          } else {
                            setSelectedInvSeats(new Set(filteredAvailableSeats.map(s => s.id)));
                          }
                        }}
                        className="w-4 h-4 accent-amber-500 rounded border-slate-600 bg-[#1A2839]"
                      />
                    </TableHead>
                    <TableHead className="w-28 text-slate-300">Seat ID</TableHead>
                    <TableHead className="w-32 text-slate-300">Section</TableHead>
                    <TableHead className="w-20 text-slate-300">Row</TableHead>
                    <TableHead className="w-20 text-slate-300">Seat#</TableHead>
                    <TableHead className="w-28 text-slate-300">Price Tier</TableHead>
                    {userRole === 'super_admin' && (
                      <TableHead className="w-36 text-slate-300">Assigned Member</TableHead>
                    )}
                    <TableHead className="text-right pr-6 text-slate-300">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAvailableSeats.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={userRole === 'super_admin' ? 8 : 7} className="text-center py-16 text-slate-500 text-xs">
                        All seats matching this criteria have already been allocated passes!
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAvailableSeats.map(seat => {
                      const isSelected = selectedInvSeats.has(seat.id);
                      const ownerName = seat.owner_id ? (ownerMap[seat.owner_id] || 'Team Member') : 'Unassigned';

                      return (
                        <TableRow key={seat.id} className="hover:bg-[#1A2839]/60 transition-colors border-b border-[#1E2D3D]">
                          <TableCell>
                            <input 
                              type="checkbox" 
                              checked={isSelected}
                              onChange={() => {
                                const newSet = new Set(selectedInvSeats);
                                if (newSet.has(seat.id)) newSet.delete(seat.id);
                                else newSet.add(seat.id);
                                setSelectedInvSeats(newSet);
                              }}
                              className="w-4 h-4 accent-amber-500 rounded border-slate-600 bg-[#1A2839]"
                            />
                          </TableCell>
                          <TableCell className="font-mono font-bold text-xs text-white">
                            {seat.id}
                          </TableCell>
                          <TableCell className="text-xs text-slate-300">
                            {seat.section}
                          </TableCell>
                          <TableCell className="font-mono font-semibold text-xs text-amber-400">
                            Row {seat.row_label}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-slate-400">
                            #{seat.seat_no}
                          </TableCell>
                          <TableCell>
                            {getTierBadge(seat.tier)}
                          </TableCell>
                          {userRole === 'super_admin' && (
                            <TableCell>
                              <Badge variant="outline" className="text-[10px] text-slate-300 border-slate-700 bg-slate-900/50">
                                {ownerName}
                              </Badge>
                            </TableCell>
                          )}
                          <TableCell className="text-right pr-6">
                            <Button 
                              size="xs"
                              className="bg-[#E8913A] hover:bg-[#D97706] text-slate-950 font-bold text-[11px] h-7 px-3"
                              onClick={() => openIssuePassWizard([seat.id])}
                            >
                              Issue Pass
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* UNIFIED ISSUE PASS WIZARD MODAL ("ONE PROMPT BOX") */}
      {/* ========================================================================= */}
      <Dialog open={wizardOpen} onOpenChange={setWizardOpen}>
        <DialogContent className="sm:max-w-2xl bg-[#131F2E] rounded-2xl border border-[#223345] text-white shadow-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="border-b border-[#223345] pb-3">
            <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              Issue Concert Admission Pass
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Select ticket mode, pick available seats, and generate single or unified group E-Tickets.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-3">
            {/* Step 1: Mode Switcher */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                1. Pass Type
              </Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setPassMode('single');
                    if (wizardSelectedSeats.length > 0) {
                      setWizardSingleSeat(wizardSelectedSeats[0]);
                      setWizardSelectedSeats([]);
                    }
                  }}
                  className={`p-3 rounded-xl border flex items-center gap-3 transition-all text-left ${
                    passMode === 'single'
                      ? 'bg-[#1A2839] border-amber-500/80 text-white shadow-sm ring-1 ring-amber-500/50'
                      : 'bg-[#0E1724] border-[#223345] text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <Ticket className={`w-5 h-5 ${passMode === 'single' ? 'text-amber-400' : 'text-slate-500'}`} />
                  <div>
                    <p className="font-bold text-xs text-white">Single Pass</p>
                    <p className="text-[11px] text-slate-400">Individual pass for 1 seat</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPassMode('group');
                    if (wizardSingleSeat) {
                      setWizardSelectedSeats([wizardSingleSeat]);
                      setWizardSingleSeat('');
                    }
                  }}
                  className={`p-3 rounded-xl border flex items-center gap-3 transition-all text-left ${
                    passMode === 'group'
                      ? 'bg-[#1A2839] border-amber-500/80 text-white shadow-sm ring-1 ring-amber-500/50'
                      : 'bg-[#0E1724] border-[#223345] text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <Users className={`w-5 h-5 ${passMode === 'group' ? 'text-amber-400' : 'text-slate-500'}`} />
                  <div>
                    <p className="font-bold text-xs text-white">Group / Family Pass</p>
                    <p className="text-[11px] text-slate-400">Multiple seats under 1 unified QR code</p>
                  </div>
                </button>
              </div>
            </div>

            {/* Step 2: Seating Filters & Picker */}
            <div className="space-y-3 bg-[#0E1724] p-4 rounded-xl border border-[#223345]">
              <Label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
                2. Select Available Seats
              </Label>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[11px] text-slate-400">Section</Label>
                  <Select 
                    value={wizardSection} 
                    onValueChange={(v) => {
                      if (v) {
                        setWizardSection(v as any);
                        setWizardSingleSeat('');
                        setWizardSelectedSeats([]);
                      }
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs bg-[#1A2839] border-[#2A3F55] text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#131F2E] border-[#223345] text-white">
                      <SelectItem value="Ground Floor">Ground Floor</SelectItem>
                      <SelectItem value="Balcony">Balcony</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] text-slate-400">Price Category</Label>
                  <Select 
                    value={wizardTier} 
                    onValueChange={(v) => {
                      if (v) {
                        setWizardTier(v);
                        setWizardSingleSeat('');
                        setWizardSelectedSeats([]);
                      }
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs bg-[#1A2839] border-[#2A3F55] text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#131F2E] border-[#223345] text-white">
                      <SelectItem value="All">All Categories</SelectItem>
                      <SelectItem value="5000">₹5,000 (Gold VIP)</SelectItem>
                      <SelectItem value="3000">₹3,000 (Premium)</SelectItem>
                      <SelectItem value="1500">₹1,500 (Standard)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Single Mode Seat Picker */}
              {passMode === 'single' ? (
                <div className="space-y-1 pt-1">
                  <Label className="text-[11px] text-slate-300">Choose Available Seat</Label>
                  <Select 
                    value={wizardSingleSeat} 
                    onValueChange={(v) => {
                      if (v) setWizardSingleSeat(v);
                    }}
                  >
                    <SelectTrigger className="h-9 text-xs bg-[#1A2839] border-[#2A3F55] text-white font-mono">
                      <SelectValue placeholder="-- Select an available seat --" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#131F2E] border-[#223345] text-white max-h-56">
                      {wizardFilteredAvailableSeats.length === 0 ? (
                        <SelectItem value="none" disabled>No available seats matching criteria</SelectItem>
                      ) : (
                        wizardFilteredAvailableSeats.map(s => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.id} (Row {s.row_label}, Seat #{s.seat_no}) • {s.tier ? formatINR(s.tier) : 'VIP'}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                /* Group Mode Multi-Seat Selector */
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300 font-medium">
                      Select multiple available seats:
                    </span>
                    <span className="font-mono text-amber-400 font-bold">
                      {wizardSelectedSeats.length} selected 
                      {wizardSelectedSeats.length > 0 && ` • ${formatINR(
                        availableSeats
                          .filter(s => wizardSelectedSeats.includes(s.id))
                          .reduce((sum, s) => sum + (s.tier || 0), 0)
                      )}`}
                    </span>
                  </div>

                  <div className="max-h-40 overflow-y-auto p-2 bg-[#1A2839] rounded-xl border border-[#2A3F55] grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                    {wizardFilteredAvailableSeats.length === 0 ? (
                      <p className="col-span-full text-center py-4 text-xs text-slate-500">
                        No available seats matching criteria
                      </p>
                    ) : (
                      wizardFilteredAvailableSeats.map(s => {
                        const isChecked = wizardSelectedSeats.includes(s.id);
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => {
                              if (isChecked) {
                                setWizardSelectedSeats(prev => prev.filter(id => id !== s.id));
                              } else {
                                setWizardSelectedSeats(prev => [...prev, s.id]);
                              }
                            }}
                            className={`p-1.5 rounded-lg border text-left font-mono text-[11px] transition-all flex items-center justify-between ${
                              isChecked 
                                ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold' 
                                : 'bg-[#0E1724] border-[#223345] text-slate-300 hover:border-slate-600'
                            }`}
                          >
                            <span>{s.id}</span>
                            <span className="text-[9px] text-slate-400">{s.tier ? `₹${s.tier/1000}k` : ''}</span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Step 3: Guest & Payment Information */}
            <div className="space-y-3.5">
              <Label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
                3. Guest & Contact Information
              </Label>

              <div className="space-y-1">
                <Label className="text-xs font-medium text-slate-300">
                  {passMode === 'group' ? 'Group / Primary Contact Name *' : 'Guest Full Name *'}
                </Label>
                <Input 
                  placeholder="e.g. Dr. Rajesh Kumar & Family" 
                  value={guestName} 
                  onChange={e => setGuestName(e.target.value)} 
                  className="h-9 text-xs bg-[#1A2839] border-[#2A3F55] text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-slate-300">Email Address (for E-Ticket delivery)</Label>
                  <Input 
                    type="email" 
                    placeholder="guest@example.com" 
                    value={guestEmail} 
                    onChange={e => setGuestEmail(e.target.value)} 
                    className="h-9 text-xs bg-[#1A2839] border-[#2A3F55] text-white"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-medium text-slate-300">Mobile Phone (Optional)</Label>
                  <Input 
                    type="tel" 
                    placeholder="10-digit mobile" 
                    value={guestPhone} 
                    onChange={e => setGuestPhone(e.target.value)} 
                    className="h-9 text-xs bg-[#1A2839] border-[#2A3F55] text-white"
                  />
                </div>
              </div>

              {/* Payment Toggle */}
              <div className="flex items-center justify-between p-3 bg-[#0E1724] rounded-xl border border-[#223345]">
                <div>
                  <p className="text-xs font-bold text-white">Payment Status</p>
                  <p className="text-[11px] text-slate-400">Has the donor contribution been received?</p>
                </div>
                <div className="inline-flex p-0.5 bg-[#1A2839] rounded-lg border border-[#2A3F55] text-xs">
                  <button
                    type="button"
                    onClick={() => setPaymentStatus('pending')}
                    className={`px-3 py-1 rounded-md font-bold transition-all ${
                      paymentStatus === 'pending' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'text-slate-400'
                    }`}
                  >
                    Pending
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentStatus('received')}
                    className={`px-3 py-1 rounded-md font-bold transition-all ${
                      paymentStatus === 'received' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'text-slate-400'
                    }`}
                  >
                    ✓ Paid
                  </button>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-1.5 border-t border-[#223345] pt-3 flex-wrap">
            <Button 
              variant="outline" 
              className="bg-[#1A2839] border-[#2A3F55] text-slate-300 text-xs"
              onClick={() => setWizardOpen(false)}
            >
              Cancel
            </Button>

            <Button 
              variant="outline"
              className="bg-[#1A2839] border-slate-700 text-white hover:bg-slate-800 text-xs gap-1"
              disabled={isPending || !guestName}
              onClick={() => handleIssuePass('issue')}
            >
              {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Ticket className="w-3.5 h-3.5" />}
              <span>Issue Pass Only</span>
            </Button>

            <Button 
              variant="outline"
              className="bg-[#1A2839] border-amber-600/40 text-amber-300 hover:bg-amber-950/40 text-xs gap-1"
              disabled={isPending || !guestName}
              onClick={() => handleIssuePass('download_pdf')}
            >
              <Download className="w-3.5 h-3.5 text-amber-400" />
              <span>Issue & Download PDF</span>
            </Button>

            <Button 
              className="bg-[#E8913A] hover:bg-[#D97706] text-slate-950 font-bold text-xs gap-1"
              disabled={isPending || !guestName || !guestEmail}
              onClick={() => handleIssuePass('send_email')}
            >
              {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              <span>Issue & Send Email</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* EDIT PASS MODAL */}
      {/* ========================================================================= */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="sm:max-w-md bg-[#131F2E] rounded-2xl border border-[#223345] text-white shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
              <Edit className="w-4 h-4 text-amber-400" />
              Edit Pass {editingPass?.passCode}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Update guest contact information or toggle payment status.
            </DialogDescription>
          </DialogHeader>

          {/* Super Admin Override Warning Notice */}
          {userRole === 'super_admin' && editingPass?.ownerId && editingPass.ownerId !== userId && (
            <div className="p-3 bg-amber-950/30 border border-amber-600/40 rounded-xl flex items-center gap-2.5 text-xs text-amber-300">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>This pass is allocated to <strong>{editingPass.ownerName}</strong>. Super Admin override active.</span>
            </div>
          )}

          <div className="space-y-3.5 py-2">
            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-300">Guest Name</Label>
              <Input value={editName} onChange={e => setEditName(e.target.value)} className="h-9 text-xs bg-[#1A2839] border-[#2A3F55] text-white" />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-300">Email Address</Label>
              <Input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} className="h-9 text-xs bg-[#1A2839] border-[#2A3F55] text-white" />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-300">Mobile Phone</Label>
              <Input type="tel" value={editPhone} onChange={e => setEditPhone(e.target.value)} className="h-9 text-xs bg-[#1A2839] border-[#2A3F55] text-white" />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-300">Payment Status</Label>
              <Select 
                value={editPayment} 
                onValueChange={(v) => {
                  if (v) setEditPayment(v as any);
                }}
              >
                <SelectTrigger className="h-9 text-xs bg-[#1A2839] border-[#2A3F55] text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#131F2E] border-[#223345] text-white">
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="received">Paid (Received)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" className="bg-[#1A2839] border-[#2A3F55] text-slate-300" onClick={() => setEditModalOpen(false)}>
              Cancel
            </Button>
            <Button className="bg-[#E8913A] hover:bg-[#D97706] text-slate-950 font-bold" onClick={handleSaveEdit} disabled={isPending}>
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* REVOKE PASS CONFIRMATION MODAL */}
      {/* ========================================================================= */}
      <Dialog open={revokeModalOpen} onOpenChange={setRevokeModalOpen}>
        <DialogContent className="sm:max-w-md bg-[#131F2E] rounded-2xl border border-[#223345] text-white shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-400" />
              Revoke Pass {revokingPass?.passCode}?
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              This will unassign the guest and return all associated seats to the Available Inventory.
            </DialogDescription>
          </DialogHeader>

          {/* Super Admin Override Notice */}
          {userRole === 'super_admin' && revokingPass?.ownerId && revokingPass.ownerId !== userId && (
            <div className="p-3 bg-amber-950/30 border border-amber-600/40 rounded-xl flex items-center gap-2.5 text-xs text-amber-300">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>This pass belongs to <strong>{revokingPass.ownerName}</strong>'s allocation.</span>
            </div>
          )}

          <div className="py-2 text-xs text-slate-300 space-y-2">
            <p>
              Guest: <span className="text-white font-semibold">{revokingPass?.guestName}</span>
            </p>
            <p>
              Seats to free: <span className="font-mono text-amber-400 font-bold">{revokingPass?.seatIds.join(', ')}</span> ({revokingPass?.totalSeats} seats)
            </p>
            <p className="text-slate-400 text-[11px] pt-1">
              The existing QR code will be permanently invalidated at the door scanner.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" className="bg-[#1A2839] border-[#2A3F55] text-slate-300" onClick={() => setRevokeModalOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive"
              className="bg-red-600 hover:bg-red-700 text-white font-bold" 
              onClick={handleConfirmRevoke} 
              disabled={isPending}
            >
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Revoke & Free Seats"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
