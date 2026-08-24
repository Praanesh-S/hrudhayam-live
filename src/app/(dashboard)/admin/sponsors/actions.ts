'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAudit } from '@/lib/audit';
import type { SponsorTier } from '@/lib/types';

export async function createSponsor(formData: {
  name: string;
  sponsor_tier: SponsorTier;
  complimentary_pass_count: number;
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
  notes?: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const adminClient = createAdminClient();
  const { data: profile } = await adminClient.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'super_admin') return { error: 'Forbidden: Super Admin access required' };

  const { data: sponsor, error } = await adminClient
    .from('sponsors')
    .insert({
      name: formData.name.trim(),
      sponsor_tier: formData.sponsor_tier,
      complimentary_pass_count: Number(formData.complimentary_pass_count) || 0,
      contact_name: formData.contact_name?.trim() || null,
      contact_phone: formData.contact_phone?.trim() || null,
      contact_email: formData.contact_email?.trim() || null,
      notes: formData.notes?.trim() || null,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  await logAudit(user.id, 'SPONSOR_CREATE', 'sponsor', sponsor.id, {
    name: sponsor.name,
    tier: sponsor.sponsor_tier,
    passCount: sponsor.complimentary_pass_count,
  });

  revalidatePath('/admin/sponsors');
  revalidatePath('/reports');
  return { success: true, sponsor };
}

export async function updateSponsor(
  id: string,
  formData: {
    name: string;
    sponsor_tier: SponsorTier;
    complimentary_pass_count: number;
    contact_name?: string;
    contact_phone?: string;
    contact_email?: string;
    notes?: string;
  }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const adminClient = createAdminClient();
  const { data: profile } = await adminClient.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'super_admin') return { error: 'Forbidden: Super Admin access required' };

  const { data: sponsor, error } = await adminClient
    .from('sponsors')
    .update({
      name: formData.name.trim(),
      sponsor_tier: formData.sponsor_tier,
      complimentary_pass_count: Number(formData.complimentary_pass_count) || 0,
      contact_name: formData.contact_name?.trim() || null,
      contact_phone: formData.contact_phone?.trim() || null,
      contact_email: formData.contact_email?.trim() || null,
      notes: formData.notes?.trim() || null,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) return { error: error.message };

  await logAudit(user.id, 'SPONSOR_UPDATE', 'sponsor', id, {
    name: sponsor.name,
    tier: sponsor.sponsor_tier,
    passCount: sponsor.complimentary_pass_count,
  });

  revalidatePath('/admin/sponsors');
  revalidatePath('/reports');
  return { success: true, sponsor };
}

export async function deleteSponsor(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const adminClient = createAdminClient();
  const { data: profile } = await adminClient.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'super_admin') return { error: 'Forbidden: Super Admin access required' };

  // Untag seats first
  await adminClient.from('seats').update({ sponsor_id: null }).eq('sponsor_id', id);

  const { error } = await adminClient.from('sponsors').delete().eq('id', id);
  if (error) return { error: error.message };

  await logAudit(user.id, 'SPONSOR_DELETE', 'sponsor', id, {});

  revalidatePath('/admin/sponsors');
  revalidatePath('/reports');
  return { success: true };
}

export async function tagSeatsToSponsor(seatIds: string[], sponsorId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const adminClient = createAdminClient();
  const { data: profile } = await adminClient.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'super_admin') return { error: 'Forbidden: Super Admin access required' };

  const { error } = await adminClient
    .from('seats')
    .update({ sponsor_id: sponsorId })
    .in('id', seatIds);

  if (error) return { error: error.message };

  await logAudit(user.id, 'SPONSOR_TAG', 'sponsor', sponsorId, {
    seatIds,
    count: seatIds.length,
  });

  revalidatePath('/admin/sponsors');
  revalidatePath('/guests');
  revalidatePath('/reports');
  return { success: true, taggedCount: seatIds.length };
}

export async function untagSeatsFromSponsor(seatIds: string[]) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const adminClient = createAdminClient();
  const { data: profile } = await adminClient.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'super_admin') return { error: 'Forbidden: Super Admin access required' };

  const { error } = await adminClient
    .from('seats')
    .update({ sponsor_id: null })
    .in('id', seatIds);

  if (error) return { error: error.message };

  await logAudit(user.id, 'SPONSOR_TAG', 'seats', null, {
    untaggedSeatIds: seatIds,
  });

  revalidatePath('/admin/sponsors');
  revalidatePath('/guests');
  revalidatePath('/reports');
  return { success: true };
}
