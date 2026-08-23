import { ImageResponse } from 'next/og';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateQrDataUrl } from '@/lib/qrcode';
import { formatINR } from '@/lib/constants';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { seatId, passCode } = body;

    if (!seatId && !passCode) {
      return new Response(JSON.stringify({ error: 'Seat ID or Pass Code required' }), { status: 400 });
    }

    const adminClient = createAdminClient();

    let seatQuery = adminClient.from('seats').select('*');
    if (seatId) {
      seatQuery = seatQuery.eq('id', seatId);
    } else {
      seatQuery = seatQuery.eq('pass_code', passCode);
    }

    const { data: seats } = await seatQuery;
    if (!seats || seats.length === 0) {
      return new Response(JSON.stringify({ error: 'Seat/Pass not found' }), { status: 404 });
    }

    const seat = seats[0];

    // Fetch all seats with the same pass code for group tickets
    const { data: groupSeats } = await adminClient
      .from('seats')
      .select('id, section, row_label, seat_no, tier')
      .eq('pass_code', seat.pass_code)
      .order('row_label')
      .order('seat_no');

    const isGroup = groupSeats && groupSeats.length > 1;
    const admitCount = groupSeats ? groupSeats.length : 1;
    let displayRow = seat.row_label;
    let displaySeats = String(seat.seat_no);

    if (isGroup) {
      const rows = [...new Set(groupSeats.map((s: any) => s.row_label))];
      displayRow = rows.join(', ');
      displaySeats = groupSeats.map((s: any) => s.seat_no).join(', ');
    }

    // Generate QR Code data URL
    const qrDataUrl = await generateQrDataUrl(seat.qr_token || `HRUDHAYAM:${seat.pass_code || seat.id}`, {
      width: 320,
      margin: 1,
    });

    const tierLabel = seat.tier === 5000 
      ? '₹5,000 (Platinum VIP)' 
      : seat.tier === 3000 
      ? '₹3,000 (Gold Donor)' 
      : seat.tier === 1500 
      ? '₹1,500 (Silver Donor)' 
      : 'Chief Guest / VIP';

    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'row',
            backgroundColor: '#080E17',
            backgroundImage: 'radial-gradient(circle at 15% 20%, #1A2E44 0%, #080E17 70%)',
            color: '#FFFFFF',
            fontFamily: 'sans-serif',
            padding: '36px',
            boxSizing: 'border-box',
            border: '8px solid #B8860B',
            position: 'relative',
          }}
        >
          {/* Left Main Ticket Info */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              paddingRight: '32px',
              borderRight: '2px dashed #B8860B',
            }}
          >
            {/* Header / Sub-badge */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                <div
                  style={{
                    backgroundColor: '#B8860B',
                    color: '#080E17',
                    padding: '4px 12px',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: 'bold',
                    letterSpacing: '1px',
                    textTransform: 'uppercase',
                  }}
                >
                  Rotary Club of Aarch City Madras
                </div>
                <div
                  style={{
                    color: '#E8913A',
                    fontSize: '13px',
                    fontWeight: 'bold',
                    letterSpacing: '0.5px',
                  }}
                >
                  Public-Access AEDs Fundraiser
                </div>
              </div>

              <h1
                style={{
                  fontSize: '40px',
                  fontWeight: 900,
                  margin: '4px 0 0 0',
                  color: '#FFFFFF',
                  letterSpacing: '1px',
                }}
              >
                HRUDHAYAM LIVE 2026
              </h1>
              <p
                style={{
                  fontSize: '16px',
                  color: '#CBD5E1',
                  margin: '4px 0 0 0',
                }}
              >
                📍 The Music Academy, TTK Road, Alwarpet, Chennai
              </p>
            </div>

            {/* Guest & Seating Details Grid */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
                backgroundColor: '#0F1A26',
                padding: '20px',
                borderRadius: '12px',
                border: '1px solid #223345',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '11px', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold' }}>
                    Guest / Donor Name
                  </span>
                  <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#FFFFFF', marginTop: '2px' }}>
                    {seat.guest_name || 'Guest Donor'}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                  <span style={{ fontSize: '11px', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold' }}>
                    Admit Count
                  </span>
                  <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#FACC15', marginTop: '2px' }}>
                    {admitCount > 1 ? `Admit ${admitCount} Guests` : 'Admit 1'}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #1E2D3D', paddingTop: '10px' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '11px', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold' }}>
                    Section
                  </span>
                  <span style={{ fontSize: '17px', fontWeight: 'bold', color: '#E2E8F0', marginTop: '2px' }}>
                    {seat.section}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '11px', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold' }}>
                    Row(s)
                  </span>
                  <span style={{ fontSize: '17px', fontWeight: 'bold', color: '#FACC15', marginTop: '2px' }}>
                    Row {displayRow}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                  <span style={{ fontSize: '11px', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold' }}>
                    Seat Number(s)
                  </span>
                  <span style={{ fontSize: '17px', fontWeight: 'bold', color: '#FFFFFF', marginTop: '2px' }}>
                    {displaySeats}
                  </span>
                </div>
              </div>
            </div>

            {/* Timings & Category Footer */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '16px', fontSize: '14px', color: '#94A3B8' }}>
                <span>🗓️ <strong>Friday, 9 Oct 2026</strong></span>
                <span>⏰ <strong>Gates 5:30 PM • 6:30 PM</strong></span>
              </div>
              <div
                style={{
                  fontSize: '13px',
                  fontWeight: 'bold',
                  color: '#2DD4BF',
                  backgroundColor: '#042F2E',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: '1px solid #0D9488',
                }}
              >
                {tierLabel}
              </div>
            </div>
          </div>

          {/* Right QR Stub */}
          <div
            style={{
              width: '280px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              paddingLeft: '32px',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                fontSize: '11px',
                color: '#E8913A',
                fontWeight: 'bold',
                letterSpacing: '1.5px',
                textTransform: 'uppercase',
                marginBottom: '10px',
              }}
            >
              Scan For Admission
            </div>

            {/* QR Image Box */}
            <div
              style={{
                backgroundColor: '#FFFFFF',
                padding: '12px',
                borderRadius: '12px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                display: 'flex',
              }}
            >
              <img
                src={qrDataUrl}
                width={200}
                height={200}
                alt="Entry QR"
              />
            </div>

            <div
              style={{
                fontSize: '17px',
                fontFamily: 'monospace',
                fontWeight: 'bold',
                color: '#FACC15',
                letterSpacing: '2px',
                marginTop: '14px',
              }}
            >
              {seat.pass_code || seat.id}
            </div>

            <div
              style={{
                fontSize: '10px',
                color: '#64748B',
                marginTop: '6px',
              }}
            >
              Official Single-Entry Pass
            </div>
          </div>
        </div>
      ),
      {
        width: 1000,
        height: 480,
      }
    );
  } catch (error: any) {
    console.error('Ticket Image Generation Error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
