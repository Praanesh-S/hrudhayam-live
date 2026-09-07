import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAudit } from '@/lib/audit';

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized. Please log in.' }, { status: 401 });
    }

    const adminClient = createAdminClient();
    const body = await req.json();
    const { serialNo, action } = body;

    const rawSerial = (serialNo || '').trim();

    if (!rawSerial) {
      return NextResponse.json({
        success: false,
        error: 'Please enter a physical pass serial number.',
      }, { status: 400 });
    }

    // Lookup pass by serial_no (or pass_code fallback)
    const { data: pass, error: passError } = await adminClient
      .from('passes')
      .select(`
        *,
        band:bands(label, price),
        payments(amount, status, mode, reference_no)
      `)
      .or(`serial_no.ilike.${rawSerial},pass_code.ilike.${rawSerial}`)
      .maybeSingle();

    if (passError || !pass) {
      return NextResponse.json({
        success: false,
        error: `INVALID SERIAL: No pass record found matching "${rawSerial}". Check for typing error or refer to printed manifest.`,
      }, { status: 404 });
    }

    // Check cancellation
    if (pass.status === 'cancelled') {
      return NextResponse.json({
        success: false,
        error: `CANCELLED PASS: This pass was cancelled on ${new Date(pass.cancelled_at).toLocaleDateString('en-IN')}. Reason: ${pass.cancel_reason || 'Administrative cancellation'}.`,
        donorName: pass.donor_name,
        bandLabel: pass.band?.label,
        serialNo: pass.serial_no || pass.pass_code,
      }, { status: 400 });
    }

    const bandLabel = pass.band?.label || 'Admission Pass';
    const isPaid = (pass.payments || []).some((p: any) => p.status === 'received');

    // Anti-Reuse / Anti-Photocopy Check (§Step 1):
    // A serial can be marked "entered" once; a second entry attempt on the same serial is rejected.
    if ((pass.entered_at || pass.used_at) && action !== 'override') {
      const entryTime = new Date(pass.entered_at || pass.used_at).toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      return NextResponse.json({
        success: false,
        duplicate: true,
        error: `ANTI-REUSE ALERT: This physical pass (Serial: ${pass.serial_no || pass.pass_code}) was already admitted at ${entryTime}. DO NOT ADMIT — possible photocopy or duplicate pass.`,
        donorName: pass.donor_name,
        bandLabel,
        rowLabel: pass.row_label || 'Unspecified',
        serialNo: pass.serial_no || pass.pass_code,
        usedAt: pass.entered_at || pass.used_at,
        isPaid,
      }, { status: 409 });
    }

    // Check-in admission (First time)
    const now = new Date().toISOString();
    const { error: updateError } = await adminClient
      .from('passes')
      .update({
        status: 'used',
        used_at: now,
        entered_at: now,
        updated_at: now,
      })
      .eq('id', pass.id);

    if (updateError) {
      throw updateError;
    }

    await logAudit(user.id, action === 'override' ? 'GATE_ENTRY_OVERRIDE' : 'GATE_ENTRY_SUCCESS', 'passes', pass.id, {
      serial_no: pass.serial_no || pass.pass_code,
      donor_name: pass.donor_name,
      band: bandLabel,
      row_label: pass.row_label,
      staff_user: user.fullName,
    });

    return NextResponse.json({
      success: true,
      donorName: pass.donor_name,
      bandLabel,
      rowLabel: pass.row_label || 'Row Open',
      serialNo: pass.serial_no || pass.pass_code,
      isPaid,
      usedAt: now,
      message: 'Admission pass verified and marked as ENTERED.',
    });
  } catch (err: any) {
    console.error('Error verifying serial check-in:', err);
    return NextResponse.json({ success: false, error: err.message || 'Server error during check-in' }, { status: 500 });
  }
}
