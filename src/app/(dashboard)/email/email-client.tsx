'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { sendCustomMassEmail, getQueueStatus, TargetRecipient } from './actions';
import { 
  Mail, 
  Users, 
  Send, 
  Search, 
  MessageSquare, 
  Phone, 
  CheckCircle2, 
  Copy, 
  ExternalLink,
  Clock,
  Download,
  Image as ImageIcon,
  Share2
} from 'lucide-react';
import { 
  formatWhatsAppMessage, 
  getWhatsAppShareUrl, 
  downloadTicketImage, 
  downloadTicketPdf, 
  copyTicketImageToClipboard,
  mobileNativeShareTicket 
} from '@/lib/whatsapp';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter, 
  DialogDescription 
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

interface GuestRecord {
  id: string;
  section: string;
  row_label: string;
  seat_no: number;
  tier: number | null;
  owner_id: string | null;
  guest_name: string | null;
  guest_email: string | null;
  guest_phone: string | null;
  pass_code: string | null;
  payment_status: 'pending' | 'received';
  ticket_sent: boolean;
}

type EmailClientProps = {
  isSuperAdmin: boolean;
  teamMembers: { id: string; full_name: string; email: string }[];
  userId: string;
  initialGuests: GuestRecord[];
};

export function EmailClient({ isSuperAdmin, teamMembers, userId, initialGuests }: EmailClientProps) {
  const [activeTab, setActiveTab] = useState<'email' | 'whatsapp'>('email');

  // Email form state
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [manualEmails, setManualEmails] = useState('');
  
  // Recipient selection state
  const [selectedSeatIds, setSelectedSeatIds] = useState<Set<string>>(new Set());
  const [emailSearch, setEmailSearch] = useState('');
  const [emailSectionFilter, setEmailSectionFilter] = useState<'All' | 'Ground Floor' | 'Balcony'>('All');
  const [emailTierFilter, setEmailTierFilter] = useState<string>('All');
  const [emailPaymentFilter, setEmailPaymentFilter] = useState<'All' | 'pending' | 'received'>('All');
  const [emailOwnerFilter, setEmailOwnerFilter] = useState<string>('All');

  // WhatsApp Hub state
  const [waSearch, setWaSearch] = useState('');
  const [waSectionFilter, setWaSectionFilter] = useState<'All' | 'Ground Floor' | 'Balcony'>('All');
  const [waModalOpen, setWaModalOpen] = useState(false);
  const [waTargetItem, setWaTargetItem] = useState<{
    passCode: string;
    seatId: string;
    guestName: string;
    phone: string;
    section: string;
    rows: string[];
    seatNumbers: string;
    totalSeats: number;
    paymentStatus: string;
  } | null>(null);

  const [isSending, setIsSending] = useState(false);
  const [queueStats, setQueueStats] = useState<{ queued: number; sent: number; failed: number } | null>(null);

  // Initialize all valid email seats as selected by default
  useEffect(() => {
    const validSeatIds = initialGuests
      .filter(g => g.guest_email && g.guest_email.trim() !== '')
      .map(g => g.id);
    setSelectedSeatIds(new Set(validSeatIds));
  }, [initialGuests]);

  // Queue polling
  useEffect(() => {
    const fetchStats = async () => {
      const stats = await getQueueStatus();
      setQueueStats(stats);
    };
    fetchStats();
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, []);

  // Filter guests with emails for the checklist
  const filteredEmailGuests = useMemo(() => {
    return initialGuests.filter(g => {
      if (!g.guest_email || g.guest_email.trim() === '') return false;
      const q = emailSearch.toLowerCase();
      const matchesSearch = 
        (g.guest_name || '').toLowerCase().includes(q) ||
        g.guest_email.toLowerCase().includes(q) ||
        g.id.toLowerCase().includes(q);

      const matchesSection = emailSectionFilter === 'All' || g.section === emailSectionFilter;
      const matchesTier = emailTierFilter === 'All' || String(g.tier) === emailTierFilter;
      const matchesPayment = emailPaymentFilter === 'All' || g.payment_status === emailPaymentFilter;
      const matchesOwner = emailOwnerFilter === 'All' || g.owner_id === emailOwnerFilter;

      return matchesSearch && matchesSection && matchesTier && matchesPayment && matchesOwner;
    });
  }, [initialGuests, emailSearch, emailSectionFilter, emailTierFilter, emailPaymentFilter, emailOwnerFilter]);

  // Parse manual emails
  const parsedManualEmails = useMemo(() => {
    if (!manualEmails.trim()) return [];
    return manualEmails
      .split(/[\n,;]+/)
      .map(e => e.trim())
      .filter(e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
  }, [manualEmails]);

  // Total unique target recipients
  const totalTargetRecipients = useMemo(() => {
    const selectedGuests = initialGuests.filter(g => selectedSeatIds.has(g.id) && g.guest_email);
    const guestEmails = selectedGuests.map(g => ({
      email: g.guest_email!.trim(),
      name: g.guest_name || undefined,
      seatId: g.id
    }));

    const manual = parsedManualEmails.map(email => ({ email }));

    // Deduplicate
    const map = new Map<string, TargetRecipient>();
    for (const r of [...guestEmails, ...manual]) {
      const clean = r.email.toLowerCase();
      if (!map.has(clean)) map.set(clean, r);
    }
    return Array.from(map.values());
  }, [initialGuests, selectedSeatIds, parsedManualEmails]);

  // Select all / Deselect all for filtered list
  const handleSelectAllFiltered = () => {
    const newSet = new Set(selectedSeatIds);
    for (const g of filteredEmailGuests) {
      newSet.add(g.id);
    }
    setSelectedSeatIds(newSet);
  };

  const handleDeselectAllFiltered = () => {
    const newSet = new Set(selectedSeatIds);
    for (const g of filteredEmailGuests) {
      newSet.delete(g.id);
    }
    setSelectedSeatIds(newSet);
  };

  // Send mass email
  const handleSend = async () => {
    if (!subject.trim()) {
      toast.error('Please enter an email subject.');
      return;
    }
    if (!body.trim()) {
      toast.error('Please enter the email body content.');
      return;
    }
    if (totalTargetRecipients.length === 0) {
      toast.error('No recipients selected. Check some guests or paste manual emails.');
      return;
    }

    if (!confirm(`Confirm sending mass email to ${totalTargetRecipients.length} recipients?`)) {
      return;
    }

    setIsSending(true);
    try {
      const result = await sendCustomMassEmail(subject, body, totalTargetRecipients, userId);
      toast.success(`Broadcast queued! ${result.queued} emails scheduled.`);
      setSubject('');
      setBody('');
      setManualEmails('');
    } catch (error: any) {
      toast.error(error.message || 'Failed to queue emails');
    } finally {
      setIsSending(false);
    }
  };

  // Filter guests with phone numbers for WhatsApp Hub
  const filteredWhatsAppGuests = useMemo(() => {
    const map = new Map<string, GuestRecord[]>();
    for (const g of initialGuests) {
      if (!g.guest_phone || g.guest_phone.trim() === '') continue;
      const key = g.pass_code || g.id;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(g);
    }

    const list: {
      passCode: string;
      guestName: string;
      phone: string;
      section: string;
      rows: string[];
      seatNumbers: string;
      totalSeats: number;
      paymentStatus: string;
      rawSeats: GuestRecord[];
    }[] = [];

    for (const [code, group] of map.entries()) {
      const first = group[0];
      const rows = Array.from(new Set(group.map(g => g.row_label)));
      const seatNumbers = group.map(g => g.seat_no).sort((a, b) => a - b).join(', ');

      const q = waSearch.toLowerCase();
      const matchesSearch = 
        (first.guest_name || '').toLowerCase().includes(q) ||
        (first.guest_phone || '').includes(q) ||
        code.toLowerCase().includes(q);

      const matchesSection = waSectionFilter === 'All' || first.section === waSectionFilter;

      if (matchesSearch && matchesSection) {
        list.push({
          passCode: code,
          guestName: first.guest_name || 'Valued Donor',
          phone: first.guest_phone || '',
          section: first.section,
          rows,
          seatNumbers,
          totalSeats: group.length,
          paymentStatus: first.payment_status,
          rawSeats: group
        });
      }
    }

    return list;
  }, [initialGuests, waSearch, waSectionFilter]);

  // Open WhatsApp Dispatch Modal
  const openWhatsAppModal = (item: any) => {
    setWaTargetItem({
      passCode: item.passCode,
      seatId: item.rawSeats[0].id,
      guestName: item.guestName,
      phone: item.phone,
      section: item.section,
      rows: item.rows,
      seatNumbers: item.seatNumbers,
      totalSeats: item.totalSeats,
      paymentStatus: item.paymentStatus
    });
    setWaModalOpen(true);
  };

  // Direct Mobile WhatsApp Native Share
  const handleMobileNativeShare = async (target: typeof waTargetItem) => {
    if (!target) return;
    try {
      toast.loading("Preparing ticket image...", { id: 'mob-share' });
      const shared = await mobileNativeShareTicket({
        seatId: target.seatId,
        passCode: target.passCode,
        guestName: target.guestName,
        phone: target.phone,
        section: target.section,
        rows: target.rows,
        seatNumbers: target.seatNumbers,
        totalSeats: target.totalSeats,
        paymentStatus: target.paymentStatus,
      });

      if (shared) {
        toast.success("Shared directly via WhatsApp!", { id: 'mob-share' });
        setWaModalOpen(false);
      } else {
        toast.error("Native share not supported on this browser. Use the Green Launch Button.", { id: 'mob-share' });
      }
    } catch (err: any) {
      toast.error(err.message || "Share failed", { id: 'mob-share' });
    }
  };

  // WhatsApp formatted message computed for modal (WITHOUT links)
  const waModalMessage = useMemo(() => {
    if (!waTargetItem) return '';
    return formatWhatsAppMessage({
      guestName: waTargetItem.guestName,
      phone: waTargetItem.phone,
      passCode: waTargetItem.passCode,
      section: waTargetItem.section,
      rows: waTargetItem.rows,
      seatNumbers: waTargetItem.seatNumbers,
      totalSeats: waTargetItem.totalSeats,
      paymentStatus: waTargetItem.paymentStatus
    });
  }, [waTargetItem]);

  // WhatsApp direct share URL
  const waDirectUrl = useMemo(() => {
    if (!waTargetItem) return '';
    return getWhatsAppShareUrl(waTargetItem.phone, waModalMessage);
  }, [waTargetItem, waModalMessage]);

  return (
    <div className="space-y-6">
      {/* Top Channel Tabs */}
      <div className="flex items-center gap-3 bg-[#131F2E] p-3 rounded-2xl border border-[#223345]">
        <Button
          variant={activeTab === 'email' ? 'default' : 'outline'}
          className={activeTab === 'email' ? 'bg-[#1A2839] text-white border-[#2A3F55] font-bold text-xs gap-1.5' : 'bg-transparent text-slate-400 border-transparent text-xs gap-1.5'}
          onClick={() => setActiveTab('email')}
        >
          <Mail className="w-4 h-4 text-amber-400" />
          <span>Email Broadcast</span>
        </Button>

        <Button
          variant={activeTab === 'whatsapp' ? 'default' : 'outline'}
          className={activeTab === 'whatsapp' ? 'bg-[#1A2839] text-white border-[#2A3F55] font-bold text-xs gap-1.5' : 'bg-transparent text-slate-400 border-transparent text-xs gap-1.5'}
          onClick={() => setActiveTab('whatsapp')}
        >
          <MessageSquare className="w-4 h-4 text-emerald-400" />
          <span>WhatsApp Hub ({filteredWhatsAppGuests.length} Contacts)</span>
        </Button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: EMAIL BROADCAST COMPOSER */}
      {/* ========================================================================= */}
      {activeTab === 'email' && (
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Left Column: Email Composer & Manual Inputs (7 cols) */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            <Card className="bg-[#131F2E] border-[#223345] rounded-2xl shadow-xl overflow-hidden">
              <CardHeader className="bg-[#0E1724] pb-3 border-b border-[#223345]">
                <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider">
                  <Mail className="w-4 h-4" />
                  <span>Broadcast Composer</span>
                </div>
                <CardTitle className="text-base font-bold text-white mt-1">Compose Mass Email</CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Send concert updates, schedule announcements, or reminders.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300">Subject Line *</label>
                  <Input 
                    placeholder="Important: Hrudhayam LIVE 2026 Concert Details & Timings" 
                    value={subject} 
                    onChange={(e) => setSubject(e.target.value)} 
                    className="h-10 text-xs bg-[#1A2839] border-[#2A3F55] text-white"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300">Message Content (HTML or Plain Text) *</label>
                  <Textarea 
                    placeholder="Dear Patron,&#10;&#10;We look forward to welcoming you to Hrudhayam LIVE 2026 this Friday at The Music Academy...&#10;&#10;Gates open at 5:30 PM." 
                    rows={8}
                    value={body} 
                    onChange={(e) => setBody(e.target.value)} 
                    className="text-xs bg-[#1A2839] border-[#2A3F55] text-white leading-relaxed font-sans"
                  />
                </div>

                {/* Manual Extra Email Input */}
                <div className="space-y-1.5 pt-2 border-t border-[#223345]">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-slate-300">
                      Manually Add Extra Email Recipients (Optional)
                    </label>
                    <span className="text-[11px] text-amber-400 font-mono">
                      {parsedManualEmails.length} valid email(s) added
                    </span>
                  </div>
                  <Textarea 
                    placeholder="Paste additional emails separated by commas or newlines (e.g. sponsor@corporate.com, trustee@foundation.org)..." 
                    rows={3}
                    value={manualEmails} 
                    onChange={(e) => setManualEmails(e.target.value)} 
                    className="text-xs bg-[#1A2839] border-[#2A3F55] text-white font-mono"
                  />
                </div>
              </CardContent>
              <CardFooter className="bg-[#0E1724] border-t border-[#223345] px-6 py-4 flex justify-between items-center flex-wrap gap-3">
                <div className="text-xs text-slate-400 space-y-0.5">
                  <p>
                    Selected from database: <strong className="text-white">{selectedSeatIds.size}</strong> • Manual: <strong className="text-white">{parsedManualEmails.length}</strong>
                  </p>
                  <p>
                    Total Target: <strong className="text-amber-400 font-mono text-sm">{totalTargetRecipients.length}</strong> recipients
                  </p>
                </div>
                <Button 
                  onClick={handleSend} 
                  disabled={isSending || totalTargetRecipients.length === 0 || !subject.trim() || !body.trim()}
                  className="bg-[#E8913A] hover:bg-[#D97706] text-slate-950 font-bold text-xs shadow-md shadow-amber-950/20 px-5"
                >
                  <Send className="mr-1.5 h-3.5 w-3.5" />
                  {isSending ? 'Queueing Broadcast...' : `Queue Broadcast (${totalTargetRecipients.length})`}
                </Button>
              </CardFooter>
            </Card>

            {/* Live Queue Status */}
            {queueStats && (
              <Card className="bg-[#131F2E] border-[#223345] rounded-2xl shadow-xl overflow-hidden">
                <CardHeader className="bg-[#0E1724] pb-2 border-b border-[#223345]">
                  <CardTitle className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    Background Mailer Queue Status
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 grid grid-cols-3 gap-3 text-center text-xs">
                  <div className="p-3 bg-[#1A2839] rounded-xl border border-[#2A3F55]">
                    <div className="text-lg font-black text-[#E8913A]">{queueStats.queued}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">In Queue</div>
                  </div>
                  <div className="p-3 bg-[#1A2839] rounded-xl border border-[#2A3F55]">
                    <div className="text-lg font-black text-emerald-400">{queueStats.sent}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">Delivered</div>
                  </div>
                  <div className="p-3 bg-[#1A2839] rounded-xl border border-[#2A3F55]">
                    <div className="text-lg font-black text-red-400">{queueStats.failed}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">Failed</div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column: Interactive Recipient Checklist & Filter (5 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            <Card className="bg-[#131F2E] border-[#223345] rounded-2xl shadow-xl overflow-hidden">
              <CardHeader className="bg-[#0E1724] pb-3 border-b border-[#223345]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-sky-400 text-xs font-bold uppercase tracking-wider">
                    <Users className="w-4 h-4" />
                    <span>Collected Guest Emails</span>
                  </div>
                  <Badge variant="outline" className="text-[10px] text-slate-300 border-slate-700">
                    {selectedSeatIds.size} / {initialGuests.filter(g => g.guest_email).length} Selected
                  </Badge>
                </div>
                <CardTitle className="text-base font-bold text-white mt-1">Recipient Checklist</CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Select or deselect specific guests from your database.
                </CardDescription>
              </CardHeader>

              <CardContent className="p-4 space-y-3">
                {/* Search in checklist */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <Input 
                    placeholder="Search collected guests..." 
                    value={emailSearch} 
                    onChange={e => setEmailSearch(e.target.value)}
                    className="h-8 pl-8 text-xs bg-[#1A2839] border-[#2A3F55] text-white"
                  />
                </div>

                {/* Filter Pill Strip */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <Select value={emailSectionFilter} onValueChange={(v: any) => { if (v) setEmailSectionFilter(v); }}>
                    <SelectTrigger className="h-7 text-[11px] bg-[#1A2839] border-[#2A3F55] text-white"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-[#131F2E] border-[#223345] text-white">
                      <SelectItem value="All">All Sections</SelectItem>
                      <SelectItem value="Ground Floor">Ground Floor</SelectItem>
                      <SelectItem value="Balcony">Balcony</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={emailPaymentFilter} onValueChange={(v: any) => { if (v) setEmailPaymentFilter(v); }}>
                    <SelectTrigger className="h-7 text-[11px] bg-[#1A2839] border-[#2A3F55] text-white"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-[#131F2E] border-[#223345] text-white">
                      <SelectItem value="All">All Payment</SelectItem>
                      <SelectItem value="received">Paid Only</SelectItem>
                      <SelectItem value="pending">Pending Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Bulk Select Actions */}
                <div className="flex items-center justify-between text-xs pt-1 pb-1 border-b border-[#223345]">
                  <button 
                    type="button" 
                    onClick={handleSelectAllFiltered} 
                    className="text-amber-400 hover:text-amber-300 font-semibold text-[11px]"
                  >
                    Select All Matching ({filteredEmailGuests.length})
                  </button>
                  <button 
                    type="button" 
                    onClick={handleDeselectAllFiltered} 
                    className="text-slate-400 hover:text-slate-200 text-[11px]"
                  >
                    Deselect All
                  </button>
                </div>

                {/* Scrollable Recipient Checklist List */}
                <div className="max-h-96 overflow-y-auto space-y-1 pr-1">
                  {filteredEmailGuests.length === 0 ? (
                    <div className="text-center py-8 text-xs text-slate-500">
                      No guests with email match these filters.
                    </div>
                  ) : (
                    filteredEmailGuests.map(guest => {
                      const isChecked = selectedSeatIds.has(guest.id);
                      return (
                        <div
                          key={guest.id}
                          onClick={() => {
                            const newSet = new Set(selectedSeatIds);
                            if (newSet.has(guest.id)) newSet.delete(guest.id);
                            else newSet.add(guest.id);
                            setSelectedSeatIds(newSet);
                          }}
                          className={`p-2 rounded-xl border text-xs cursor-pointer transition-all flex items-start gap-2.5 ${
                            isChecked
                              ? 'bg-[#1A2839] border-amber-500/60 text-white'
                              : 'bg-[#0E1724] border-[#223345] text-slate-400 hover:border-slate-700'
                          }`}
                        >
                          <input 
                            type="checkbox" 
                            checked={isChecked} 
                            onChange={() => {}} 
                            className="w-4 h-4 mt-0.5 accent-amber-500 rounded border-slate-600 bg-[#0E1724]"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-semibold text-white truncate text-[11px]">{guest.guest_name}</span>
                              <span className="font-mono text-[10px] text-amber-400 shrink-0">{guest.id}</span>
                            </div>
                            <p className="text-[11px] text-slate-300 truncate">{guest.guest_email}</p>
                            <div className="flex items-center gap-1.5 mt-1 text-[10px]">
                              <span className="text-slate-400">{guest.section}</span>
                              <span className="text-slate-600">•</span>
                              <span className={guest.payment_status === 'received' ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
                                {guest.payment_status === 'received' ? 'Paid' : 'Pending'}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: WHATSAPP 1-CLICK BROADCAST HUB */}
      {/* ========================================================================= */}
      {activeTab === 'whatsapp' && (
        <div className="space-y-4">
          {/* Header Banner */}
          <div className="bg-[#131F2E] p-5 rounded-2xl border border-[#223345] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-emerald-400" />
                1-Click WhatsApp Ticket & Pass Dispatcher
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Dispatch personalized concert E-Passes with high-res ticket images and entry QR barcodes directly to donors on WhatsApp.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <Input 
                  placeholder="Search guest or phone..." 
                  value={waSearch} 
                  onChange={e => setWaSearch(e.target.value)}
                  className="h-8 pl-8 text-xs bg-[#1A2839] border-[#2A3F55] text-white"
                />
              </div>

              <Select value={waSectionFilter} onValueChange={(v: any) => { if (v) setWaSectionFilter(v); }}>
                <SelectTrigger className="h-8 text-xs bg-[#1A2839] border-[#2A3F55] text-white w-36"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-[#131F2E] border-[#223345] text-white">
                  <SelectItem value="All">All Sections</SelectItem>
                  <SelectItem value="Ground Floor">Ground Floor</SelectItem>
                  <SelectItem value="Balcony">Balcony</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* WhatsApp Contacts Grid */}
          <div className="bg-[#131F2E] rounded-2xl border border-[#223345] shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-[#0E1724] border-b border-[#223345]">
                  <TableRow className="text-slate-400 text-xs">
                    <TableHead className="w-28 text-slate-300">Pass Code</TableHead>
                    <TableHead className="min-w-[160px] text-slate-300">Guest / Group Name</TableHead>
                    <TableHead className="w-36 text-slate-300">Phone Number</TableHead>
                    <TableHead className="min-w-[160px] text-slate-300">Seating Coordinates</TableHead>
                    <TableHead className="w-24 text-center text-slate-300">Payment</TableHead>
                    <TableHead className="text-right pr-6 text-slate-300">WhatsApp Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredWhatsAppGuests.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-16 text-slate-500 text-xs">
                        <div className="flex flex-col items-center justify-center space-y-2">
                          <MessageSquare className="w-8 h-8 text-slate-600" />
                          <p className="font-semibold text-slate-400">No guests with phone numbers found</p>
                          <p className="text-[11px] text-slate-500">
                            Go to Guests & Passes and add mobile phone numbers to enable 1-click WhatsApp messaging.
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredWhatsAppGuests.map(item => (
                      <TableRow key={item.passCode} className="hover:bg-[#1A2839]/60 transition-colors border-b border-[#1E2D3D]">
                        <TableCell className="font-mono font-bold text-xs text-amber-400">
                          {item.passCode}
                        </TableCell>
                        <TableCell className="font-semibold text-xs text-white">
                          {item.guestName}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-slate-300">
                          {item.phone}
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-slate-300">{item.section}</span>
                          <span className="font-mono text-xs text-amber-400 font-bold block">
                            Row {item.rows.join(', ')} • Seats {item.seatNumbers}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className={`text-[10px] ${
                            item.paymentStatus === 'received' 
                              ? 'border-emerald-800 text-emerald-300 bg-emerald-950/40' 
                              : 'border-amber-800 text-amber-300 bg-amber-950/40'
                          }`}>
                            {item.paymentStatus === 'received' ? '✓ Paid' : 'Pending'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right pr-6">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="xs"
                              variant="outline"
                              className="h-7 text-xs bg-[#1A2839] border-[#2A3F55] text-slate-300 hover:text-white"
                              onClick={() => {
                                const msg = formatWhatsAppMessage({
                                  guestName: item.guestName,
                                  phone: item.phone,
                                  passCode: item.passCode,
                                  section: item.section,
                                  rows: item.rows,
                                  seatNumbers: item.seatNumbers,
                                  totalSeats: item.totalSeats,
                                  paymentStatus: item.paymentStatus
                                });
                                navigator.clipboard.writeText(msg);
                                toast.success("WhatsApp message copied to clipboard!");
                              }}
                              title="Copy pre-formatted message text"
                            >
                              <Copy className="w-3 h-3 mr-1 text-slate-400" />
                              <span>Copy Text</span>
                            </Button>

                            <Button
                              size="xs"
                              className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1 shadow-sm"
                              onClick={() => openWhatsAppModal(item)}
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                              <span>Send WhatsApp</span>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      )}

      {/* DEDICATED WHATSAPP DISPATCH MODAL */}
      <Dialog open={waModalOpen} onOpenChange={setWaModalOpen}>
        <DialogContent className="sm:max-w-lg bg-[#131F2E] rounded-2xl border border-[#223345] text-white shadow-2xl">
          <DialogHeader className="border-b border-[#223345] pb-3">
            <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-emerald-400" />
              Send E-Pass via WhatsApp
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Pass Code: <span className="text-amber-400 font-mono font-bold">{waTargetItem?.passCode}</span> • {waTargetItem?.guestName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Phone Number Input */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-300">Donor Mobile Phone</Label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <Input 
                  placeholder="10-digit mobile (e.g. 9840012345)" 
                  value={waTargetItem?.phone || ''}
                  onChange={(e) => {
                    if (waTargetItem) {
                      setWaTargetItem({ ...waTargetItem, phone: e.target.value });
                    }
                  }}
                  className="pl-9 h-9 text-xs bg-[#1A2839] border-[#2A3F55] text-white font-mono"
                />
              </div>
            </div>

            {/* Live Message Preview */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-slate-300">Message Content Preview</Label>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(waModalMessage);
                    toast.success("Message text copied to clipboard!");
                  }}
                  className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-semibold"
                >
                  <Copy className="w-3 h-3" />
                  <span>Copy Text</span>
                </button>
              </div>
              <div className="p-3 bg-[#0E1724] rounded-xl border border-[#223345] text-[11px] text-slate-300 font-mono whitespace-pre-wrap max-h-40 overflow-y-auto leading-relaxed">
                {waModalMessage}
              </div>
            </div>

            {/* Quick Actions Strip */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-8 text-xs bg-[#1A2839] border-[#2A3F55] text-amber-300 hover:bg-[#24364A] gap-1"
                onClick={async () => {
                  if (waTargetItem) {
                    await downloadTicketImage(waTargetItem.seatId, waTargetItem.passCode);
                  }
                }}
              >
                <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
                <span>Download Image</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                className="h-8 text-xs bg-[#1A2839] border-[#2A3F55] text-slate-300 hover:bg-[#24364A] gap-1"
                onClick={async () => {
                  if (waTargetItem) {
                    await downloadTicketPdf(waTargetItem.seatId, waTargetItem.passCode);
                  }
                }}
              >
                <Download className="w-3.5 h-3.5 text-slate-400" />
                <span>Download PDF</span>
              </Button>
            </div>

            {/* Mobile Native Share Trigger */}
            <Button
              type="button"
              variant="outline"
              className="w-full h-8 text-xs bg-[#1A2839] border-emerald-800 text-emerald-300 hover:bg-emerald-950/60 gap-1.5 font-semibold"
              onClick={() => handleMobileNativeShare(waTargetItem)}
            >
              <Share2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>📱 Share Image directly to Mobile WhatsApp</span>
            </Button>
          </div>

          <DialogFooter className="gap-2 sm:gap-2 border-t border-[#223345] pt-3">
            <Button
              variant="outline"
              className="bg-[#1A2839] border-[#2A3F55] text-slate-300 text-xs"
              onClick={() => setWaModalOpen(false)}
            >
              Close
            </Button>

            {/* Direct, Unblockable Native Link Anchor to WhatsApp */}
            <a
              href={waDirectUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={async () => {
                if (waTargetItem) {
                  copyTicketImageToClipboard(waTargetItem.seatId, waTargetItem.passCode);
                  downloadTicketImage(waTargetItem.seatId, waTargetItem.passCode);
                }
                toast.success("Opening WhatsApp! Ticket image downloaded and copied to clipboard.");
                setWaModalOpen(false);
              }}
              className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-950/40 px-4 transition-colors"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Launch WhatsApp Chat</span>
              <ExternalLink className="w-3.5 h-3.5 ml-1 opacity-80" />
            </a>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
