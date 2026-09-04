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
import type { Sponsor, SponsorTier, Sale } from '@/lib/types';
import { 
  createSponsor, 
  updateSponsor, 
  deleteSponsor, 
  tagSalesToSponsor, 
  untagSalesFromSponsor 
} from './actions';

interface SponsorClientProps {
  sponsors: (Sponsor & { taggedSeatsCount?: number })[];
  sales: Sale[];
}

export function SponsorClient({ sponsors: initialSponsors, sales }: SponsorClientProps) {
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

  // Tagging Modal state
  const [tagModalOpen, setTagModalOpen] = useState(false);
  const [selectedSponsorForTagging, setSelectedSponsorForTagging] = useState<Sponsor | null>(null);
  const [selectedSaleIds, setSelectedSaleIds] = useState<string[]>([]);
  const [saleSearch, setSaleSearch] = useState('');

  // Map sales to sponsor
  const salesBySponsor = new Map<string, Sale[]>();
  for (const s of sales) {
    if (s.sponsor_id) {
      const list = salesBySponsor.get(s.sponsor_id) || [];
      list.push(s);
      salesBySponsor.set(s.sponsor_id, list);
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

  // Save Sponsor
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
    if (!confirm(`Are you sure you want to delete sponsor "${sponsor.name}"? Tagged passes will be untagged.`)) {
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
    const alreadyTagged = sales.filter(s => s.sponsor_id === sponsor.id).map(s => s.id);
    setSelectedSaleIds(alreadyTagged);
    setTagModalOpen(true);
  };

  // Save Tagged Sales
  const handleSaveTagging = async () => {
    if (!selectedSponsorForTagging) return;
    setIsSubmitting(true);

    try {
      const previousTagged = sales.filter(s => s.sponsor_id === selectedSponsorForTagging.id).map(s => s.id);
      const toUntag = previousTagged.filter(id => !selectedSaleIds.includes(id));
      if (toUntag.length > 0) {
        await untagSalesFromSponsor(toUntag);
      }

      const toTag = selectedSaleIds.filter(id => !previousTagged.includes(id));
      if (toTag.length > 0) {
        await tagSalesToSponsor(toTag, selectedSponsorForTagging.id);
      }

      if (selectedSaleIds.length > selectedSponsorForTagging.complimentary_pass_count) {
        toast.warning(
          `Notice: ${selectedSaleIds.length} passes tagged, which exceeds complimentary allocation of ${selectedSponsorForTagging.complimentary_pass_count}.`,
          { duration: 5000 }
        );
      } else {
        toast.success(`Updated pass assignments for ${selectedSponsorForTagging.name}`);
      }

      setTagModalOpen(false);
      window.location.reload();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update tagged passes');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter sponsors
  const filteredSponsors = sponsors.filter(s => {
    const matchesSearch = 
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.contact_name && s.contact_name.toLowerCase().includes(search.toLowerCase()));
    const matchesTier = tierFilter === 'all' || s.sponsor_tier === tierFilter;
    return matchesSearch && matchesTier;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* 1. Header & Create Button */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#131F2E] p-5 rounded-2xl border border-[#223345] shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Building2 className="w-5 h-5 text-[#E8913A]" />
            <span>Corporate Sponsors & Complimentary Passes</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Manage event sponsors, track complimentary pass quotas, and tag donor passes.
          </p>
        </div>

        <Button
          onClick={openCreateDialog}
          className="bg-[#E8913A] hover:bg-[#D97706] text-slate-950 font-bold text-xs rounded-xl shadow-xs gap-1.5"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Sponsor</span>
        </Button>
      </div>

      {/* 2. Filters & Search */}
      <Card className="bg-[#131F2E] border-[#223345] rounded-2xl p-4 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative sm:col-span-2">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search by sponsor or contact name..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 bg-[#1A2839] border-[#2A3F55] text-white text-xs h-9"
            />
          </div>

          <div>
            <Select value={tierFilter} onValueChange={(val) => val && setTierFilter(val)}>
              <SelectTrigger className="bg-[#1A2839] border-[#2A3F55] text-white text-xs h-9">
                <SelectValue placeholder="All Tiers" />
              </SelectTrigger>
              <SelectContent className="bg-[#131F2E] border-[#223345] text-white">
                <SelectItem value="all">All Tiers</SelectItem>
                {SPONSOR_TIERS.map(t => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label} ({formatINR(t.amount)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* 3. Sponsors Table */}
      <Card className="bg-[#131F2E] border-[#223345] rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-[#0E1724] border-b border-[#223345]">
              <TableRow className="text-slate-400 text-xs">
                <TableHead className="text-slate-300">Sponsor Name</TableHead>
                <TableHead className="text-slate-300">Sponsor Tier</TableHead>
                <TableHead className="text-slate-300">Complimentary Pass Quota</TableHead>
                <TableHead className="text-slate-300">Passes Tagged</TableHead>
                <TableHead className="text-slate-300">Primary Contact</TableHead>
                <TableHead className="text-right pr-6 text-slate-300">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSponsors.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-slate-500 text-xs">
                    No sponsors matching filters. Click &quot;Add New Sponsor&quot; to create one.
                  </TableCell>
                </TableRow>
              ) : (
                filteredSponsors.map(sponsor => {
                  const taggedSales = salesBySponsor.get(sponsor.id) || [];
                  const taggedCount = taggedSales.length;
                  const isOverQuota = taggedCount > sponsor.complimentary_pass_count;

                  return (
                    <tr key={sponsor.id} className="border-b border-[#1E2D3D] hover:bg-[#1A2839]/60 text-xs">
                      <TableCell className="font-bold text-white">
                        {sponsor.name}
                        {sponsor.notes && (
                          <span className="block text-[10px] text-slate-500 font-normal mt-0.5">
                            {sponsor.notes}
                          </span>
                        )}
                      </TableCell>

                      <TableCell>
                        <Badge className={`${getSponsorTierColor(sponsor.sponsor_tier)} text-[10px] font-bold`}>
                          {formatSponsorTier(sponsor.sponsor_tier)}
                        </Badge>
                      </TableCell>

                      <TableCell className="font-mono text-white font-bold">
                        {sponsor.complimentary_pass_count} passes
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <span className={`font-mono font-bold ${isOverQuota ? 'text-amber-400' : 'text-white'}`}>
                            {taggedCount} / {sponsor.complimentary_pass_count}
                          </span>
                          {isOverQuota && (
                            <span title="Over quota" className="text-amber-400 text-[10px]">⚠️</span>
                          )}
                        </div>
                      </TableCell>

                      <TableCell className="text-slate-400">
                        {sponsor.contact_name ? (
                          <div>
                            <span className="text-slate-300 font-medium block">{sponsor.contact_name}</span>
                            <span className="text-[10px] text-slate-500">{sponsor.contact_phone || sponsor.contact_email}</span>
                          </div>
                        ) : (
                          <span className="text-slate-600">-</span>
                        )}
                      </TableCell>

                      <TableCell className="text-right pr-6 space-x-1 whitespace-nowrap">
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Tag Passes to Sponsor"
                          onClick={() => openTagModal(sponsor)}
                          className="h-8 w-8 rounded-lg text-amber-400 hover:text-amber-300 hover:bg-amber-950/40"
                        >
                          <Tag className="w-3.5 h-3.5" />
                        </Button>

                        <Link href={`/admin/sponsors/${sponsor.id}/print`} target="_blank">
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Print Sponsor Pass Voucher"
                            className="h-8 w-8 rounded-lg text-sky-400 hover:text-sky-300 hover:bg-sky-950/40"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </Button>
                        </Link>

                        <Button
                          size="icon"
                          variant="ghost"
                          title="Edit Sponsor Details"
                          onClick={() => openEditDialog(sponsor)}
                          className="h-8 w-8 rounded-lg text-slate-400 hover:text-white"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </Button>

                        <Button
                          size="icon"
                          variant="ghost"
                          title="Delete Sponsor"
                          onClick={() => handleDeleteSponsor(sponsor)}
                          className="h-8 w-8 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-950/40"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                    </tr>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* 4. Add/Edit Sponsor Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-[#131F2E] border-[#223345] text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-white">
              {editingSponsor ? `Edit Sponsor: ${editingSponsor.name}` : 'Add Corporate Sponsor'}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Enter the sponsor details, category tier, and complimentary pass entitlement.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveSponsor} className="space-y-3.5 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-300 font-medium">Sponsor Name *</Label>
              <Input
                required
                placeholder="e.g. Acme Corporation"
                value={name}
                onChange={e => setName(e.target.value)}
                className="bg-[#1A2839] border-[#2A3F55] text-white text-xs h-9"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300 font-medium">Sponsor Tier *</Label>
                <Select value={tier} onValueChange={(val) => val && setTier(val as SponsorTierValue)}>
                  <SelectTrigger className="bg-[#1A2839] border-[#2A3F55] text-white text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#131F2E] border-[#223345] text-white">
                    {SPONSOR_TIERS.map(t => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300 font-medium">Complimentary Passes *</Label>
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

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5 sm:col-span-1">
                <Label className="text-xs text-slate-300 font-medium">Contact Person</Label>
                <Input
                  placeholder="Mr. Sharma"
                  value={contactName}
                  onChange={e => setContactName(e.target.value)}
                  className="bg-[#1A2839] border-[#2A3F55] text-white text-xs h-9"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-1">
                <Label className="text-xs text-slate-300 font-medium">Phone</Label>
                <Input
                  placeholder="9840012345"
                  value={contactPhone}
                  onChange={e => setContactPhone(e.target.value)}
                  className="bg-[#1A2839] border-[#2A3F55] text-white text-xs h-9"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-1">
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

      {/* 5. Pass Tagging Modal */}
      <Dialog open={tagModalOpen} onOpenChange={setTagModalOpen}>
        <DialogContent className="bg-[#131F2E] border-[#223345] text-white max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
              <Tag className="w-5 h-5 text-[#E8913A]" />
              Tag Passes to Sponsor: {selectedSponsorForTagging?.name}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Select which donor passes are allocated under this sponsor (Complimentary quota: {selectedSponsorForTagging?.complimentary_pass_count} passes).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 flex-1 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between gap-3">
              <Input
                placeholder="Filter passes by donor name or pass code..."
                value={saleSearch}
                onChange={e => setSaleSearch(e.target.value.toLowerCase())}
                className="bg-[#1A2839] border-[#2A3F55] text-white text-xs h-9"
              />
              <Badge className="bg-[#1A2839] text-amber-300 border-[#2A3F55] text-xs font-mono shrink-0">
                Selected: {selectedSaleIds.length} passes
              </Badge>
            </div>

            {/* List of passes */}
            <div className="flex-1 overflow-y-auto border border-[#223345] rounded-xl p-3 bg-[#0E1724] space-y-2">
              {sales.filter(s => {
                if (saleSearch && !s.donor_name?.toLowerCase().includes(saleSearch) && !s.pass_code.toLowerCase().includes(saleSearch)) return false;
                return true;
              }).map(sale => {
                const isSelected = selectedSaleIds.includes(sale.id);
                const isOtherSponsor = sale.sponsor_id && sale.sponsor_id !== selectedSponsorForTagging?.id;

                return (
                  <div
                    key={sale.id}
                    onClick={() => {
                      setSelectedSaleIds(prev => 
                        isSelected ? prev.filter(id => id !== sale.id) : [...prev, sale.id]
                      );
                    }}
                    className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between text-xs ${
                      isSelected 
                        ? 'bg-[#1A344E] border-[#E8913A] text-white' 
                        : isOtherSponsor
                          ? 'bg-purple-950/40 border-purple-800/40 text-purple-300'
                          : 'bg-[#1A2839] border-[#2A3F55] text-slate-300 hover:bg-[#223345]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-amber-400">{sale.pass_code}</span>
                      <div>
                        <span className="font-bold text-white block">{sale.donor_name}</span>
                        <span className="text-[10px] text-slate-400">{sale.donor_phone}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] border-slate-700">
                        {sale.band?.name || 'Band'}
                      </Badge>
                      <span className="font-bold font-mono">
                        {isSelected ? '✓ Selected' : isOtherSponsor ? 'Tagged to Other' : 'Select'}
                      </span>
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
              Save Tagged Passes ({selectedSaleIds.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
