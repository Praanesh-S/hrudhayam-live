import { createAdminClient } from '@/lib/supabase/admin';
import { generateQrDataUrl } from '@/lib/qrcode';
import { MapPin, Calendar, Download, CheckCircle2, Heart, XCircle, QrCode, Tag } from 'lucide-react';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ passCode: string }> }) {
  const { passCode } = await params;
  return {
    title: `Donor Pass ${passCode} | Hrudhayam LIVE 2026`,
    description: `Official Donor Admission Pass for Hrudhayam LIVE 2026 Charity Concert`,
  };
}

export default async function PublicPassPage({ params }: { params: Promise<{ passCode: string }> }) {
  const { passCode } = await params;
  const adminClient = createAdminClient();

  // 1. Try finding in v2 passes table
  let { data: pass } = await adminClient
    .from('passes')
    .select('*, band:bands(label, price, name, standard_price)')
    .eq('pass_code', passCode)
    .maybeSingle();

  // Fallback 1: check sales table
  let legacySale = null;
  if (!pass) {
    const { data: sale } = await adminClient
      .from('sales')
      .select('*, band:bands(name, standard_price)')
      .eq('pass_code', passCode)
      .maybeSingle();
    legacySale = sale;
  }

  // Fallback 2: check seats table
  if (!pass && !legacySale) {
    const { data: seat } = await adminClient
      .from('seats')
      .select('*')
      .eq('pass_code', passCode)
      .maybeSingle();

    if (seat && seat.guest_name) {
      legacySale = {
        id: seat.id,
        donor_name: seat.guest_name,
        pass_code: seat.pass_code,
        qr_token: seat.qr_token || seat.pass_code,
        payment_status: seat.payment_status || 'pending',
        checked_in: seat.checked_in || false,
        cancelled: false,
        band: {
          name: seat.tier === 5000 ? '₹5,000 Platinum' : seat.tier === 3000 ? '₹3,500 Gold' : '₹1,500 Bronze',
          standard_price: seat.tier || 5000,
        },
      } as any;
    }
  }

  const isInvalid = (!pass && !legacySale) || (pass && pass.status === 'cancelled') || (legacySale && legacySale.cancelled);

  if (isInvalid) {
    return (
      <div className="min-h-screen bg-[#07111C] text-white flex flex-col items-center justify-center p-4 sm:p-6 font-sans">
        <div className="w-full max-w-md bg-[#0F2031] rounded-3xl border-2 border-red-500/40 shadow-2xl overflow-hidden text-center p-8 space-y-5">
          <div className="w-16 h-16 rounded-full bg-red-500/10 border-2 border-red-500/30 flex items-center justify-center mx-auto text-red-400">
            <XCircle className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-black text-white">Pass Cancelled / Invalid</h1>
            <p className="text-xs text-red-300 font-mono font-bold">
              Pass Code: {passCode}
            </p>
            <p className="text-xs text-slate-400 leading-relaxed pt-2">
              This admission ticket has been cancelled or is no longer valid. If you believe this is an error, please contact your Rotary Club event coordinator.
            </p>
          </div>

          <div className="p-3.5 bg-[#081522] rounded-xl border border-[#1E3A4C] text-[11px] text-slate-400">
            Rotary Club of Aarch City Madras • Hrudhayam LIVE 2026
          </div>
        </div>
      </div>
    );
  }

  // Determine display values
  const donorName = pass ? pass.donor_name : legacySale.donor_name;
  const bandName = pass
    ? (pass.band?.label || pass.band?.name || `Band ₹${pass.band?.price?.toLocaleString('en-IN') || '5,000'}`)
    : (legacySale.band?.name || `₹${legacySale.standard_price?.toLocaleString('en-IN') || '5,000'} Band`);
  const isCheckedIn = pass ? pass.status === 'used' : legacySale.checked_in;
  const isPhysical = pass ? pass.ticket_type === 'physical' : (legacySale.issuance_type === 'printed');
  const physicalSerial = pass?.physical_serial || null;

  const qrToken = pass ? (pass.qr_token || pass.pass_code) : (legacySale.qr_token || legacySale.pass_code);
  const qrDataUrl = await generateQrDataUrl(qrToken, { width: 320, margin: 1 });

  return (
    <div className="min-h-screen bg-[#07111C] text-white flex flex-col items-center justify-center p-4 sm:p-6 select-none font-sans">
      <div className="w-full max-w-md bg-[#0F2031] rounded-3xl border-2 border-[#D97706]/40 shadow-2xl overflow-hidden flex flex-col">
        {/* Top Concert Header */}
        <div className="bg-[#081522] p-6 text-center border-b border-[#D97706]/30 relative">
          <div className="inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[11px] font-bold tracking-wider uppercase mb-2.5">
            <Heart className="w-3.5 h-3.5 fill-amber-400" />
            <span>Rotary Club of Aarch City Madras</span>
          </div>

          <h1 className="text-2xl font-black text-white tracking-tight leading-none">
            HRUDHAYAM LIVE 2026
          </h1>
          <p className="text-xs text-slate-400 mt-1.5 font-medium">
            Charity Musical Concert in Aid of Public-Access AEDs
          </p>
        </div>

        {/* Golden Ribbon Strip */}
        <div className="bg-gradient-to-r from-[#D97706] via-[#F59E0B] to-[#D97706] py-1.5 px-4 text-center">
          <p className="text-slate-950 font-black text-xs tracking-wider uppercase">
            {isPhysical ? 'Official Physical Admission Pass • Admit 1' : 'Official Digital Admission Pass • Admit 1'}
          </p>
        </div>

        {/* Pass Body Content */}
        <div className="p-6 flex-1 flex flex-col items-center text-center space-y-5">
          {/* Guest Name */}
          <div className="space-y-1">
            <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400">
              Pass Issued To
            </p>
            <h2 className="text-2xl font-black text-white tracking-tight">
              {donorName || 'Valued Donor'}
            </h2>
          </div>

          {/* Seating Category / Band Box */}
          <div className="w-full bg-[#081522] rounded-2xl border border-[#1E3A4C] p-4 text-center shadow-inner space-y-1">
            <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest block">
              Admission Category
            </span>
            <span className="text-xl font-black text-white block">
              {bandName}
            </span>
            <span className="text-[11px] text-slate-400 block pt-0.5">
              General Admission • First Come, First Served within Band Area
            </span>
          </div>

          {/* Verification Code Box (QR or Physical Serial) */}
          {isPhysical && physicalSerial ? (
            <div className="w-full bg-amber-500/10 border-2 border-amber-500/40 rounded-2xl p-6 text-center space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold">
                <Tag className="w-3.5 h-3.5" />
                <span>Physical Pass Serial</span>
              </div>
              <p className="font-mono text-3xl font-black text-amber-400 tracking-wider">
                {physicalSerial}
              </p>
              <p className="text-[11px] text-slate-300">
                Please present your physical ticket at the entrance gate.
              </p>
            </div>
          ) : (
            <div className="relative p-4 bg-white rounded-2xl shadow-xl flex flex-col items-center">
              <img 
                src={qrDataUrl} 
                alt={`QR Code for pass ${passCode}`} 
                className="w-56 h-56 object-contain"
              />
              <div className="mt-2 text-center">
                <span className="font-mono text-base font-black text-slate-900 tracking-widest">
                  {passCode}
                </span>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-0.5">
                  Scan at Gate Entrance
                </p>
              </div>
            </div>
          )}

          {/* Check-in status badge if checked in */}
          {isCheckedIn ? (
            <div className="w-full p-2.5 rounded-xl bg-emerald-950/80 border border-emerald-600 flex items-center justify-center gap-2 text-emerald-300 text-xs font-bold">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>✓ Verified Admission Entry (Gate Checked-In)</span>
            </div>
          ) : (
            <div className="w-full p-2 rounded-xl bg-slate-900/60 border border-slate-700/60 flex items-center justify-center gap-1.5 text-slate-400 text-[11px]">
              <QrCode className="w-3.5 h-3.5 text-amber-400" />
              <span>Gate Status: Active & Ready for Entry</span>
            </div>
          )}

          {/* Event Venue & Date Info */}
          <div className="w-full space-y-2 text-xs text-slate-300 bg-[#081522]/60 p-4 rounded-xl border border-[#1E3A4C]/60 text-left">
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-white">The Music Academy</p>
                <p className="text-[11px] text-slate-400">TTK Road, Alwarpet, Chennai</p>
              </div>
            </div>

            <div className="flex items-start gap-2 pt-1">
              <Calendar className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-white">Friday, 9 October 2026</p>
                <p className="text-[11px] text-slate-400">Gates Open: 5:30 PM • Concert: 6:30 PM</p>
              </div>
            </div>
          </div>

          {/* Download PDF Action Link (for Digital Passes) */}
          {!isPhysical && (
            <a
              href={`/api/tickets/generate?passCode=${encodeURIComponent(passCode)}`}
              target="_blank"
              rel="noopener noreferrer"
              download={`Hrudhayam-Pass-${passCode}.pdf`}
              className="w-full py-3.5 px-4 rounded-xl bg-[#E8913A] hover:bg-[#D97706] text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-950/40 transition-all no-underline"
            >
              <Download className="w-4 h-4" />
              <span>Download Printable PDF Ticket</span>
            </a>
          )}
        </div>

        {/* Footer */}
        <div className="bg-[#081522] p-4 text-center border-t border-[#1E3A4C]/60 text-[10px] text-slate-500 leading-relaxed">
          <p>This pass represents a charitable contribution. Strictly one scan entry per barcode.</p>
          <p className="mt-0.5">Rotary Club of Aarch City Madras • All Rights Reserved</p>
        </div>
      </div>
    </div>
  );
}
