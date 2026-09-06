import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyQrToken } from '@/lib/tokens';
import { logAudit } from '@/lib/audit';

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized. Please log in.' }, { status: 401 });
    }

    const adminClient = createAdminClient();
    const body = await req.json();
    const { token, passCode, physicalSerial, action } = body;

    let searchField = '';
    let searchValue = '';

    // 1. Resolve identifier: QR Token, Pass Code, or Physical Serial
    if (token) {
      const decoded = await verifyQrToken(token);
      if (!decoded) {
        return NextResponse.json({
          success: false,
          error: 'SECURITY ALERT: Invalid or corrupted QR barcode. Could not verify signature.',
        }, { status: 400 });
      }
      searchField = 'pass_code';
      searchValue = decoded.passCode;
    } else if (passCode) {
      searchField = 'pass_code';
      searchValue = passCode.trim();
    } else if (physicalSerial) {
      searchField = 'physical_serial';
      searchValue = physicalSerial.trim();
    } else {
      return NextResponse.json({
        success: false,
        error: 'Please provide a QR barcode token, pass code, or physical serial number.',
      }, { status: 400 });
    }

    // 2. Lookup pass in passes table
    const { data: pass, error: passError } = await adminClient
      .from('passes')
      .select(`
        *,
        band:bands(label, price),
        payments(amount, status, mode, reference_no)
      `)
      .eq(searchField, searchValue)
      .maybeSingle();

    if (passError || !pass) {
      return NextResponse.json({
        success: false,
        error: `INVALID PASS: No active pass found for ${searchField === 'physical_serial' ? `Serial ${searchValue}` : `Code ${searchValue}`}.`,
      }, { status: 404 });
    }

    // Check cancellation
    if (pass.status === 'cancelled') {
      return NextResponse.json({
        success: false,
        error: `CANCELLED PASS: This pass was cancelled on ${new Date(pass.cancelled_at).toLocaleDateString('en-IN')}. Reason: ${pass.cancel_reason || 'Administrative cancellation'}.`,
        donorName: pass.donor_name,
        bandLabel: pass.band?.label,
        passCode: pass.pass_code,
      }, { status: 400 });
    }

    const bandLabel = pass.band?.label || 'Admission Pass';
    const isPaid = (pass.payments || []).some((p: any) => p.status === 'received');

    // 3. Supervisor Override action (§9)
    if (action === 'override') {
      if (user.role !== 'super_admin' && user.role !== 'system_admin') {
        return NextResponse.json({
          success: false,
          error: 'Only Super Admins or System Admins can override gate check-in.',
        }, { status: 403 });
      }

      const now = new Date().toISOString();
      await adminClient
        .from('passes')
        .update({
          status: 'used',
          used_at: now,
          updated_at: now,
        })
        .eq('id', pass.id);

      await logAudit(user.id, 'GATE_SCAN_OVERRIDE', 'passes', pass.id, {
        pass_code: pass.pass_code,
        donor_name: pass.donor_name,
        band: bandLabel,
        overridden_by: user.fullName,
      });

      return NextResponse.json({
        success: true,
        overridden: true,
        message: 'Supervisor admission override recorded.',
        donorName: pass.donor_name,
        bandLabel,
        passCode: pass.pass_code,
        ticketType: pass.ticket_type,
        physicalSerial: pass.physical_serial,
      });
    }

    // 4. Duplicate scan check (Rule R8: Single use)
    if (pass.status === 'used') {
      const usedTime = pass.used_at 
        ? new Date(pass.used_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
        : 'earlier today';

      return NextResponse.json({
        success: false,
        duplicate: true,
        error: `ALREADY ENTERED: This pass was already admitted at ${usedTime}. Duplicate scans are rejected.`,
        donorName: pass.donor_name,
        bandLabel,
        passCode: pass.pass_code,
        usedAt: pass.used_at,
        isPaid,
      });
    }

    // 5. Atomic check-in transition (Rule R8 race condition guard)
    const now = new Date().toISOString();
    const { data: updatedPass, error: updateError } = await adminClient
      .from('passes')
      .update({
        status: 'used',
        used_at: now,
        updated_at: now,
      })
      .eq('id', pass.id)
      .eq('status', 'issued') // Guarantees only 1 concurrent scan succeeds
      .select('id, used_at')
      .maybeSingle();

    if (updateError || !updatedPass) {
      return NextResponse.json({
        success: false,
        duplicate: true,
        error: 'ALREADY ENTERED: Another gate scanner just admitted this pass moments ago.',
        donorName: pass.donor_name,
        bandLabel,
        passCode: pass.pass_code,
      });
    }

    // 6. Audit Log
    await logAudit(user.id, 'GATE_CHECKIN', 'passes', pass.id, {
      pass_code: pass.pass_code,
      donor_name: pass.donor_name,
      band: bandLabel,
      ticket_type: pass.ticket_type,
      scanned_by: user.fullName,
    });

    return NextResponse.json({
      success: true,
      duplicate: false,
      donorName: pass.donor_name,
      bandLabel,
      passCode: pass.pass_code,
      ticketType: pass.ticket_type,
      physicalSerial: pass.physical_serial,
      isPaid,
      usedAt: now,
    });
  } catch (err: any) {
    console.error('Checkin verify error:', err);
    return NextResponse.json({ success: false, error: err.message || 'Check-in failed.' }, { status: 500 });
  }
}
