'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/auth/guards';
import { logAudit } from '@/lib/audit';
import type { SponsorTier, SponsorStatus, PaymentMode } from '@/lib/types';
import { SPONSOR_TIER_MAP } from '@/lib/sponsor-constants';

export interface CreateSponsorInput {
  sponsor_name: string;
  tier: SponsorTier;
  amount?: number;
  status: SponsorStatus;
  brought_by_member_id?: number | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  notes?: string | null;
  complimentary_pass_count?: number;
  logo_file_key?: string | null;
  payment_mode?: PaymentMode;
  payment_reference_no?: string;
}

export async function createSponsor(input: CreateSponsorInput) {
  try {
    const user = await requireUser();
    const adminClient = createAdminClient();

    const tierInfo = SPONSOR_TIER_MAP[input.tier];
    const defaultAmount = tierInfo ? tierInfo.amount : 0;
    const finalAmount = input.amount && input.amount > 0 ? input.amount : defaultAmount;

    // Insert sponsor
    const { data: sponsor, error } = await adminClient
      .from('sponsors')
      .insert({
        sponsor_name: input.sponsor_name.trim(),
        tier: input.tier,
        amount: finalAmount,
        status: input.status,
        brought_by_member_id: input.brought_by_member_id || null,
        entered_by_user_id: user.id,
        contact_name: input.contact_name?.trim() || null,
        contact_phone: input.contact_phone?.trim() || null,
        contact_email: input.contact_email?.trim() || null,
        notes: input.notes?.trim() || null,
        complimentary_pass_count: Number(input.complimentary_pass_count) || 0,
        logo_file_key: input.logo_file_key || null,
      })
      .select()
      .single();

    if (error) return { error: error.message };

    // If status is received, record structured payment (§7, §12)
    if (input.status === 'received' && input.payment_reference_no) {
      await adminClient.from('payments').insert({
        sponsor_id: sponsor.id,
        mode: input.payment_mode || 'bank_transfer',
        amount: finalAmount,
        reference_no: input.payment_reference_no.trim(),
        status: 'received',
        collected_by_user_id: user.id,
        collected_at: new Date().toISOString(),
      });
    }

    await logAudit(user.id, 'SPONSOR_CREATE', 'sponsors', sponsor.id, {
      name: sponsor.sponsor_name,
      tier: sponsor.tier,
      amount: sponsor.amount,
      status: sponsor.status,
      brought_by: input.brought_by_member_id,
    });

    revalidatePath('/admin/sponsors');
    revalidatePath('/leaderboard');
    revalidatePath('/reports');
    return { success: true, sponsor };
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function updateSponsor(
  id: string,
  input: Partial<CreateSponsorInput>
) {
  try {
    const user = await requireUser();
    const adminClient = createAdminClient();

    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (input.sponsor_name) updatePayload.sponsor_name = input.sponsor_name.trim();
    if (input.tier) updatePayload.tier = input.tier;
    if (input.amount !== undefined) updatePayload.amount = input.amount;
    if (input.status) updatePayload.status = input.status;
    if (input.brought_by_member_id !== undefined) updatePayload.brought_by_member_id = input.brought_by_member_id;
    if (input.contact_name !== undefined) updatePayload.contact_name = input.contact_name?.trim() || null;
    if (input.contact_phone !== undefined) updatePayload.contact_phone = input.contact_phone?.trim() || null;
    if (input.contact_email !== undefined) updatePayload.contact_email = input.contact_email?.trim() || null;
    if (input.notes !== undefined) updatePayload.notes = input.notes?.trim() || null;
    if (input.complimentary_pass_count !== undefined) updatePayload.complimentary_pass_count = input.complimentary_pass_count;
    if (input.logo_file_key !== undefined) updatePayload.logo_file_key = input.logo_file_key;

    const { data: sponsor, error } = await adminClient
      .from('sponsors')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) return { error: error.message };

    // If status changed to received and payment reference provided
    if (input.status === 'received' && input.payment_reference_no) {
      const { data: existingPay } = await adminClient
        .from('payments')
        .select('id')
        .eq('sponsor_id', id)
        .maybeSingle();

      if (!existingPay) {
        await adminClient.from('payments').insert({
          sponsor_id: id,
          mode: input.payment_mode || 'bank_transfer',
          amount: sponsor.amount,
          reference_no: input.payment_reference_no.trim(),
          status: 'received',
          collected_by_user_id: user.id,
          collected_at: new Date().toISOString(),
        });
      } else {
        await adminClient
          .from('payments')
          .update({
            status: 'received',
            reference_no: input.payment_reference_no.trim(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingPay.id);
      }
    }

    await logAudit(user.id, 'SPONSOR_UPDATE', 'sponsors', id, updatePayload);

    revalidatePath('/admin/sponsors');
    revalidatePath('/leaderboard');
    revalidatePath('/reports');
    return { success: true, sponsor };
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function deleteSponsor(id: string) {
  try {
    const user = await requireUser();
    const adminClient = createAdminClient();

    const { error } = await adminClient.from('sponsors').delete().eq('id', id);
    if (error) return { error: error.message };

    await logAudit(user.id, 'SPONSOR_DELETE', 'sponsors', id, {});

    revalidatePath('/admin/sponsors');
    revalidatePath('/leaderboard');
    revalidatePath('/reports');
    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}
