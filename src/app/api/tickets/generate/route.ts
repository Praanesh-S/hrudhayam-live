import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateQrPngBuffer } from '@/lib/qrcode';
import { renderToBuffer } from '@react-pdf/renderer';
import { TicketPdf } from '@/components/pdf/TicketPdf';
import React from 'react';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { seatId } = body;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: seat } = await supabase
      .from('seats')
      .select('*')
      .eq('id', seatId)
      .single();

    if (!seat) return NextResponse.json({ error: 'Seat not found' }, { status: 404 });

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'super_admin' && seat.owner_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!seat.guest_name || !seat.pass_code || !seat.qr_token) {
      return NextResponse.json({ error: 'Guest details incomplete' }, { status: 400 });
    }

    // Fetch all seats with the same pass code for group tickets
    const { data: groupSeats } = await supabase
      .from('seats')
      .select('id, section, row_label, seat_no')
      .eq('pass_code', seat.pass_code)
      .order('row_label')
      .order('seat_no');

    const isGroup = groupSeats && groupSeats.length > 1;
    let displayRow = seat.row_label;
    let displaySeat = String(seat.seat_no);

    if (isGroup) {
      const rows = [...new Set(groupSeats.map(s => s.row_label))];
      displayRow = rows.join(', ');
      
      if (rows.length === 1) {
        // all in same row
        displaySeat = groupSeats.map(s => s.seat_no).join(', ');
      } else {
        // multiple rows
        displaySeat = 'Multiple';
      }
    }

    const qrCodeBuffer = await generateQrPngBuffer(seat.qr_token);
    
    const pdfBuffer = await renderToBuffer(
      React.createElement(TicketPdf, {
        guestName: seat.guest_name,
        section: seat.section,
        row: displayRow,
        seatNo: displaySeat,
        passCode: seat.pass_code,
        qrCodeBuffer,
        admitCount: groupSeats ? groupSeats.length : 1
      }) as any
    );

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="Ticket-${seat.id}.pdf"`
      }
    });
  } catch (error: any) {
    console.error('PDF Generation Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
