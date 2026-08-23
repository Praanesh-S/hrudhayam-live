import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyQrToken } from '@/lib/tokens';

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const adminClient = createAdminClient();

    const { data: profile } = await adminClient
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
        return NextResponse.json({ 
          success: false, 
          error: 'Invalid or corrupted QR token. This code does not exist.' 
        }, { status: 400 });
      }
      targetPassCode = decoded.passCode;
    }

    if (!targetPassCode) {
      return NextResponse.json({ success: false, error: 'No pass code provided' }, { status: 400 });
    }

    // Lookup active seats by pass_code
    const { data: seats, error: seatError } = await adminClient
      .from('seats')
      .select('*')
      .eq('pass_code', targetPassCode);

    // If no seats match, or guest_name was cleared (revoked/cancelled)
    if (seatError || !seats || seats.length === 0 || !seats[0].guest_name) {
      return NextResponse.json({ 
        success: false, 
        error: 'CANCELLED / REVOKED PASS: This QR code is no longer valid. The ticket was cancelled and the seats have been released.' 
      }, { status: 404 });
    }

    const firstSeat = seats[0];

    // Permission check
    const isSuperAdmin = profile.role === 'super_admin';
    const hasDoorDuty = profile.door_duty === true;
    const isOwner = firstSeat.owner_id === user.id;

    if (!isSuperAdmin && !hasDoorDuty && !isOwner) {
      return NextResponse.json({ 
        success: false, 
        error: 'You do not have door check-in permission for this section.' 
      }, { status: 403 });
    }

    // Check duplicate check-in
    if (firstSeat.checked_in) {
      return NextResponse.json({
        success: false,
        duplicate: true,
        guestName: firstSeat.guest_name,
        originalScanTime: firstSeat.checked_in_at,
        admitCount: seats.length,
        section: firstSeat.section,
        row: firstSeat.row_label,
        seatNo: String(firstSeat.seat_no)
      });
    }

    // Mark all seats in this pass as checked in
    const now = new Date().toISOString();
    const seatIds = seats.map(s => s.id);
    const { error: updateError } = await adminClient
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
      seatId: firstSeat.id,
      section: firstSeat.section,
      row: displayRow,
      seatNo: displaySeat,
      admitCount: seats.length
    });

  } catch (error: any) {
    console.error('Check-in error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
