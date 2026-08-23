import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { verifyQrToken } from '@/lib/tokens';

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, door_duty')
      .eq('id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 403 });
    }

    const body = await req.json();
    const { token, passCode } = body;

    let targetPassCode = passCode;

    if (token) {
      const decoded = await verifyQrToken(token);
      if (!decoded) {
        return NextResponse.json({ success: false, error: 'Invalid or expired QR token' }, { status: 400 });
      }
      targetPassCode = decoded.passCode;
    }

    if (!targetPassCode) {
      return NextResponse.json({ success: false, error: 'No pass code provided' }, { status: 400 });
    }

// Lookup seats
    const { data: seats, error: seatError } = await supabase
      .from('seats')
      .select('*')
      .eq('pass_code', targetPassCode);

    if (seatError || !seats || seats.length === 0) {
      return NextResponse.json({ success: false, error: 'Pass not found' }, { status: 404 });
    }

    const firstSeat = seats[0];

    // Permission check
    const isSuperAdmin = profile.role === 'super_admin';
    const hasDoorDuty = profile.door_duty === true;
    const isOwner = firstSeat.owner_id === user.id;

    if (!isSuperAdmin && !hasDoorDuty && !isOwner) {
      return NextResponse.json({ 
        success: false, 
        error: 'You do not have permission to check in this guest' 
      }, { status: 403 });
    }

    // Check duplicate
    if (firstSeat.checked_in) {
      return NextResponse.json({
        success: false,
        duplicate: true,
        guestName: firstSeat.guest_name,
        originalScanTime: firstSeat.checked_in_at,
        admitCount: seats.length
      });
    }

    // Mark all as checked in
    const now = new Date().toISOString();
    const seatIds = seats.map(s => s.id);
    const { error: updateError } = await supabase
      .from('seats')
      .update({ 
        checked_in: true,
        checked_in_at: now
      })
      .in('id', seatIds);

    if (updateError) {
      return NextResponse.json({ success: false, error: 'Failed to update check-in status' }, { status: 500 });
    }

    // Format display string
    const rows = [...new Set(seats.map(s => s.row_label))];
    const displayRow = rows.join(', ');
    const displaySeat = rows.length === 1 ? seats.map(s => s.seat_no).join(', ') : 'Multiple';

    return NextResponse.json({
      success: true,
      guestName: firstSeat.guest_name,
      seatId: firstSeat.id, // Primary seat ID for reference
      section: firstSeat.section,
      row: displayRow,
      seatNo: displaySeat,
      admitCount: seats.length
    });

  } catch (error) {
    console.error('Check-in error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
