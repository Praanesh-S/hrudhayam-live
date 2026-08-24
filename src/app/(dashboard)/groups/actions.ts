'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAudit } from '@/lib/audit';

export async function createGroup(formData: {
  group_name: string;
  lead_contact_name: string;
  lead_contact_phone?: string;
  lead_contact_email?: string;
  notes?: string;
  seatIds?: string[];
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const adminClient = createAdminClient();

  // Create group record
  const { data: group, error } = await adminClient
    .from('groups')
    .insert({
      group_name: formData.group_name.trim(),
      lead_contact_name: formData.lead_contact_name.trim(),
      lead_contact_phone: formData.lead_contact_phone?.trim() || null,
      lead_contact_email: formData.lead_contact_email?.trim() || null,
      notes: formData.notes?.trim() || null,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  // If seatIds provided, assign to group and set lead contact as guest info
  if (formData.seatIds && formData.seatIds.length > 0) {
    const { error: seatError } = await adminClient
      .from('seats')
      .update({
        group_id: group.id,
        guest_name: formData.lead_contact_name.trim(),
        guest_phone: formData.lead_contact_phone?.trim() || null,
        guest_email: formData.lead_contact_email?.trim() || null,
      })
      .in('id', formData.seatIds);

    if (seatError) {
      console.error('[ASSIGN_SEATS_ERROR]', seatError);
    }
  }

  await logAudit(user.id, 'GROUP_CREATE', 'group', group.id, {
    groupName: group.group_name,
    leadContact: group.lead_contact_name,
    seatCount: formData.seatIds?.length || 0,
  });

  revalidatePath('/groups');
  revalidatePath('/guests');
  return { success: true, group };
}

export async function updateGroup(
  id: string,
  formData: {
    group_name: string;
    lead_contact_name: string;
    lead_contact_phone?: string;
    lead_contact_email?: string;
    notes?: string;
  }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const adminClient = createAdminClient();

  const { data: group, error } = await adminClient
    .from('groups')
    .update({
      group_name: formData.group_name.trim(),
      lead_contact_name: formData.lead_contact_name.trim(),
      lead_contact_phone: formData.lead_contact_phone?.trim() || null,
      lead_contact_email: formData.lead_contact_email?.trim() || null,
      notes: formData.notes?.trim() || null,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) return { error: error.message };

  // Update lead guest info on all grouped seats
  await adminClient
    .from('seats')
    .update({
      guest_name: formData.lead_contact_name.trim(),
      guest_phone: formData.lead_contact_phone?.trim() || null,
      guest_email: formData.lead_contact_email?.trim() || null,
    })
    .eq('group_id', id);

  await logAudit(user.id, 'GROUP_UPDATE', 'group', id, {
    groupName: group.group_name,
    leadContact: group.lead_contact_name,
  });

  revalidatePath('/groups');
  revalidatePath('/guests');
  return { success: true, group };
}

export async function deleteGroup(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const adminClient = createAdminClient();

  // Untag seats from group
  await adminClient.from('seats').update({ group_id: null }).eq('group_id', id);

  const { error } = await adminClient.from('groups').delete().eq('id', id);
  if (error) return { error: error.message };

  await logAudit(user.id, 'GROUP_DELETE', 'group', id, {});

  revalidatePath('/groups');
  revalidatePath('/guests');
  return { success: true };
}

export async function assignSeatsToGroup(groupId: string, seatIds: string[]) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const adminClient = createAdminClient();

  // Fetch group details
  const { data: group } = await adminClient.from('groups').select('*').eq('id', groupId).single();
  if (!group) return { error: 'Group not found' };

  // Update seats with group_id and lead contact info
  const { error } = await adminClient
    .from('seats')
    .update({
      group_id: groupId,
      guest_name: group.lead_contact_name,
      guest_phone: group.lead_contact_phone,
      guest_email: group.lead_contact_email,
    })
    .in('id', seatIds);

  if (error) return { error: error.message };

  await logAudit(user.id, 'GROUP_ASSIGN', 'group', groupId, {
    seatIds,
    count: seatIds.length,
  });

  revalidatePath('/groups');
  revalidatePath('/guests');
  return { success: true, count: seatIds.length };
}

export async function removeSeatsFromGroup(seatIds: string[]) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const adminClient = createAdminClient();

  const { error } = await adminClient
    .from('seats')
    .update({ group_id: null })
    .in('id', seatIds);

  if (error) return { error: error.message };

  await logAudit(user.id, 'GROUP_ASSIGN', 'seats', null, {
    removedSeatIds: seatIds,
  });

  revalidatePath('/groups');
  revalidatePath('/guests');
  return { success: true };
}

export async function releaseGroupSeats(groupId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const adminClient = createAdminClient();

  // Clear all guest details from all seats in this group
  const { error } = await adminClient
    .from('seats')
    .update({
      group_id: null,
      guest_name: null,
      guest_email: null,
      guest_phone: null,
      pass_code: null,
      qr_token: null,
      ticket_sent: false,
      ticket_sent_at: null,
      payment_status: 'pending',
      checked_in: false,
      checked_in_at: null,
      checked_in_by: null,
    })
    .eq('group_id', groupId);

  if (error) return { error: error.message };

  await logAudit(user.id, 'RELEASE', 'group', groupId, {
    action: 'RELEASE_ALL_GROUP_SEATS'
  });

  revalidatePath('/groups');
  revalidatePath('/guests');
  return { success: true };
}
