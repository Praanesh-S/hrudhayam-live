'use client';

import { useState } from 'react';
import Link from 'next/link';
import { 
  Building2, 
  Plus, 
  Trash2, 
  Edit3, 
  Printer, 
  Tag, 
  ExternalLink, 
  Users, 
  Ticket, 
  AlertTriangle,
  CheckCircle2,
  X,
  Phone,
  Mail,
  Search
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
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { toast } from 'sonner';
import { SPONSOR_TIERS, formatSponsorTier, getSponsorTierColor, type SponsorTierValue } from '@/lib/sponsor-constants';
import { formatINR } from '@/lib/constants';
import type { Sponsor, SponsorTier, Seat } from '@/lib/types';
import { 
  createSponsor, 
  updateSponsor, 
  deleteSponsor, 
  tagSeatsToSponsor, 
  untagSeatsFromSponsor 
} from './actions';

interface SponsorClientProps {
  sponsors: (Sponsor & { taggedSeatsCount?: number })[];
  seats: Seat[];
}

export function SponsorClient({ sponsors: initialSponsors, seats }: SponsorClientProps) {
  const [sponsors, setSponsors] = useState(initialSponsors);
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState<string>('all');
  
  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSponsor, setEditingSponsor] = useState<Sponsor | null>(null);
  const [name, setName] = useState('');
  const [tier, setTier] = useState<SponsorTierValue>('gold_sponsor');
  const [passCount, setPassCount] = useState('2');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Seat Tagging Modal state
  const [tagModalOpen, setTagModalOpen] = useState(false);
  const [selectedSponsorForTagging, setSelectedSponsorForTagging] = useState<Sponsor | null>(null);
  const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>([]);
  const [seatSearch, setSeatSearch] = useState('');

  // Map seats to sponsor
  const seatsBySponsor = new Map<string, Seat[]>();
  for (const s of seats) {
    if (s.sponsor_id) {
      const list = seatsBySponsor.get(s.sponsor_id) || [];
      list.push(s);
      seatsBySponsor.set(s.sponsor_id, list);
    }
  }

  // Open Create Dialog
  const openCreateDialog = () => {
    setEditingSponsor(null);
    setName('');
    setTier('gold_sponsor');
    setPassCount('2');
    setContactName('');
    setContactPhone('');
    setContactEmail('');
    setNotes('');
    setDialogOpen(true);
  };

  // Open Edit Dialog
  const openEditDialog = (sponsor: Sponsor) => {
    setEditingSponsor(sponsor);
    setName(sponsor.name);
    setTier(sponsor.sponsor_tier as SponsorTierValue);
    setPassCount(String(sponsor.complimentary_pass_count));
    setContactName(sponsor.contact_name || '');
    setContactPhone(sponsor.contact_phone || '');
    setContactEmail(sponsor.contact_email || '');
    setNotes(sponsor.notes || '');
    setDialogOpen(true);
  };

  // Save Sponsor (Create or Update)
  const handleSaveSponsor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Sponsor name is required');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        sponsor_tier: tier as SponsorTier,
        complimentary_pass_count: parseInt(passCount, 10) || 0,
        contact_name: contactName,
        contact_phone: contactPhone,
        contact_email: contactEmail,
        notes,
      };

      if (editingSponsor) {
        const res = await updateSponsor(editingSponsor.id, payload);
        if (res.error) throw new Error(res.error);
        toast.success(`Sponsor "${name}" updated`);
      } else {
        const res = await createSponsor(payload);
        if (res.error) throw new Error(res.error);
        toast.success(`Sponsor "${name}" created`);
      }
      setDialogOpen(false);
      window.location.reload();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save sponsor');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Sponsor
  const handleDeleteSponsor = async (sponsor: Sponsor) => {
    if (!confirm(`Are you sure you want to delete sponsor "${sponsor.name}"? Tagged seats will be untagged.`)) {
      return;
    }

    try {
      const res = await deleteSponsor(sponsor.id);
      if (res.error) throw new Error(res.error);
      toast.success(`Sponsor "${sponsor.name}" deleted`);
      setSponsors(s => s.filter(x => x.id !== sponsor.id));
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete sponsor');
    }
  };

  // Open Tagging Modal
  const openTagModal = (sponsor: Sponsor) => {
    setSelectedSponsorForTagging(sponsor);
    const alreadyTagged = seats.filter(s => s.sponsor_id === sponsor.id).map(s => s.id);
    setSelectedSeatIds(alreadyTagged);
    setTagModalOpen(true);
  };

  // Save Tagged Seats
  const handleSaveTagging = async () => {
    if (!selectedSponsorForTagging) return;
    setIsSubmitting(true);

    try {
      // 1. Untag seats that were unselected
      const previousTagged = seats.filter(s => s.sponsor_id === selectedSponsorForTagging.id).map(s => s.id);
      const toUntag = previousTagged.filter(id => !selectedSeatIds.includes(id));
      if (toUntag.length > 0) {
        await untagSeatsFromSponsor(toUntag);
      }

      // 2. Tag newly selected seats
      const toTag = selectedSeatIds.filter(id => !previousTagged.includes(id));
      if (toTag.length > 0) {
        await tagSeatsToSponsor(toTag, selectedSponsorForTagging.id);
      }

      // Check for soft warning if tagged exceeds complimentary pass count
      if (selectedSeatIds.length > selectedSponsorForTagging.complimentary_pass_count) {
        toast.warning(
          `Notice: ${selectedSeatIds.length} seats tagged, which exceeds complimentary allocation of ${selectedSponsorForTagging.complimentary_pass_count}.`,
          { duration: 5000 }
        );
      } else {
        toast.success(`Updated seat assignments for ${selectedSponsorForTagging.name}`);
      }

      setTagModalOpen(false);
      window.location.reload();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update tagged seats');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered sponsors
  const filteredSponsors = sponsors.filter(s => {
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) ||
                        (s.contact_name && s.contact_name.toLowerCase().includes(search.toLowerCase()));
    const matchTier = tierFilter === 'all' || s.sponsor_tier === tierFilter;
    return matchSearch && matchTier;
  });

  return (
    <div className="space-y-6">
      {/* 1. Header with KPI & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <Building2 className="w-6 h-6 text-[#E8913A]" />
            Sponsors & Corporate Partners
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Manage corporate sponsorships, complimentary passes, and tag physical seats.
          </p>
        </div>

        <Button 
          onClick={openCreateDialog}
          className="bg-[#E8913A] hover:bg-[#D97706] text-slate-950 font-bold text-xs shadow-md shadow-amber-950/20"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Add New Sponsor
        </Button>
      </div>

      {/* 2. Filters Bar */}
      <Card className="bg-[#131F2E] border-[#223345] rounded-2xl p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search sponsor or contact..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-9 text-xs bg-[#1A2839] border-[#2A3F55] text-white"
            />
          </div>

          <div>
            <Select value={tierFilter} onValueChange={v => v && setTierFilter(v)}>
              <SelectTrigger className="h-9 text-xs bg-[#1A2839] border-[#2A3F55] text-white">
                <SelectValue placeholder="Filter by Tier" />
              </SelectTrigger>
              <SelectContent className="bg-[#131F2E] border-[#223345] text-white">
                <SelectItem value="all">All Tiers ({sponsors.length})</SelectItem>
                {SPONSOR_TIERS.map(t => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label} ({formatINR(t.amount)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-end text-xs text-slate-400">
            Showing <strong className="text-white mx-1">{filteredSponsors.length}</strong> of {sponsors.length} sponsors
          </div>
        </div>
      </Card>

      {/* 3. Sponsors Table */}
      <Card className="bg-[#131F2E] border-[#223345] rounded-2xl shadow-xl overflow-hidden">
        <Table>
          <TableHeader className="bg-[#0E1724]">
            <TableRow className="border-[#223345]">
              <TableHead className="text-slate-300 font-semibold">Sponsor Name</TableHead>
              <TableHead className="text-slate-300 font-semibold">Sponsorship Tier</TableHead>
              <TableHead className="text-slate-300 font-semibold text-center">Complimentary Passes</TableHead>
              <TableHead className="text-slate-300 font-semibold text-center">Tagged Seats</TableHead>
              <TableHead className="text-slate-300 font-semibold">Contact Details</TableHead>
              <TableHead className="text-slate-300 font-semibold text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSponsors.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-slate-400">
                  No sponsors found. Click "Add New Sponsor" to register one.
                </TableCell>
              </TableRow>
            ) : (
              filteredSponsors.map(sponsor => {
                const taggedSeats = seatsBySponsor.get(sponsor.id) || [];
                const taggedCount = taggedSeats.length;
                const isOverLimit = taggedCount > sponsor.complimentary_pass_count;
                const tierInfo = SPONSOR_TIERS.find(t => t.value === sponsor.sponsor_tier);

                return (
                  <TableRow key={sponsor.id} className="border-[#223345] hover:bg-[#1A2839]/60 transition-colors">
                    <TableCell className="font-bold text-white">
                      <div>{sponsor.name}</div>
                      {sponsor.notes && (
                        <span className="text-[10px] text-slate-400 block truncate max-w-xs">{sponsor.notes}</span>
                      )}
                    </TableCell>

                    <TableCell>
                      <Badge 
                        className="text-xs font-semibold"
                        style={{
                          backgroundColor: `${tierInfo?.color || '#475569'}20`,
                          color: tierInfo?.color || '#E2E8F0',
                          border: `1px solid ${tierInfo?.color || '#475569'}60`
                        }}
                      >
                        {tierInfo?.label || sponsor.sponsor_tier}
                        {tierInfo?.amount ? ` • ${formatINR(tierInfo.amount)}` : ''}
                      </Badge>
                    </TableCell>

                    <TableCell className="text-center font-mono font-bold text-white">
                      {sponsor.complimentary_pass_count}
                    </TableCell>

                    <TableCell className="text-center">
                      <div className="inline-flex items-center gap-1.5">
                        <span className={`font-mono font-bold text-xs px-2 py-0.5 rounded-md ${
                          isOverLimit 
                            ? 'bg-amber-950 text-amber-300 border border-amber-700' 
                            : taggedCount > 0 
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' 
                            : 'bg-slate-800 text-slate-400'
                        }`}>
                          {taggedCount} / {sponsor.complimentary_pass_count}
                        </span>
                        {isOverLimit && (
                          <span title="Exceeds complimentary pass count">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                          </span>
                        )}
                      </div>
                    </TableCell>

                    <TableCell className="text-xs text-slate-300">
                      {sponsor.contact_name ? (
                        <div>
                          <div className="font-medium text-white">{sponsor.contact_name}</div>
                          <div className="text-[11px] text-slate-400">
                            {sponsor.contact_phone} {sponsor.contact_email && `• ${sponsor.contact_email}`}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-500 italic">No contact info</span>
                      )}
                    </TableCell>

                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-1">
                        <Button
                          size="xs"
                          variant="outline"
                          className="bg-[#1A2839] border-[#2A3F55] hover:bg-[#223345] text-amber-300 text-xs"
                          onClick={() => openTagModal(sponsor)}
                          title="Tag Seats"
                        >
                          <Tag className="w-3 h-3 mr-1" />
                          Tag Seats
                        </Button>

                        <Link href={`/admin/sponsors/${sponsor.id}/print`} target="_blank">
                          <Button
                            size="xs"
                            variant="outline"
                            className="bg-[#1A2839] border-[#2A3F55] hover:bg-[#223345] text-slate-300 text-xs"
                            title="Printable Pass Allocation Summary"
                          >
                            <Printer className="w-3 h-3" />
                          </Button>
                        </Link>

                        <Button
                          size="xs"
                          variant="ghost"
                          className="text-slate-400 hover:text-white"
                          onClick={() => openEditDialog(sponsor)}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </Button>

                        <Button
                          size="xs"
                          variant="ghost"
                          className="text-red-400 hover:text-red-300 hover:bg-red-950/40"
                          onClick={() => handleDeleteSponsor(sponsor)}
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

      {/* 4. Create / Edit Sponsor Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-[#131F2E] border-[#223345] text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-white">
              {editingSponsor ? `Edit Sponsor: ${editingSponsor.name}` : 'Add New Corporate Sponsor'}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Configure sponsor details and complimentary pass entitlement.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveSponsor} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-300 font-medium">Sponsor Name *</Label>
              <Input
                required
                placeholder="e.g. Acme Corp / Tata Group"
                value={name}
                onChange={e => setName(e.target.value)}
                className="bg-[#1A2839] border-[#2A3F55] text-white text-xs h-9"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300 font-medium">Sponsorship Tier *</Label>
                <Select value={tier} onValueChange={v => v && setTier(v as SponsorTierValue)}>
                  <SelectTrigger className="bg-[#1A2839] border-[#2A3F55] text-white text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#131F2E] border-[#223345] text-white">
                    {SPONSOR_TIERS.map(t => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label} ({formatINR(t.amount)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300 font-medium">
                  Complimentary Passes *
                </Label>
                <Input
                  type="number"
                  min="0"
                  required
                  value={passCount}
                  onChange={e => setPassCount(e.target.value)}
                  className="bg-[#1A2839] border-[#2A3F55] text-white text-xs h-9 font-mono"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-300 font-medium">Contact Person Name</Label>
              <Input
                placeholder="e.g. Rajesh Kumar"
                value={contactName}
                onChange={e => setContactName(e.target.value)}
                className="bg-[#1A2839] border-[#2A3F55] text-white text-xs h-9"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300 font-medium">Phone</Label>
                <Input
                  placeholder="e.g. 9876543210"
                  value={contactPhone}
                  onChange={e => setContactPhone(e.target.value)}
                  className="bg-[#1A2839] border-[#2A3F55] text-white text-xs h-9"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300 font-medium">Email</Label>
                <Input
                  type="email"
                  placeholder="contact@sponsor.com"
                  value={contactEmail}
                  onChange={e => setContactEmail(e.target.value)}
                  className="bg-[#1A2839] border-[#2A3F55] text-white text-xs h-9"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-300 font-medium">Notes / Internal Remarks</Label>
              <Input
                placeholder="Optional notes regarding branding, stalls, etc."
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
                {editingSponsor ? 'Save Changes' : 'Create Sponsor'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 5. Seat Tagging Modal */}
      <Dialog open={tagModalOpen} onOpenChange={setTagModalOpen}>
        <DialogContent className="bg-[#131F2E] border-[#223345] text-white max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
              <Tag className="w-5 h-5 text-[#E8913A]" />
              Tag Seats to Sponsor: {selectedSponsorForTagging?.name}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Select which physical seats are allocated to this sponsor (Complimentary: {selectedSponsorForTagging?.complimentary_pass_count} seats).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 flex-1 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between gap-3">
              <Input
                placeholder="Filter seats by ID (e.g. GF-A or BAL-C)..."
                value={seatSearch}
                onChange={e => setSeatSearch(e.target.value.toUpperCase())}
                className="bg-[#1A2839] border-[#2A3F55] text-white text-xs h-9"
              />
              <Badge className="bg-[#1A2839] text-amber-300 border-[#2A3F55] text-xs font-mono shrink-0">
                Selected: {selectedSeatIds.length} seats
              </Badge>
            </div>

            {/* Quick Multi-select grid */}
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
                        const isOtherSponsor = seat.sponsor_id && seat.sponsor_id !== selectedSponsorForTagging?.id;

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
                                : isOtherSponsor
                                ? 'bg-purple-950/60 text-purple-300 border border-purple-800/40'
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
              onClick={() => setTagModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSaveTagging}
              disabled={isSubmitting}
              className="bg-[#E8913A] hover:bg-[#D97706] text-slate-950 font-bold text-xs"
            >
              Save Tagged Seats ({selectedSeatIds.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
