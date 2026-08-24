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
      .select('role, door_duty, full_name')
      .eq('id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 403 });
    }

    const body = await req.json();
    const { token, passCode, action, count } = body;

    let targetPassCode = passCode;

    // Cryptographically verify QR token if token string was passed
    if (token) {
      const decoded = await verifyQrToken(token);
      if (!decoded) {
        return NextResponse.json({ 
          success: false, 
          error: 'SECURITY ALERT: Invalid or tampered QR token. This code cannot be verified.' 
        }, { status: 400 });
      }
      targetPassCode = decoded.passCode;
    }

    if (!targetPassCode) {
      return NextResponse.json({ success: false, error: 'No pass code or QR token provided' }, { status: 400 });
    }

    // Lookup active seats by pass_code or seat ID
    let { data: seats, error: seatError } = await adminClient
      .from('seats')
      .select('*')
      .eq('pass_code', targetPassCode)
      .order('row_label')
      .order('seat_no');

    if (!seats || seats.length === 0) {
      const { data: fallbackSeats } = await adminClient
        .from('seats')
        .select('*')
        .eq('id', targetPassCode);
      seats = fallbackSeats;
    }

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
        error: 'Permission Denied: You do not have door duty scanner authorization.' 
      }, { status: 403 });
    }

    const totalSeats = seats.length;
    const checkedInSeats = seats.filter(s => s.checked_in);
    const unadmittedSeats = seats.filter(s => !s.checked_in);
    const checkedInCount = checkedInSeats.length;
    const remainingCount = unadmittedSeats.length;

    const rows = [...new Set(seats.map(s => s.row_label))];
    const displayRow = rows.join(', ');
    const displaySeat = rows.length === 1 ? seats.map(s => s.seat_no).join(', ') : 'Multiple';

    // 0. SUPER ADMIN OVERRIDE ACTION
    if (action === 'override') {
      if (profile.role !== 'super_admin') {
        return NextResponse.json({ success: false, error: 'Only Super Admins can override check-in status.' }, { status: 403 });
      }

      const seatIds = seats.map(s => s.id);
      const { error: overrideError } = await adminClient
        .from('seats')
        .update({
          checked_in: false,
          checked_in_at: null,
          checked_in_by: null,
        })
        .in('id', seatIds);

      if (overrideError) {
        return NextResponse.json({ success: false, error: 'Failed to override check-in status.' }, { status: 500 });
      }

      // Record in audit log
      try {
        await adminClient.from('audit_logs').insert({
          user_id: user.id,
          action: 'OVERRIDE',
          entity_type: 'pass',
          entity_id: firstSeat.pass_code || firstSeat.id,
          details: {
            guest_name: firstSeat.guest_name,
            overridden_by: profile.full_name || user.email,
            seat_ids: seatIds,
            reason: body.reason || 'Manual Super Admin check-in reset'
          }
        });
      } catch (e) {
        console.warn('Audit log write error:', e);
      }

      return NextResponse.json({
        success: true,
        overridden: true,
        message: `Pass ${firstSeat.pass_code || firstSeat.id} successfully reset for re-admission.`,
        totalSeats,
        remainingCount: totalSeats,
        checkedInCount: 0,
      });
    }

    // Lookup who checked in the already-admitted seat
    let checkerName: string | null = null;
    const checkedInWithChecker = checkedInSeats.find(s => s.checked_in_by);
    if (checkedInWithChecker?.checked_in_by) {
      const { data: checkerProfile } = await adminClient
        .from('profiles')
        .select('full_name, email')
        .eq('id', checkedInWithChecker.checked_in_by)
        .maybeSingle();
      checkerName = checkerProfile?.full_name || checkerProfile?.email || null;
    }

    // 1. ALL SEATS ALREADY CHECKED IN -> Duplicate Rejection
    if (remainingCount === 0) {
      return NextResponse.json({
        success: false,
        duplicate: true,
        allAdmitted: true,
        guestName: firstSeat.guest_name,
        passCode: firstSeat.pass_code,
        originalScanTime: checkedInSeats[0]?.checked_in_at || new Date().toISOString(),
        checkedInBy: checkerName,
        totalSeats,
        checkedInCount,
        remainingCount: 0,
        section: firstSeat.section,
        row: displayRow,
        seatNo: displaySeat,
        error: `ALL ${totalSeats} GUEST(S) ALREADY ADMITTED. No remaining admissions on Pass ${firstSeat.pass_code || firstSeat.id}.`
      });
    }

    // 2. SINGLE PASS (1 Seat) -> Immediate Automatic Check-in
    if (totalSeats === 1) {
      const now = new Date().toISOString();
      const { error: updateError } = await adminClient
        .from('seats')
        .update({ 
          checked_in: true,
          checked_in_at: now,
          checked_in_by: user.id
        })
        .eq('id', firstSeat.id);

      if (updateError) {
        return NextResponse.json({ success: false, error: 'Failed to update check-in status' }, { status: 500 });
      }

      // Record in audit log
      try {
        await adminClient.from('audit_logs').insert({
          user_id: user.id,
          action: 'CHECK_IN',
          entity_type: 'seat',
          entity_id: firstSeat.id,
          details: {
            guest_name: firstSeat.guest_name,
            pass_code: firstSeat.pass_code,
            section: firstSeat.section,
            row: firstSeat.row_label,
            seat_no: firstSeat.seat_no,
            scanned_by: profile.full_name || user.email
          }
        });
      } catch (e) {
        console.warn('Audit log write error:', e);
      }

      return NextResponse.json({
        success: true,
        isGroup: false,
        admittedNow: 1,
        totalSeats: 1,
        checkedInCount: 1,
        remainingCount: 0,
        guestName: firstSeat.guest_name,
        passCode: firstSeat.pass_code,
        seatId: firstSeat.id,
        section: firstSeat.section,
        row: firstSeat.row_label,
        seatNo: String(firstSeat.seat_no)
      });
    }

    // 3. GROUP PASS (Multiple Seats)
    // If action is 'admit' and count is provided -> execute partial/batch check-in
    if (action === 'admit' && typeof count === 'number' && count > 0) {
      const admitBatchCount = Math.min(count, remainingCount);
      const seatsToAdmit = unadmittedSeats.slice(0, admitBatchCount);
      const seatIdsToAdmit = seatsToAdmit.map(s => s.id);
      const now = new Date().toISOString();

      const { error: updateError } = await adminClient
        .from('seats')
        .update({ 
          checked_in: true,
          checked_in_at: now,
          checked_in_by: user.id
        })
        .in('id', seatIdsToAdmit);

      if (updateError) {
        return NextResponse.json({ success: false, error: 'Failed to process batch admission' }, { status: 500 });
      }

      // Record in audit log
      try {
        await adminClient.from('audit_logs').insert({
          user_id: user.id,
          action: 'CHECK_IN',
          entity_type: 'pass',
          entity_id: firstSeat.pass_code || firstSeat.id,
          details: {
            guest_name: firstSeat.guest_name,
            admitted_count: admitBatchCount,
            admitted_seats: seatIdsToAdmit,
            remaining_seats: remainingCount - admitBatchCount,
            total_seats: totalSeats,
            scanned_by: profile.full_name || user.email
          }
        });
      } catch (e) {
        console.warn('Audit log write error:', e);
      }

      const admittedRows = [...new Set(seatsToAdmit.map(s => s.row_label))].join(', ');
      const admittedSeatNos = seatsToAdmit.map(s => s.seat_no).join(', ');

      return NextResponse.json({
        success: true,
        isGroup: true,
        admittedNow: admitBatchCount,
        totalSeats,
        checkedInCount: checkedInCount + admitBatchCount,
        remainingCount: remainingCount - admitBatchCount,
        guestName: firstSeat.guest_name,
        passCode: firstSeat.pass_code,
        section: firstSeat.section,
        row: admittedRows,
        seatNo: admittedSeatNos,
      });
    }

    // 4. GROUP PASS INITIAL SCAN -> Return batch selection details for the Door Scanner modal
    return NextResponse.json({
      success: true,
      requiresBatchSelection: true,
      isGroup: true,
      passCode: firstSeat.pass_code || firstSeat.id,
      guestName: firstSeat.guest_name,
      totalSeats,
      checkedInCount,
      remainingCount,
      section: firstSeat.section,
      rows,
      seatNumbers: seats.map(s => s.seat_no).join(', '),
      previouslyAdmittedAt: checkedInSeats[0]?.checked_in_at || null,
      checkedInBy: checkerName,
      seatsList: seats.map(s => ({
        id: s.id,
        row_label: s.row_label,
        seat_no: s.seat_no,
        checked_in: s.checked_in,
        checked_in_at: s.checked_in_at
      }))
    });

  } catch (error: any) {
    console.error('Check-in error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
