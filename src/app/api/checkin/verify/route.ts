import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyQrToken } from '@/lib/tokens';
import { logAudit } from '@/lib/audit';

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
    const { token, passCode, action } = body;

    let targetPassCode = passCode;

    // 1. Cryptographically verify QR token if token string was passed
    if (token) {
      const decoded = await verifyQrToken(token);
      if (!decoded) {
        return NextResponse.json({ 
          success: false, 
          error: 'SECURITY ALERT: Invalid or tampered QR token. This barcode cannot be verified.' 
        }, { status: 400 });
      }
      targetPassCode = decoded.passCode;
    }

    if (!targetPassCode) {
      return NextResponse.json({ success: false, error: 'No pass code or QR token provided' }, { status: 400 });
    }

    // 2. Lookup sale in sales table
    let { data: sale } = await adminClient
      .from('sales')
      .select('*, band:bands(name, standard_price), checked_in_profile:profiles!sales_checked_in_by_fkey(full_name)')
      .eq('pass_code', targetPassCode)
      .maybeSingle();

    // Fallback to legacy seats if not found
    if (!sale) {
      const { data: seat } = await adminClient
        .from('seats')
        .select('*')
        .eq('pass_code', targetPassCode)
        .maybeSingle();

      if (seat && seat.guest_name) {
        sale = {
          id: seat.id,
          pass_code: seat.pass_code,
          donor_name: seat.guest_name,
          payment_status: seat.payment_status || 'pending',
          checked_in: seat.checked_in || false,
          checked_in_at: seat.checked_in_at,
          checked_in_by: seat.checked_in_by,
          cancelled: false,
          band: {
            name: seat.tier === 5000 ? '₹5,000 Platinum' : seat.tier === 3000 ? '₹3,500 Gold' : '₹1,500 Bronze',
            standard_price: seat.tier || 5000,
          },
        } as any;
      }
    }

    if (!sale || sale.cancelled) {
      return NextResponse.json({ 
        success: false, 
        error: 'CANCELLED / INVALID PASS: This pass has been cancelled or released back to inventory.' 
      }, { status: 404 });
    }

    // 3. Permission check
    const isSuperAdmin = profile.role === 'super_admin';
    const isSystemAdmin = profile.role === 'system_admin';
    const hasDoorDuty = profile.door_duty === true;
    const isOwner = sale.sold_by === user.id;

    if (!isSuperAdmin && !isSystemAdmin && !hasDoorDuty && !isOwner) {
      return NextResponse.json({ 
        success: false, 
        error: 'Permission Denied: You do not have door duty scanner authorization.' 
      }, { status: 403 });
    }

    const bandName = sale.band?.name || `₹${sale.standard_price?.toLocaleString('en-IN') || '5,000'} Band`;

    // 4. SUPER ADMIN / SYSTEM ADMIN OVERRIDE ACTION
    if (action === 'override') {
      if (!isSuperAdmin && !isSystemAdmin) {
        return NextResponse.json({ 
          success: false, 
          error: 'Only Super Admins or System Admins can override check-in status.' 
        }, { status: 403 });
      }

      const now = new Date().toISOString();
      await adminClient
        .from('sales')
        .update({
          checked_in: true,
          checked_in_at: now,
          checked_in_by: user.id,
          updated_at: now,
        })
        .eq('id', sale.id);

      await logAudit(
        user.id,
        'CHECK_IN_OVERRIDE',
        'sale',
        sale.id,
        {
          pass_code: sale.pass_code,
          donor_name: sale.donor_name,
          band_name: bandName,
          override_by_role: profile.role,
          overridden_by_name: profile.full_name,
        }
      );

      return NextResponse.json({
        success: true,
        overridden: true,
        message: 'Supervisor admission override applied successfully.',
        donorName: sale.donor_name,
        bandName,
        passCode: sale.pass_code,
        paymentStatus: sale.payment_status,
      });
    }

    // 5. DUPLICATE SCAN CHECK
    if (sale.checked_in) {
      let checkedInByName = sale.checked_in_profile?.full_name || 'Gate Volunteer';

      if (!sale.checked_in_profile && sale.checked_in_by) {
        const { data: verifier } = await adminClient
          .from('profiles')
          .select('full_name')
          .eq('id', sale.checked_in_by)
          .single();
        if (verifier?.full_name) checkedInByName = verifier.full_name;
      }

      return NextResponse.json({
        success: false,
        duplicate: true,
        error: `ALREADY CHECKED IN: This pass was scanned and admitted at ${new Date(sale.checked_in_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} by ${checkedInByName}.`,
        donorName: sale.donor_name,
        bandName,
        passCode: sale.pass_code,
        originalScanTime: sale.checked_in_at,
        checkedInByName,
        paymentStatus: sale.payment_status,
      });
    }

    // 6. VALID FIRST-TIME CHECK-IN
    const now = new Date().toISOString();
    const { error: updateError } = await adminClient
      .from('sales')
      .update({
        checked_in: true,
        checked_in_at: now,
        checked_in_by: user.id,
        updated_at: now,
      })
      .eq('id', sale.id);

    if (updateError) throw updateError;

    await logAudit(
      user.id,
      'CHECK_IN',
      'sale',
      sale.id,
      {
        pass_code: sale.pass_code,
        donor_name: sale.donor_name,
        band_name: bandName,
        scanned_by: profile.full_name,
      }
    );

    return NextResponse.json({
      success: true,
      duplicate: false,
      donorName: sale.donor_name,
      bandName,
      passCode: sale.pass_code,
      paymentStatus: sale.payment_status,
      checkedInAt: now,
    });
  } catch (err: any) {
    console.error('Check-in verification error:', err);
    return NextResponse.json({ success: false, error: err.message || 'Internal check-in error' }, { status: 500 });
  }
}
