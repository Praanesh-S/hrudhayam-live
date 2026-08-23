import { createAdminClient } from '@/lib/supabase/admin';
import { generateQrDataUrl } from '@/lib/qrcode';
import { notFound } from 'next/navigation';
import { Ticket, MapPin, Calendar, Clock, Download, CheckCircle2, Heart, ShieldCheck } from 'lucide-react';
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

  // Look up seats by pass_code
  const { data: seats, error } = await adminClient
    .from('seats')
    .select('*')
    .eq('pass_code', passCode)
    .order('seat_no', { ascending: true });

  if (error || !seats || seats.length === 0) {
    notFound();
  }

  const primarySeat = seats[0];
  const totalSeats = seats.length;
  const rows = Array.from(new Set(seats.map(s => s.row_label)));
  const seatNumbers = seats.map(s => s.seat_no).join(', ');
  const qrToken = primarySeat.qr_token || passCode;
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
            Official Donor E-Pass • {totalSeats > 1 ? `Admit ${totalSeats} Guests` : 'Admit 1 Guest'}
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
              {primarySeat.guest_name || 'Valued Donor'}
            </h2>
          </div>

          {/* Seating Coordinates Box */}
          <div className="w-full bg-[#081522] rounded-2xl border border-[#1E3A4C] p-3.5 grid grid-cols-3 divide-x divide-[#1E3A4C] text-center shadow-inner">
            <div className="px-2">
              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">Section</span>
              <span className="text-sm font-black text-white block mt-0.5">{primarySeat.section}</span>
            </div>
            <div className="px-2">
              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">Row</span>
              <span className="text-sm font-black text-white block mt-0.5">{rows.join(', ')}</span>
            </div>
            <div className="px-2">
              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">{totalSeats > 1 ? 'Seats' : 'Seat No'}</span>
              <span className="text-sm font-black text-white block mt-0.5">{seatNumbers}</span>
            </div>
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
                Scan at gate entry
              </p>
            </div>
          </div>

          {/* Check-in status badge if checked in */}
          {primarySeat.checked_in && (
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
          <a
            href={`/api/tickets/generate`}
            onClick={async (e) => {
              e.preventDefault();
              try {
                const res = await fetch('/api/tickets/generate', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ seatId: primarySeat.id }),
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
          </a>
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
