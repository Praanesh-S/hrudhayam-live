'use server';

import { requireUser } from '@/lib/auth/guards';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAudit } from '@/lib/audit';
import { revalidatePath } from 'next/cache';

export async function updatePassDonorDetails(
  passId: string,
  updates: { donor_name: string; donor_phone: string; donor_email?: string | null }
) {
  const user = await requireUser();
  const adminClient = createAdminClient();

  const { data: existing, error: fetchErr } = await adminClient
    .from('passes')
    .select('*')
    .eq('id', passId)
    .single();

  if (fetchErr || !existing) {
    return { success: false, error: 'Pass not found' };
  }

  // If Group Admin, can only edit passes attributed to their group (or if System/Super Admin)
  if (user.role === 'group_admin' && user.groupId) {
    if (existing.seller_member_id) {
      const { data: member } = await adminClient
        .from('members')
        .select('group_id')
        .eq('id', existing.seller_member_id)
        .single();
      if (member?.group_id !== user.groupId) {
        return { success: false, error: 'Cannot edit passes outside your team' };
      }
    }
  }

  const cleanPhone = updates.donor_phone.replace(/\D/g, '').slice(-10);
  if (cleanPhone.length !== 10) {
    return { success: false, error: 'Valid 10-digit phone number is required' };
  }

  const { error: updateErr } = await adminClient
    .from('passes')
    .update({
      donor_name: updates.donor_name.trim(),
      donor_phone: cleanPhone,
      donor_email: updates.donor_email?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', passId);

  if (updateErr) {
    return { success: false, error: updateErr.message };
  }

  await logAudit(
    user.id,
    'UPDATE_PASS_DONOR',
    'passes',
    passId,
    { donor_name: existing.donor_name, donor_phone: existing.donor_phone },
    { donor_name: updates.donor_name.trim(), donor_phone: cleanPhone }
  );

  revalidatePath('/guests');
  return { success: true };
}

export async function deletePassAction(
  passId: string, 
  reason: string = 'Administrative removal',
  hardDelete: boolean = true
) {
  try {
    const user = await requireUser();
    const adminClient = createAdminClient();

    // 1. Fetch pass
    const { data: pass, error: fetchErr } = await adminClient
      .from('passes')
      .select('*, seller:members(id, full_name, group_id)')
      .eq('id', passId)
      .single();

    if (fetchErr || !pass) {
      return { success: false, error: 'Pass not found.' };
    }

    // 2. Permission check
    // Super admin & system admin can delete any pass.
    // Group admin can only delete within their team.
    if (user.role === 'group_admin' && user.groupId) {
      if (pass.seller?.group_id !== user.groupId) {
        return { success: false, error: 'You do not have permission to delete passes outside your team.' };
      }
    }

    const now = new Date().toISOString();

    // 3. Delete or void payments
    if (hardDelete) {
      await adminClient.from('payments').delete().eq('pass_id', passId);
    } else {
      await adminClient
        .from('payments')
        .update({
          status: 'pending',
          reference_no: `CANCELLED: ${reason}`,
          updated_at: now,
        })
        .eq('pass_id', passId);
    }

    // 4. Release assigned seats if any
    if (pass.seat_id) {
      await adminClient
        .from('seats')
        .update({
          owner_id: null,
          guest_name: null,
          guest_phone: null,
          guest_email: null,
          pass_code: null,
          qr_token: null,
          payment_status: 'pending',
          updated_at: now,
        })
        .eq('id', pass.seat_id);
    }

    await adminClient
      .from('seats')
      .update({
        owner_id: null,
        guest_name: null,
        guest_phone: null,
        guest_email: null,
        pass_code: null,
        qr_token: null,
        payment_status: 'pending',
        updated_at: now,
      })
      .eq('pass_code', pass.pass_code);

    // 5. Delete or Cancel Pass
    if (hardDelete) {
      const { error: delErr } = await adminClient
        .from('passes')
        .delete()
        .eq('id', passId);

      if (delErr) throw delErr;
    } else {
      const { error: updErr } = await adminClient
        .from('passes')
        .update({
          status: 'cancelled',
          cancelled_at: now,
          cancelled_by: user.id,
          cancel_reason: reason,
          updated_at: now,
        })
        .eq('id', passId);

      if (updErr) throw updErr;
    }

    // 6. Audit log
    await logAudit(
      user.id,
      hardDelete ? 'PASS_DELETE_PERMANENT' : 'PASS_CANCEL',
      'passes',
      passId,
      {
        pass_code: pass.pass_code,
        donor_name: pass.donor_name,
        donor_phone: pass.donor_phone,
        band_id: pass.band_id,
        hard_deleted: hardDelete,
        reason: reason.trim(),
        performed_by: user.fullName || user.loginId,
      }
    );

    // 7. Revalidate
    revalidatePath('/guests');
    revalidatePath('/sell');
    revalidatePath('/dashboard');
    revalidatePath('/reports');
    revalidatePath('/leaderboard');
    revalidatePath('/payments');
    revalidatePath('/admin/bands');
    revalidatePath('/admin/passes');

    return { 
      success: true, 
      message: `Pass ${pass.pass_code} has been successfully ${hardDelete ? 'deleted' : 'cancelled'} and inventory released.` 
    };
  } catch (err: any) {
    console.error('Error deleting pass:', err);
    return { success: false, error: err.message || 'Failed to delete pass.' };
  }
}
