'use client';

import { useState, useTransition } from 'react';
import { updateGuest, togglePayment, sendTicket, updateGuestGroup } from './actions';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Loader2, 
  AlertCircle, 
  Download, 
  Send, 
  CheckCircle2, 
  Search, 
  Filter, 
  Ticket,
  Mail,
  Phone,
  User,
  Clock
} from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import { formatINR } from '@/lib/constants';

const emailSchema = z.string().email().optional().or(z.literal(''));
const phoneSchema = z.string().regex(/^\d{10}$/, 'Enter a 10-digit mobile number').optional().or(z.literal(''));
const nameSchema = z.string().max(100).optional().or(z.literal(''));

type Seat = {
  id: string;
  section: string;
  row_label: string;
  seat_no: string;
  tier: number | null;
  owner_id: string | null;
  guest_name: string | null;
  guest_email: string | null;
  guest_phone: string | null;
  pass_code?: string | null;
  ticket_sent: boolean;
  payment_status: 'pending' | 'received';
};

function EditableCell({ 
  value, 
  onSave, 
  placeholder,
  type = 'text',
  schema,
  disabled = false,
}: { 
  value: string | null, 
  onSave: (val: string) => void, 
  placeholder: string,
  type?: string,
  schema: z.ZodTypeAny,
  disabled?: boolean,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [val, setVal] = useState(value || '');
  const [error, setError] = useState('');

  const handleSave = () => {
    try {
      if (val !== value) {
        schema.parse(val);
        onSave(val);
      }
      setIsEditing(false);
      setError('');
    } catch (e) {
      if (e instanceof z.ZodError) {
        setError(e.issues?.[0]?.message || (e as any).errors?.[0]?.message || 'Invalid format');
      }
    }
  };

  if (disabled) {
    return (
      <span className="text-xs text-slate-300 font-medium">
        {value || <span className="text-slate-600 italic font-normal">{placeholder}</span>}
      </span>
    );
  }

  if (isEditing) {
    return (
      <div className="flex flex-col gap-1">
        <Input 
          autoFocus
          type={type}
          value={val}
          onChange={e => setVal(e.target.value)}
          onBlur={handleSave}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
          className="h-7 text-xs w-full min-w-[120px] bg-[#1A2839] border-amber-500 text-white"
        />
        {error && <span className="text-[10px] text-red-400 font-medium">{error}</span>}
      </div>
    );
  }

  return (
    <div 
      className="cursor-pointer min-h-[28px] flex items-center px-2 hover:bg-[#1A2839] hover:border-[#2C4056] border border-transparent rounded-md transition-colors text-xs text-slate-200 font-medium"
      onClick={() => setIsEditing(true)}
      title="Click to edit"
    >
      {value || <span className="text-slate-500 italic font-normal">{placeholder}</span>}
    </div>
  );
}

export function GuestsClient({ 
  initialSeats, 
  userRole, 
  userId 
}: { 
  initialSeats: Seat[], 
  userRole: string, 
  userId: string 
}) {
  const [seats, setSeats] = useState<Seat[]>(initialSeats);

  const [selectedSeats, setSelectedSeats] = useState<Set<string>>(new Set());
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkName, setBulkName] = useState('');
  const [bulkEmail, setBulkEmail] = useState('');
  const [bulkPhone, setBulkPhone] = useState('');

  const toggleSelectAll = () => {
    if (selectedSeats.size === filteredSeats.length) {
      setSelectedSeats(new Set());
    } else {
      setSelectedSeats(new Set(filteredSeats.map(s => s.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedSeats);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedSeats(newSet);
  };

  const handleBulkAssign = async () => {
    try {
      nameSchema.parse(bulkName);
      emailSchema.parse(bulkEmail);
      phoneSchema.parse(bulkPhone);
    } catch (e: any) {
      toast.error("Validation error", { description: "Please check your inputs." });
      return;
    }
    
    startTransition(async () => {
      try {
        await updateGuestGroup(Array.from(selectedSeats), { 
          guest_name: bulkName, 
          guest_email: bulkEmail, 
          guest_phone: bulkPhone 
        });
        toast.success("Group assigned successfully");
        setShowBulkModal(false);
        setSelectedSeats(new Set());
        setBulkName(''); setBulkEmail(''); setBulkPhone('');
      } catch (err: any) {
        toast.error("Failed to group assign", { description: err.message });
      }
    });
  };

  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState('');
  const [sectionFilter, setSectionFilter] = useState<'All' | 'Ground Floor' | 'Balcony'>('All');
  const [paymentFilter, setPaymentFilter] = useState<'All' | 'pending' | 'received'>('All');
  const [generatingPdfId, setGeneratingPdfId] = useState<string | null>(null);

  const getTierBadge = (tier: number | null) => {
    if (tier === 5000) return <Badge className="bg-[#B8860B]/30 text-[#FACC15] border border-[#B8860B]/60 text-[10px] font-mono font-bold">₹5,000</Badge>;
    if (tier === 3000) return <Badge className="bg-[#0D9488]/30 text-[#2DD4BF] border border-[#0D9488]/60 text-[10px] font-mono font-bold">₹3,000</Badge>;
    if (tier === 1500) return <Badge className="bg-slate-800 text-slate-300 border border-slate-600 text-[10px] font-mono font-bold">₹1,500</Badge>;
    return <Badge variant="outline" className="text-purple-400 border-purple-800/60 bg-purple-950/30 text-[10px]">VIP</Badge>;
  };

  const handleUpdate = async (id: string, field: 'guest_name' | 'guest_email' | 'guest_phone', val: string) => {
    startTransition(async () => {
      try {
        const updated = await updateGuest(id, { [field]: val });
        setSeats(prev => prev.map(s => s.id === id ? { ...s, ...updated } : s));
        toast.success('Guest details saved');
      } catch (err: any) {
        toast.error(err.message || 'Failed to update guest');
      }
    });
  };

  const handlePaymentToggle = async (id: string, current: string) => {
    startTransition(async () => {
      try {
        const newStatus = current === 'pending' ? 'received' : 'pending';
        await togglePayment(id, newStatus);
        setSeats(prev => prev.map(s => s.id === id ? { ...s, payment_status: newStatus } : s));
        toast.success(`Payment marked as ${newStatus}`);
      } catch (err: any) {
        toast.error(err.message || 'Failed to update payment');
      }
    });
  };

  const handleSendTicket = async (id: string) => {
    startTransition(async () => {
      try {
        await sendTicket(id);
        setSeats(prev => prev.map(s => s.id === id ? { ...s, ticket_sent: true } : s));
        toast.success('E-Ticket sent via email with PDF attachment!');
      } catch (err: any) {
        toast.error(err.message || 'Failed to send ticket');
      }
    });
  };

  const handleDownloadPdf = async (seatId: string) => {
    setGeneratingPdfId(seatId);
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
      a.download = `Hrudhayam-Ticket-${seatId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Ticket PDF downloaded');
    } catch (err: any) {
      toast.error(err.message || 'Failed to download PDF ticket');
    } finally {
      setGeneratingPdfId(null);
    }
  };

  const filteredSeats = seats.filter(s => {
    const match = search.toLowerCase();
    const matchesSearch = (s.guest_name || '').toLowerCase().includes(match) ||
      (s.guest_email || '').toLowerCase().includes(match) ||
      (s.guest_phone || '').toLowerCase().includes(match) ||
      s.id.toLowerCase().includes(match);

    const matchesSection = sectionFilter === 'All' || s.section === sectionFilter;
    const matchesPayment = paymentFilter === 'All' || s.payment_status === paymentFilter;

    return matchesSearch && matchesSection && matchesPayment;
  });

  const getDuplicates = () => {
    const emails = new Set<string>();
    const dupEmails = new Set<string>();
    const phones = new Set<string>();
    const dupPhones = new Set<string>();

    seats.forEach(s => {
      if (s.guest_email) {
        if (emails.has(s.guest_email)) dupEmails.add(s.guest_email);
        emails.add(s.guest_email);
      }
      if (s.guest_phone) {
        if (phones.has(s.guest_phone)) dupPhones.add(s.guest_phone);
        phones.add(s.guest_phone);
      }
    });
    return { dupEmails, dupPhones };
  };

  const { dupEmails, dupPhones } = getDuplicates();

  return (
    <div className="space-y-5">
      {/* Search & Filter Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-[#131F2E] p-4 rounded-2xl border border-[#223345] shadow-xs">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <Input 
              placeholder="Search by seat ID, guest name, email, or phone..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-9 text-xs bg-[#1A2839] border-[#2A3F55] text-white"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
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

      {/* Guests Table */}
      
        {selectedSeats.size > 1 && (
          <div className="bg-[#1A2839] p-3 rounded-lg flex items-center justify-between mb-4 border border-amber-500/30">
            <span className="text-amber-400 font-medium text-sm">
              {selectedSeats.size} seats selected
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="bg-[#0B131E] border-slate-700 text-white hover:bg-slate-800" onClick={() => setSelectedSeats(new Set())}>Cancel</Button>
              <Button size="sm" className="bg-[#E8913A] hover:bg-[#D97706] text-slate-950 font-bold" onClick={() => setShowBulkModal(true)}>
                Group Assign (1 QR)
              </Button>
            </div>
          </div>
        )}

        {showBulkModal && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-[#0F2B3C] border border-[#1E3A4C] p-6 rounded-xl max-w-md w-full">
              <h3 className="text-lg font-bold text-white mb-4">Assign {selectedSeats.size} Seats to Group</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-slate-300 font-medium mb-1 block">Group / Primary Name *</label>
                  <Input value={bulkName} onChange={e => setBulkName(e.target.value)} className="bg-[#1A2839] border-[#2A3F55] text-white" />
                </div>
                <div>
                  <label className="text-xs text-slate-300 font-medium mb-1 block">Primary Email (Optional)</label>
                  <Input type="email" value={bulkEmail} onChange={e => setBulkEmail(e.target.value)} className="bg-[#1A2839] border-[#2A3F55] text-white" />
                </div>
                <div>
                  <label className="text-xs text-slate-300 font-medium mb-1 block">Primary Phone (Optional)</label>
                  <Input type="tel" value={bulkPhone} onChange={e => setBulkPhone(e.target.value)} className="bg-[#1A2839] border-[#2A3F55] text-white" />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button className="flex-1" variant="outline" onClick={() => setShowBulkModal(false)}>Cancel</Button>
                  <Button className="flex-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold" disabled={isPending} onClick={handleBulkAssign}>
                    {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Assign & Generate QR"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

      <div className="bg-[#131F2E] rounded-2xl border border-[#223345] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-[#0E1724] border-b border-[#223345]">
              <TableRow className="text-slate-400 text-xs">
                <TableHead className="w-10"><input type="checkbox" checked={selectedSeats.size > 0 && selectedSeats.size === filteredSeats.length} onChange={toggleSelectAll} className="w-4 h-4 accent-amber-500 rounded border-slate-600 bg-[#1A2839]" /></TableHead>
                <TableHead className="w-24 text-slate-300">Seat ID</TableHead>
                <TableHead className="w-16 text-slate-300">Row</TableHead>
                <TableHead className="w-16 text-slate-300">Seat#</TableHead>
                <TableHead className="w-24 text-slate-300">Tier</TableHead>
                <TableHead className="min-w-[150px] text-slate-300">Guest Name</TableHead>
                <TableHead className="min-w-[180px] text-slate-300">Guest Email</TableHead>
                <TableHead className="min-w-[130px] text-slate-300">Mobile Phone</TableHead>
                <TableHead className="w-28 text-center text-slate-300">Payment</TableHead>
                <TableHead className="min-w-[170px] text-right pr-6 text-slate-300">E-Ticket Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSeats.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12 text-slate-500 text-xs">
                    No seats match your search or filter.
                  </TableCell>
                </TableRow>
              ) : (
                filteredSeats.map(seat => {
                  const canEdit = userRole === 'super_admin' || seat.owner_id === userId;
                  const hasDupEmail = seat.guest_email && dupEmails.has(seat.guest_email);
                  const hasDupPhone = seat.guest_phone && dupPhones.has(seat.guest_phone);
                  const hasGuest = seat.guest_name && seat.guest_name.trim() !== '';

                  return (
                    <TableRow key={seat.id} className="hover:bg-[#1A2839]/60 transition-colors border-b border-[#1E2D3D]">
                      <TableCell><input type="checkbox" checked={selectedSeats.has(seat.id)} onChange={() => toggleSelect(seat.id)} className="w-4 h-4 accent-amber-500 rounded border-slate-600 bg-[#1A2839]" disabled={!canEdit} /></TableCell>
                      <TableCell className="font-mono font-bold text-xs text-white">
                        {seat.id}
                      </TableCell>
                      <TableCell className="font-mono font-semibold text-xs text-amber-400">
                        {seat.row_label}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-slate-400">
                        {seat.seat_no}
                      </TableCell>
                      <TableCell>
                        {getTierBadge(seat.tier)}
                      </TableCell>
                      <TableCell>
                        <EditableCell 
                          value={seat.guest_name} 
                          onSave={(val) => handleUpdate(seat.id, 'guest_name', val)} 
                          placeholder="Click to add name"
                          schema={nameSchema}
                          disabled={!canEdit}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <EditableCell 
                            value={seat.guest_email} 
                            onSave={(val) => handleUpdate(seat.id, 'guest_email', val)} 
                            placeholder="Add email"
                            type="email"
                            schema={emailSchema}
                            disabled={!canEdit}
                          />
                          {hasDupEmail && (
                            <span title="Duplicate email across multiple passes" className="text-amber-400 shrink-0">
                              <AlertCircle className="w-3.5 h-3.5" />
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <EditableCell 
                            value={seat.guest_phone} 
                            onSave={(val) => handleUpdate(seat.id, 'guest_phone', val)} 
                            placeholder="Add phone"
                            type="tel"
                            schema={phoneSchema}
                            disabled={!canEdit}
                          />
                          {hasDupPhone && (
                            <span title="Duplicate phone across multiple passes" className="text-amber-400 shrink-0">
                              <AlertCircle className="w-3.5 h-3.5" />
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            disabled={!canEdit || isPending}
                            onClick={() => handlePaymentToggle(seat.id, seat.payment_status)}
                            className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all ${
                              seat.payment_status === 'received'
                                ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800 hover:bg-emerald-900'
                                : 'bg-amber-950/80 text-amber-300 border border-amber-800 hover:bg-amber-900'
                            }`}
                          >
                            {seat.payment_status === 'received' ? '✓ Paid' : 'Pending'}
                          </button>
                        </div>
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Download PDF Button */}
                          <Button
                            size="xs"
                            variant="outline"
                            className="h-7 px-2 text-slate-300 bg-[#1A2839] border-[#2A3F55] hover:bg-[#24364A] hover:text-white text-[11px] gap-1"
                            disabled={!hasGuest || generatingPdfId === seat.id}
                            onClick={() => handleDownloadPdf(seat.id)}
                            title="Download printable A6 concert e-pass PDF"
                          >
                            {generatingPdfId === seat.id ? (
                              <Loader2 className="w-3 h-3 animate-spin text-[#E8913A]" />
                            ) : (
                              <Download className="w-3 h-3 text-slate-400" />
                            )}
                            <span>PDF</span>
                          </Button>

                          {/* Send Email Button */}
                          <Button 
                            size="xs"
                            variant={seat.ticket_sent ? "outline" : "default"}
                            className={`h-7 px-2.5 text-[11px] gap-1 font-medium ${
                              seat.ticket_sent 
                                ? 'border-emerald-800 text-emerald-300 bg-emerald-950/60 hover:bg-emerald-900/80' 
                                : 'bg-[#E8913A] hover:bg-[#D97706] text-slate-950 font-bold shadow-xs'
                            }`}
                            disabled={!canEdit || !hasGuest || !seat.guest_email || isPending}
                            onClick={() => handleSendTicket(seat.id)}
                          >
                            {isPending ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : seat.ticket_sent ? (
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Send className="w-3 h-3" />
                            )}
                            <span>{seat.ticket_sent ? 'Resend' : 'Send'}</span>
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
  );
}
