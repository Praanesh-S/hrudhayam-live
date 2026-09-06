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
