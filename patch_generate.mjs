import fs from 'fs';

let content = fs.readFileSync('src/app/api/tickets/generate/route.ts', 'utf8');

const replacement = `
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
`;

content = content.replace(/const { data: seat } = await supabase[\s\S]*?\) as any\n    \);/m, replacement.trim());

fs.writeFileSync('src/app/api/tickets/generate/route.ts', content);
