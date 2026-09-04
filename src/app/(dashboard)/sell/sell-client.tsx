'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Band, Profile, Sponsor } from '@/lib/types';
import { formatINR, BANDS_CONFIG } from '@/lib/constants';
import { createSale, recordIssuance } from './actions';
import { formatWhatsAppMessage, getWhatsAppShareUrl } from '@/lib/whatsapp';
import { toast } from 'sonner';
import { 
  Ticket, 
  Users, 
  Phone, 
  Mail, 
  MessageSquare, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowRight, 
  Sparkles, 
  Percent, 
  Printer, 
  Share2, 
  Plus, 
  Minus,
  Building2,
  Lock,
  Download
} from 'lucide-react';
import { useRouter } from 'next/navigation';

interface SellClientProps {
  bands: Band[];
  approvers: Profile[];
  sponsors: Sponsor[];
  currentUser: Profile;
}

export function SellClient({ bands, approvers, sponsors, currentUser }: SellClientProps) {
  const router = useRouter();

  // Selected state
  const [selectedBandId, setSelectedBandId] = useState<string>(bands[0]?.id || 'band_5000');
  const [quantity, setQuantity] = useState<number>(1);
  
  // Donor details
  const [donorName, setDonorName] = useState('');
  const [donorPhone, setDonorPhone] = useState('');
  const [donorEmail, setDonorEmail] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'pending'>('paid');
  const [comment, setComment] = useState('');
  const [selectedSponsorId, setSelectedSponsorId] = useState<string>('none');

  // Multi-guest individual details
  const [hasSeparateGuests, setHasSeparateGuests] = useState(false);
  const [individualGuests, setIndividualGuests] = useState<Array<{ name: string; phone: string; comment?: string }>>([]);

  // Discount state
  const [hasDiscount, setHasDiscount] = useState(false);
  const [collectedAmountPerSeat, setCollectedAmountPerSeat] = useState<number>(0);
  const [discountApprovedBy, setDiscountApprovedBy] = useState<string>('');

  // Loading & Success state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completedSales, setCompletedSales] = useState<any[] | null>(null);
  const [completedBandName, setCompletedBandName] = useState<string>('');

  const selectedBand = bands.find(b => b.id === selectedBandId);
  const remaining = selectedBand?.remaining_count || 0;
  const isSoldOut = remaining <= 0;

  // Update quantity handler
  const handleQuantityChange = (newQty: number) => {
    const validQty = Math.max(1, Math.min(remaining || 1, newQty));
    setQuantity(validQty);

    // Resize individual guests array
    setIndividualGuests(prev => {
      const arr = [...prev];
      while (arr.length < validQty) {
        arr.push({ name: '', phone: '' });
      }
      return arr.slice(0, validQty);
    });
  };

  const standardPrice = selectedBand?.standard_price || 5000;
  const unitPrice = hasDiscount && collectedAmountPerSeat > 0 ? collectedAmountPerSeat : standardPrice;
  const totalAmount = unitPrice * quantity;
  const totalDiscount = (standardPrice - unitPrice) * quantity;

  // Submit Sale
  const handleSubmitSale = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!donorName.trim()) {
      toast.error('Please enter donor name');
      return;
    }

    const cleanPhone = donorPhone.replace(/\D/g, '').slice(-10);
    if (cleanPhone.length !== 10) {
      toast.error('Please enter a valid 10-digit mobile number for WhatsApp pass delivery');
      return;
    }

    if (quantity > remaining) {
      toast.error(`HARD LIMIT: Only ${remaining} seat(s) remaining in this band`);
      return;
    }

    if (hasDiscount && totalDiscount > 0 && !discountApprovedBy) {
      toast.error('Please select an approving Super Admin or System Admin for the discount');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createSale({
        bandId: selectedBandId,
        quantity,
        donorName: donorName.trim(),
        donorPhone: cleanPhone,
        donorEmail: donorEmail.trim() || null,
        paymentStatus,
        comment: comment.trim() || null,
        collectedAmountPerSeat: hasDiscount ? collectedAmountPerSeat : standardPrice,
        discountApprovedBy: hasDiscount ? discountApprovedBy : null,
        individualGuests: hasSeparateGuests ? individualGuests : null,
        sponsorId: selectedSponsorId !== 'none' ? selectedSponsorId : null,
      });

      if (!res.success || !res.sales) {
        toast.error(res.error || 'Failed to record sale');
        return;
      }

      toast.success(`✓ Successfully sold ${quantity} seat(s) in ${res.bandName}!`);
      setCompletedSales(res.sales);
      setCompletedBandName(res.bandName || selectedBand?.name || 'Seating Band');
    } catch (err: any) {
      toast.error(err.message || 'Error creating sale');
    } finally {
      setIsSubmitting(false);
    }
  };

  // WhatsApp send action
  const handleWhatsAppSend = async (sale: any) => {
    try {
      // 1. Mark issuance in database
      await recordIssuance(sale.id, 'whatsapp');

      // 2. Open WhatsApp share link
      const message = formatWhatsAppMessage({
        donorName: sale.donor_name,
        donorPhone: sale.donor_phone,
        passCode: sale.pass_code,
        bandName: completedBandName,
        paymentStatus: sale.payment_status,
      });

      const url = getWhatsAppShareUrl(sale.donor_phone, message);
      window.open(url, '_blank');
      toast.success(`WhatsApp pass link opened for ${sale.donor_name}`);
    } catch (err: any) {
      toast.error('Error recording WhatsApp delivery');
    }
  };

  // Print ticket action
  const handlePrintTicket = async (sale: any) => {
    try {
      // 1. Mark issuance in database
      await recordIssuance(sale.id, 'printed');

      // 2. Download PDF
      const res = await fetch('/api/tickets/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passCode: sale.pass_code }),
      });

      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Hrudhayam-Pass-${sale.pass_code}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success(`Printable ticket downloaded for ${sale.pass_code}`);
    } catch (err: any) {
      toast.error('Error generating printable pass');
    }
  };

  // If sale completed, render success handover screen
  if (completedSales) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in zoom-in duration-200 pb-16">
        <Card className="bg-[#131F2E] border-2 border-emerald-500/40 rounded-3xl shadow-2xl p-6 sm:p-8 text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 border-2 border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
            <CheckCircle2 className="w-9 h-9" />
          </div>

          <div className="space-y-1.5">
            <Badge className="bg-emerald-950 text-emerald-300 border-emerald-800 text-xs uppercase tracking-wider font-bold">
              Sale Confirmed & Allocated
            </Badge>
            <h2 className="text-2xl font-black text-white">
              {completedSales.length} Seat{completedSales.length > 1 ? 's' : ''} Sold in {completedBandName}
            </h2>
            <p className="text-xs text-slate-400">
              Lead Donor: <strong className="text-white">{donorName}</strong> ({donorPhone})
            </p>
          </div>

          {/* Golden Rule Notice */}
          <div className="p-3 bg-amber-500/10 rounded-2xl border border-amber-500/30 text-[11px] text-amber-300 text-left flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <strong className="block text-amber-200">Golden Delivery Rule:</strong>
              Choose <strong>either</strong> WhatsApp delivery <strong>or</strong> Printed ticket. Once issued, a pass cannot be switched to another channel.
            </div>
          </div>

          {/* List of passes with handover buttons */}
          <div className="space-y-3 text-left">
            {completedSales.map((sale, idx) => (
              <div 
                key={sale.id} 
                className="p-4 bg-[#0E1724] rounded-2xl border border-[#24364A] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-inner"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-black text-amber-400">{sale.pass_code}</span>
                    <Badge variant="outline" className="text-[10px] bg-[#1A2839] border-slate-700 text-slate-300">
                      Seat #{idx + 1}
                    </Badge>
                  </div>
                  <p className="text-sm font-bold text-white mt-0.5">{sale.donor_name}</p>
                  <p className="text-xs text-slate-400">{sale.donor_phone}</p>
                </div>

                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                  <Button
                    size="sm"
                    onClick={() => handleWhatsAppSend(sale)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl h-9 gap-1.5 shadow-md shadow-emerald-950/40"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Send WhatsApp</span>
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handlePrintTicket(sale)}
                    className="bg-[#1A2839] hover:bg-[#24364A] text-slate-200 font-bold text-xs rounded-xl h-9 gap-1.5 border-[#2A3F55]"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Print PDF</span>
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-4 border-t border-[#223345] flex flex-col sm:flex-row gap-3">
            <Button
              className="flex-1 bg-[#E8913A] hover:bg-[#D97706] text-slate-950 font-bold text-xs rounded-xl h-11"
              onClick={() => {
                setCompletedSales(null);
                setDonorName('');
                setDonorPhone('');
                setDonorEmail('');
                setComment('');
                setQuantity(1);
                setHasDiscount(false);
                router.refresh();
              }}
            >
              Record Another Sale
            </Button>
            <Button
              variant="outline"
              className="bg-[#1A2839] hover:bg-[#24364A] text-slate-300 font-semibold text-xs rounded-xl h-11 border-[#2A3F55]"
              onClick={() => router.push('/guests')}
            >
              View All Team Sales
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmitSale} className="max-w-4xl mx-auto space-y-8 pb-16">
      {/* 1. BAND PICKER */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <Ticket className="w-4 h-4 text-[#E8913A]" />
            <span>1. Select Price Band</span>
          </Label>
          <span className="text-xs text-slate-400">
            General seating within designated band
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {bands.map((band) => {
            const isSelected = selectedBandId === band.id;
            const rem = band.remaining_count || 0;
            const soldOut = rem <= 0;
            const config = BANDS_CONFIG.find(c => c.id === band.id);

            return (
              <div
                key={band.id}
                onClick={() => {
                  if (!soldOut) {
                    setSelectedBandId(band.id);
                    if (quantity > rem) setQuantity(Math.max(1, rem));
                  }
                }}
                className={`p-4 rounded-2xl border-2 transition-all cursor-pointer relative flex flex-col justify-between select-none ${
                  soldOut 
                    ? 'opacity-40 cursor-not-allowed bg-[#0B1520] border-[#1E2D3D]' 
                    : isSelected 
                      ? 'bg-[#13283E] border-[#E8913A] shadow-lg shadow-amber-950/20' 
                      : 'bg-[#131F2E] border-[#223345] hover:border-slate-500 hover:bg-[#16273A]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <Badge className={`${config?.bgColor || 'bg-amber-500/10'} ${config?.textColor || 'text-amber-400'} border ${config?.borderColor || 'border-amber-500/30'} text-[11px] font-bold`}>
                      {band.name}
                    </Badge>
                    {soldOut && (
                      <Badge variant="destructive" className="text-[9px] uppercase font-bold">
                        Sold Out
                      </Badge>
                    )}
                  </div>
                  <div className="text-2xl font-black font-mono text-white mt-2">
                    {formatINR(band.standard_price)}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-[#223345]/60 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Available</span>
                  <span className={`font-mono font-bold ${rem > 10 ? 'text-sky-400' : rem > 0 ? 'text-amber-400' : 'text-red-400'}`}>
                    {rem} seats
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. QUANTITY SELECTOR */}
      <Card className="bg-[#131F2E] border-[#223345] rounded-2xl shadow-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <Label className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Users className="w-4 h-4 text-sky-400" />
              <span>2. Quantity of Seats</span>
            </Label>
            <p className="text-xs text-slate-400 mt-0.5">
              Maximum available in {selectedBand?.name}: <strong className="text-white">{remaining} seats</strong>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={quantity <= 1}
              onClick={() => handleQuantityChange(quantity - 1)}
              className="h-10 w-10 rounded-xl bg-[#1A2839] border-[#2A3F55] text-white"
            >
              <Minus className="h-4 w-4" />
            </Button>
            <div className="w-16 text-center font-mono font-black text-2xl text-amber-400">
              {quantity}
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={quantity >= remaining || isSoldOut}
              onClick={() => handleQuantityChange(quantity + 1)}
              className="h-10 w-10 rounded-xl bg-[#1A2839] border-[#2A3F55] text-white"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {quantity > 1 && (
          <div className="p-3 bg-[#0E1724] rounded-xl border border-[#24364A] flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-white block">Group / Multi-Seat Booking</span>
              <span className="text-[11px] text-slate-400 block">
                Do you want to provide separate guest names for each seat now?
              </span>
            </div>
            <Switch
              checked={hasSeparateGuests}
              onCheckedChange={setHasSeparateGuests}
            />
          </div>
        )}

        {/* Separate Guest Names Input if enabled */}
        {hasSeparateGuests && quantity > 1 && (
          <div className="space-y-3 pt-2">
            <span className="text-xs font-bold text-slate-300 block">Individual Seat Names & Numbers:</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-60 overflow-y-auto pr-1">
              {individualGuests.map((guest, idx) => (
                <div key={idx} className="p-3 bg-[#0E1724] rounded-xl border border-[#24364A] space-y-2">
                  <span className="text-[10px] font-mono font-bold text-amber-400 block">
                    Seat #{idx + 1}
                  </span>
                  <Input
                    placeholder={`Guest #${idx + 1} Full Name`}
                    value={guest.name}
                    onChange={(e) => {
                      const val = e.target.value;
                      setIndividualGuests(prev => {
                        const copy = [...prev];
                        copy[idx] = { ...copy[idx], name: val };
                        return copy;
                      });
                    }}
                    className="bg-[#1A2839] border-[#2A3F55] text-white text-xs h-8"
                  />
                  <Input
                    placeholder={`Guest Mobile (optional)`}
                    value={guest.phone}
                    onChange={(e) => {
                      const val = e.target.value;
                      setIndividualGuests(prev => {
                        const copy = [...prev];
                        copy[idx] = { ...copy[idx], phone: val };
                        return copy;
                      });
                    }}
                    className="bg-[#1A2839] border-[#2A3F55] text-white text-xs h-8"
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* 3. DONOR DETAILS CARD */}
      <Card className="bg-[#131F2E] border-[#223345] rounded-2xl shadow-xl p-5 space-y-4">
        <Label className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
          <Phone className="w-4 h-4 text-emerald-400" />
          <span>3. Donor & Contact Details</span>
        </Label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-300 font-semibold">Donor / Lead Contact Name *</Label>
            <Input
              required
              placeholder="e.g. Ramesh Kumar"
              value={donorName}
              onChange={(e) => setDonorName(e.target.value)}
              className="bg-[#1A2839] border-[#2A3F55] text-white text-sm h-11"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-slate-300 font-semibold">10-Digit Mobile Number * (WhatsApp)</Label>
            <Input
              required
              placeholder="e.g. 9840012345"
              value={donorPhone}
              onChange={(e) => setDonorPhone(e.target.value)}
              maxLength={14}
              className="bg-[#1A2839] border-[#2A3F55] text-white font-mono text-sm h-11"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-slate-300 font-semibold">Email Address (Optional)</Label>
            <Input
              type="email"
              placeholder="donor@example.com"
              value={donorEmail}
              onChange={(e) => setDonorEmail(e.target.value)}
              className="bg-[#1A2839] border-[#2A3F55] text-white text-sm h-11"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-slate-300 font-semibold">Payment Status *</Label>
            <Select 
              value={paymentStatus} 
              onValueChange={(val) => val && setPaymentStatus(val as 'paid' | 'pending')}
            >
              <SelectTrigger className="bg-[#1A2839] border-[#2A3F55] text-white text-sm h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#131F2E] border-[#223345] text-white">
                <SelectItem value="paid">✓ Received / Paid</SelectItem>
                <SelectItem value="pending">⏳ Pending Collection</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs text-slate-300 font-semibold">Tag Sponsor (Optional)</Label>
            <Select 
              value={selectedSponsorId} 
              onValueChange={(val) => val && setSelectedSponsorId(val)}
            >
              <SelectTrigger className="bg-[#1A2839] border-[#2A3F55] text-white text-sm h-11">
                <SelectValue placeholder="Select sponsor if complimentary pass" />
              </SelectTrigger>
              <SelectContent className="bg-[#131F2E] border-[#223345] text-white">
                <SelectItem value="none">No Sponsor (Standard Donor Sale)</SelectItem>
                {sponsors.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} ({s.complimentary_pass_count} comp passes)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs text-slate-300 font-semibold">Notes / Remarks (Optional)</Label>
            <Input
              placeholder="e.g. Cheque collected, special front seating preference"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="bg-[#1A2839] border-[#2A3F55] text-white text-sm h-11"
            />
          </div>
        </div>
      </Card>

      {/* 4. OPTIONAL DISCOUNT SECTION */}
      <Card className="bg-[#131F2E] border-[#223345] rounded-2xl shadow-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Percent className="w-4 h-4 text-purple-400" />
              <span>4. Custom Discount / Concession</span>
            </Label>
            <p className="text-xs text-slate-400">
              Only Super Admin or System Admin can authorize discounted rates.
            </p>
          </div>
          <Switch
            checked={hasDiscount}
            onCheckedChange={(val) => {
              setHasDiscount(val);
              if (val && collectedAmountPerSeat === 0) {
                setCollectedAmountPerSeat(standardPrice);
              }
            }}
          />
        </div>

        {hasDiscount && (
          <div className="space-y-4 pt-3 border-t border-[#223345] animate-in fade-in duration-150">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300 font-semibold">Collected Price Per Seat (₹)</Label>
                <Input
                  type="number"
                  min={0}
                  max={standardPrice}
                  value={collectedAmountPerSeat}
                  onChange={(e) => setCollectedAmountPerSeat(parseInt(e.target.value) || 0)}
                  className="bg-[#1A2839] border-[#2A3F55] text-white font-mono text-sm h-11"
                />
                <span className="text-[10px] text-purple-300">
                  Discount per seat: {formatINR(Math.max(0, standardPrice - collectedAmountPerSeat))}
                </span>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300 font-semibold">Authorizing Admin *</Label>
                <Select value={discountApprovedBy} onValueChange={(val) => val && setDiscountApprovedBy(val)}>
                  <SelectTrigger className="bg-[#1A2839] border-[#2A3F55] text-white text-sm h-11">
                    <SelectValue placeholder="Select Authorizing Admin" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#131F2E] border-[#223345] text-white">
                    {approvers.map((admin) => (
                      <SelectItem key={admin.id} value={admin.id}>
                        {admin.full_name} ({admin.role === 'system_admin' ? 'System Admin' : 'Super Admin'})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* 5. SUMMARY & SUBMIT BUTTON */}
      <div className="bg-[#0E1724] p-6 rounded-3xl border-2 border-[#243D56] shadow-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <span className="text-xs text-slate-400 font-medium">Order Total for {quantity} Seat{quantity > 1 ? 's' : ''}:</span>
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-black font-mono text-white">
              {formatINR(totalAmount)}
            </span>
            {totalDiscount > 0 && (
              <span className="text-xs text-purple-400 font-semibold">
                (Saved {formatINR(totalDiscount)} discount)
              </span>
            )}
          </div>
          <span className="text-[11px] text-slate-500 block">
            {selectedBand?.name} • Payment: {paymentStatus === 'paid' ? 'Paid' : 'Pending'}
          </span>
        </div>

        <Button
          type="submit"
          disabled={isSubmitting || isSoldOut}
          className="bg-gradient-to-r from-[#E8913A] to-[#D97706] hover:from-[#D97706] hover:to-[#B45309] text-slate-950 font-black text-sm px-8 h-12 rounded-2xl shadow-xl shadow-amber-950/40 gap-2 cursor-pointer"
        >
          {isSubmitting ? (
            'Recording Sale...'
          ) : isSoldOut ? (
            'Band Sold Out'
          ) : (
            <>
              <span>Confirm & Issue Pass</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
