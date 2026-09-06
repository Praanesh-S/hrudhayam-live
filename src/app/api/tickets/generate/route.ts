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
  const isDownload = searchParams.get('download') === '1' || searchParams.get('download') === 'true';
  return handleGenerate({ passCode, saleId, seatId, isDownload });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    return handleGenerate(body);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
}

async function handleGenerate({ passCode, saleId, seatId, isDownload }: { passCode?: string | null; saleId?: string | null; seatId?: string | null; isDownload?: boolean }) {
  try {
    const targetCode = passCode || seatId || saleId;
    if (!targetCode) {
      return NextResponse.json({ error: 'Pass code or Sale ID required' }, { status: 400 });
    }

    const adminClient = createAdminClient();
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetCode);

    // 1. Try finding in v2 passes table
    let passQuery = adminClient
      .from('passes')
      .select('*, band:bands(label, price, name, standard_price)');

    if (isUuid) {
      passQuery = passQuery.or(`id.eq.${targetCode},pass_code.eq.${targetCode}`);
    } else {
      passQuery = passQuery.eq('pass_code', targetCode);
    }

    const { data: pass } = await passQuery.maybeSingle();

    if (pass) {
      if (pass.status === 'cancelled') {
        return NextResponse.json({ error: 'Pass is cancelled' }, { status: 400 });
      }

      const bandName = pass.band?.label || pass.band?.name || `₹${pass.band?.price?.toLocaleString('en-IN') || '5,000'} Band`;
      const qrToken = pass.qr_token || pass.pass_code;
      const qrCodeBuffer = await generateQrPngBuffer(qrToken);

      const pdfBuffer = await renderToBuffer(
        React.createElement(TicketPdf, {
          donorName: pass.donor_name,
          bandName,
          passCode: pass.pass_code,
          qrCodeBuffer,
          admitCount: 1,
        }) as any
      );

      const disposition = isDownload ? 'attachment' : 'inline';

      return new NextResponse(new Uint8Array(pdfBuffer), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `${disposition}; filename="Hrudhayam-Pass-${pass.pass_code}.pdf"`,
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }

    // 2. Fallback to legacy sales table
    let saleQuery = adminClient
      .from('sales')
      .select('*, band:bands(name, standard_price)');

    if (isUuid) {
      saleQuery = saleQuery.or(`id.eq.${targetCode},pass_code.eq.${targetCode}`);
    } else {
      saleQuery = saleQuery.eq('pass_code', targetCode);
    }

    let { data: sale } = await saleQuery.maybeSingle();

    // 3. If not found, check legacy seats table
    if (!sale) {
      let seatQuery = adminClient.from('seats').select('*');
      if (isUuid) {
        seatQuery = seatQuery.or(`id.eq.${targetCode},pass_code.eq.${targetCode}`);
      } else {
        seatQuery = seatQuery.eq('pass_code', targetCode);
      }
      const { data: seat } = await seatQuery.maybeSingle();

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

    const disposition = isDownload ? 'attachment' : 'inline';

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${disposition}; filename="Hrudhayam-Pass-${sale.pass_code}.pdf"`,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error: any) {
    console.error('PDF Generation Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
