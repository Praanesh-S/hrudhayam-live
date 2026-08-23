import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { signQrToken } from '@/lib/tokens';
import { generateQrPngBuffer } from '@/lib/qrcode';
import { renderToBuffer } from '@react-pdf/renderer';
import { TicketPdf } from '@/components/pdf/TicketPdf';
import { sendEmail } from '@/lib/email';
import React from 'react';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { seatId } = body;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminClient = createAdminClient();

    const { data: seat } = await adminClient
      .from('seats')
      .select('*')
      .eq('id', seatId)
      .maybeSingle();

    if (!seat) return NextResponse.json({ error: 'Seat not found' }, { status: 404 });
    if (!seat.guest_name || !seat.guest_email) {
      return NextResponse.json({ error: 'Guest name and email required' }, { status: 400 });
    }

    let { qr_token, pass_code } = seat;

    if (!qr_token || !pass_code) {
      pass_code = pass_code || `HRU${String(Math.floor(1000 + Math.random() * 9000))}`;
      qr_token = await signQrToken(pass_code);
    }

    // Fetch all seats sharing this pass_code for group tickets
    const { data: groupSeats } = await adminClient
      .from('seats')
      .select('id, section, row_label, seat_no')
      .eq('pass_code', pass_code)
      .order('row_label')
      .order('seat_no');

    const totalAdmit = groupSeats && groupSeats.length > 0 ? groupSeats.length : 1;
    const rows = groupSeats ? [...new Set(groupSeats.map(s => s.row_label))] : [seat.row_label];
    const displayRow = rows.join(', ');
    const displaySeat = rows.length === 1 && groupSeats
      ? groupSeats.map(s => s.seat_no).join(', ')
      : totalAdmit > 1 ? 'Multiple' : String(seat.seat_no);

    const qrCodeBuffer = await generateQrPngBuffer(qr_token);
    
    const pdfBuffer = await renderToBuffer(
      React.createElement(TicketPdf, {
        guestName: seat.guest_name,
        section: seat.section,
        row: displayRow,
        seatNo: displaySeat,
        passCode: pass_code,
        qrCodeBuffer,
        admitCount: totalAdmit
      }) as any
    );

    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Your E-Ticket for HRUDHAYAM LIVE 2026</title>
      </head>
      <body style="margin:0; padding:20px; background-color:#0B1E2B; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#FFFFFF;">
        <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:540px; background-color:#131F2E; border-radius:16px; overflow:hidden; border:1px solid #223345; box-shadow:0 8px 24px rgba(0,0,0,0.3);">
          
          <!-- Header Banner -->
          <tr>
            <td style="background-color:#07151E; padding:28px 24px; text-align:center; border-bottom:2px solid #D97706;">
              <p style="margin:0 0 6px 0; color:#E8913A; font-size:11px; font-weight:700; letter-spacing:1.5px; text-transform:uppercase;">
                Rotary Club of Aarch City Madras
              </p>
              <h1 style="margin:0; color:#FFFFFF; font-size:24px; font-weight:800; letter-spacing:1px;">
                HRUDHAYAM LIVE 2026
              </h1>
              <p style="margin:6px 0 0 0; color:#94A3B8; font-size:12px;">
                Fundraiser Musical Concert in Aid of Public-Access AEDs
              </p>
            </td>
          </tr>

          <!-- Golden Accent Strip -->
          <tr>
            <td style="background-color:#D97706; padding:6px 12px; text-align:center;">
              <p style="margin:0; color:#0B1E2B; font-size:11px; font-weight:800; letter-spacing:1px; text-transform:uppercase;">
                Official Donor E-Pass • Admit ${totalAdmit}
              </p>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding:28px 24px;">
              <p style="margin:0 0 16px 0; font-size:15px; line-height:1.5; color:#F1F5F9;">
                Dear <strong>${seat.guest_name}</strong>,
              </p>
              <p style="margin:0 0 20px 0; font-size:14px; line-height:1.5; color:#94A3B8;">
                Thank you for your generous contribution. Your admission pass for <strong>Hrudhayam LIVE 2026</strong> is confirmed (${totalAdmit} ${totalAdmit > 1 ? 'seats' : 'seat'}).
              </p>

              <!-- Seat Coordinates Card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0E1724; border-radius:12px; border:1px solid #223345; margin-bottom:24px;">
                <tr>
                  <td style="padding:14px; text-align:center; border-right:1px solid #223345; width:33%;">
                    <span style="font-size:10px; font-weight:700; color:#E8913A; text-transform:uppercase; display:block;">Section</span>
                    <span style="font-size:15px; font-weight:800; color:#FFFFFF; display:block; margin-top:2px;">${seat.section}</span>
                  </td>
                  <td style="padding:14px; text-align:center; border-right:1px solid #223345; width:33%;">
                    <span style="font-size:10px; font-weight:700; color:#E8913A; text-transform:uppercase; display:block;">Row</span>
                    <span style="font-size:15px; font-weight:800; color:#FFFFFF; display:block; margin-top:2px;">${displayRow}</span>
                  </td>
                  <td style="padding:14px; text-align:center; width:33%;">
                    <span style="font-size:10px; font-weight:700; color:#E8913A; text-transform:uppercase; display:block;">${totalAdmit > 1 ? 'Seats' : 'Seat No'}</span>
                    <span style="font-size:15px; font-weight:800; color:#FFFFFF; display:block; margin-top:2px;">${displaySeat}</span>
                  </td>
                </tr>
              </table>

              <!-- QR Code Display -->
              <div style="text-align:center; padding:20px; background-color:#07151E; border-radius:14px; border:1px solid #1E3A4C; margin-bottom:24px;">
                <div style="display:inline-block; background-color:#FFFFFF; padding:10px; border-radius:10px;">
                  <img src="cid:qrcode" alt="Entry QR Code" width="150" height="150" style="display:block; margin:0 auto;" />
                </div>
                <p style="margin:12px 0 0 0; color:#E8913A; font-family:monospace; font-size:16px; font-weight:700; letter-spacing:2px;">
                  ${pass_code}
                </p>
                <p style="margin:4px 0 0 0; color:#94A3B8; font-size:11px;">
                  Scan this code at venue entry (Valid for ${totalAdmit} ${totalAdmit > 1 ? 'Guests' : 'Guest'})
                </p>
              </div>

              <!-- Venue Details -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px; font-size:13px; color:#CBD5E1;">
                <tr>
                  <td style="padding:4px 0;"><strong>Date:</strong> Friday, 9 October 2026</td>
                </tr>
                <tr>
                  <td style="padding:4px 0;"><strong>Venue:</strong> The Music Academy, TTK Road, Alwarpet, Chennai</td>
                </tr>
                <tr>
                  <td style="padding:4px 0;"><strong>Gates Open:</strong> 5:30 PM • <strong>Show Begins:</strong> 6:30 PM</td>
                </tr>
              </table>

              <p style="margin:0; font-size:12px; line-height:1.5; color:#64748B;">
                • Please find your official printable ticket PDF attached to this email.<br/>
                • Each pass allows one-time scan entry at the door.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#07151E; border-top:1px solid #223345; padding:16px 24px; text-align:center;">
              <p style="margin:0; color:#64748B; font-size:11px;">
                Rotary Club of Aarch City Madras • Hrudhayam LIVE 2026
              </p>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    await sendEmail({
      to: seat.guest_email,
      subject: `Your E-Ticket for HRUDHAYAM LIVE (Pass ${pass_code} • ${totalAdmit} Seat${totalAdmit > 1 ? 's' : ''})`,
      html: htmlBody,
      attachments: [
        {
          filename: `Hrudhayam-Pass-${pass_code}.pdf`,
          content: pdfBuffer
        },
        {
          filename: 'qrcode.png',
          content: qrCodeBuffer,
          content_id: 'qrcode'
        }
      ]
    });

    // Update seat status for all seats sharing this pass_code
    await adminClient
      .from('seats')
      .update({
        ticket_sent: true,
        ticket_sent_at: new Date().toISOString(),
        qr_token,
        pass_code
      })
      .eq('pass_code', pass_code);

    return NextResponse.json({ success: true, passCode: pass_code });
  } catch (error: any) {
    console.error('Email Send Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
