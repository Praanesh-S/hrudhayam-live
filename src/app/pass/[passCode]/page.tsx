import { createAdminClient } from '@/lib/supabase/admin';
import { generateQrDataUrl } from '@/lib/qrcode';
import { Ticket, MapPin, Calendar, Download, CheckCircle2, Heart, XCircle, Sparkles } from 'lucide-react';
import { formatINR } from '@/lib/constants';

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

  // 1. Look up sale by pass_code
  let { data: sale } = await adminClient
    .from('sales')
    .select('*, band:bands(name, standard_price)')
    .eq('pass_code', passCode)
    .maybeSingle();

  // Fallback to legacy seats if not found
  if (!sale) {
    const { data: seat } = await adminClient
      .from('seats')
      .select('*')
      .eq('pass_code', passCode)
      .maybeSingle();

    if (seat && seat.guest_name) {
      sale = {
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

  const isInvalid = !sale || sale.cancelled;

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

  const bandName = sale.band?.name || `₹${sale.standard_price?.toLocaleString('en-IN') || '5,000'} Band`;
  const qrToken = sale.qr_token || sale.pass_code;
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
            Official Donor Admission Pass • Admit 1 Guest
          </p>
        </div>

        {/* Pass Body Content */}
        <div className="p-6 flex-1 flex flex-col items-center text-center space-y-5">
          {/* Guest Name */}
          <div className="space-y-1">
            <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400">
              Pass Issued To
            </p>
            <h2 className="text-xl font-bold text-white tracking-tight">
              {sale.donor_name || 'Valued Donor'}
            </h2>
          </div>

          {/* Seating Category / Band Box */}
          <div className="w-full bg-[#081522] rounded-2xl border border-[#1E3A4C] p-4 text-center shadow-inner space-y-1">
            <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest block">
              Admission Category
            </span>
            <span className="text-lg font-black text-white block">
              {bandName}
            </span>
            <span className="text-[11px] text-slate-400 block pt-0.5">
              General Admission • First Come, First Served within Band Area
            </span>
          </div>

          {/* High-Contrast QR Code Card */}
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

          {/* Check-in status badge if checked in */}
          {sale.checked_in && (
            <div className="w-full p-2.5 rounded-xl bg-emerald-950/80 border border-emerald-600 flex items-center justify-center gap-2 text-emerald-300 text-xs font-bold">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>✓ Verified Admission Entry</span>
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

          {/* Download PDF Action */}
          <button
            type="button"
            onClick={async () => {
              try {
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
                a.download = `Hrudhayam-Pass-${passCode}.pdf`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
              } catch (err) {
                alert('Could not download PDF. Please try again.');
              }
            }}
            className="w-full py-3 px-4 rounded-xl bg-[#E8913A] hover:bg-[#D97706] text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-950/40 transition-all cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Download Printable PDF Ticket</span>
          </button>
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
