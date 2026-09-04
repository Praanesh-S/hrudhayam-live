import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateQrPngBuffer } from '@/lib/qrcode';
import { renderToBuffer } from '@react-pdf/renderer';
import { TicketPdf } from '@/components/pdf/TicketPdf';
import React from 'react';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const passCode = searchParams.get('passCode') || searchParams.get('pass_code');
  const saleId = searchParams.get('saleId');
  const seatId = searchParams.get('seatId');
  return handleGenerate({ passCode, saleId, seatId });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    return handleGenerate(body);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
}

async function handleGenerate({ passCode, saleId, seatId }: { passCode?: string | null; saleId?: string | null; seatId?: string | null }) {
  try {
    const targetCode = passCode || seatId || saleId;
    if (!targetCode) {
      return NextResponse.json({ error: 'Pass code or Sale ID required' }, { status: 400 });
    }

    const adminClient = createAdminClient();

    // 1. Try finding in sales table
    let { data: sale } = await adminClient
      .from('sales')
      .select('*, band:bands(name, standard_price)')
      .or(`id.eq.${targetCode},pass_code.eq.${targetCode}`)
      .maybeSingle();

    // 2. If not found, check legacy seats table
    if (!sale) {
      const { data: seat } = await adminClient
        .from('seats')
        .select('*')
        .or(`id.eq.${targetCode},pass_code.eq.${targetCode}`)
        .maybeSingle();

      if (seat && seat.guest_name) {
        sale = {
          id: seat.id,
          pass_code: seat.pass_code,
          donor_name: seat.guest_name,
          qr_token: seat.qr_token || seat.pass_code,
          band: {
            name: seat.tier === 5000 ? '₹5,000 Platinum' : seat.tier === 3000 ? '₹3,500 Gold' : '₹1,500 Bronze',
            standard_price: seat.tier || 5000,
          },
        } as any;
      }
    }

    if (!sale || !sale.donor_name || !sale.pass_code) {
      return NextResponse.json({ error: 'Valid pass record not found' }, { status: 404 });
    }

    const bandName = sale.band?.name || `₹${sale.standard_price?.toLocaleString('en-IN') || '5,000'} Band`;
    const qrCodeBuffer = await generateQrPngBuffer(sale.qr_token || sale.pass_code);

    const pdfBuffer = await renderToBuffer(
      React.createElement(TicketPdf, {
        donorName: sale.donor_name,
        bandName,
        passCode: sale.pass_code,
        qrCodeBuffer,
        admitCount: 1,
      }) as any
    );

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="Hrudhayam-Pass-${sale.pass_code}.pdf"`,
      },
    });
  } catch (error: any) {
    console.error('PDF Generation Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
