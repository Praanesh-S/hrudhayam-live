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

    // Insert sponsor (setting both sponsor_name & name, tier & sponsor_tier to avoid null constraints)
    const { data: sponsor, error } = await adminClient
      .from('sponsors')
      .insert({
        sponsor_name: input.sponsor_name.trim(),
        name: input.sponsor_name.trim(),
        tier: input.tier,
        sponsor_tier: input.tier,
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

    // Release any allocated complimentary seats for this sponsor
    await adminClient
      .from('seats')
      .update({
        sponsor_id: null,
        obligation: null,
        guest_name: null,
        payment_status: 'pending',
        updated_at: new Date().toISOString(),
      })
      .eq('sponsor_id', id);

    const { error } = await adminClient.from('sponsors').delete().eq('id', id);
    if (error) return { error: error.message };

    await logAudit(user.id, 'SPONSOR_DELETE', 'sponsors', id, {});

    revalidatePath('/admin/sponsors');
    revalidatePath('/admin/bands');
    revalidatePath('/dashboard');
    revalidatePath('/guests');
    revalidatePath('/leaderboard');
    revalidatePath('/reports');
    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}

/**
 * Manually allocate specific venue seats to a sponsor as complimentary passes.
 * Updates public.seats so they show on the seating map with distinct Cyan color.
 */
export async function allocateSponsorSeats(
  sponsorId: string,
  seatIds: string[],
  guestNames?: Record<string, string>
) {
  try {
    const user = await requireUser();
    const adminClient = createAdminClient();

    if (!seatIds || seatIds.length === 0) {
      return { error: 'No seats selected for allocation.' };
    }

    // Fetch sponsor details
    const { data: sponsor, error: sponsorErr } = await adminClient
      .from('sponsors')
      .select('id, sponsor_name, name, complimentary_pass_count')
      .eq('id', sponsorId)
      .single();

    if (sponsorErr || !sponsor) return { error: 'Sponsor not found.' };

    const sponsorDisplayName = sponsor.sponsor_name || sponsor.name || 'Sponsor';

    // Check currently allocated count
    const { count: currentlyAllocated } = await adminClient
      .from('seats')
      .select('id', { count: 'exact', head: true })
      .eq('sponsor_id', sponsorId);

    const availableToAllocate = (sponsor.complimentary_pass_count || 0) - (currentlyAllocated || 0);
    if (seatIds.length > availableToAllocate) {
      return {
        error: `Cannot allocate ${seatIds.length} seats. Sponsor has only ${availableToAllocate} complimentary pass quota remaining.`,
      };
    }

    // Verify selected seats are not sold, blocked, or owned by another sponsor
    const { data: targetSeats, error: seatsErr } = await adminClient
      .from('seats')
      .select('id, guest_name, pass_code, is_blocked, sponsor_id, row_label')
      .in('id', seatIds);

    if (seatsErr) return { error: seatsErr.message };

    for (const s of targetSeats || []) {
      if (s.row_label === 'SPL VIP') {
        return { error: `Seat ${s.id} is in the reserved SPL VIP Box and cannot be allocated.` };
      }
      if (s.is_blocked) {
        return { error: `Seat ${s.id} is marked as Blocked/Reserved. Please unblock it first if you wish to allocate it.` };
      }
      if (s.sponsor_id && s.sponsor_id !== sponsorId) {
        return { error: `Seat ${s.id} is already allocated to another sponsor.` };
      }
      if (s.guest_name && !s.sponsor_id) {
        return { error: `Seat ${s.id} already has a passholder/guest assigned.` };
      }
    }

    // Allocate seats
    for (const seatId of seatIds) {
      const customGuest = guestNames?.[seatId] || `${sponsorDisplayName} Complimentary`;
      await adminClient
        .from('seats')
        .update({
          sponsor_id: sponsorId,
          guest_name: customGuest,
          payment_status: 'received',
          updated_at: new Date().toISOString(),
        })
        .eq('id', seatId);
    }

    await logAudit(user.id, 'SPONSOR_SEATS_ALLOCATED', 'sponsors', sponsorId, {
      allocated_seat_ids: seatIds,
      count: seatIds.length,
    });

    revalidatePath('/admin/sponsors');
    revalidatePath('/admin/bands');
    revalidatePath('/dashboard');
    revalidatePath('/sell');

    return { success: true, count: seatIds.length };
  } catch (err: any) {
    return { error: err.message };
  }
}

/**
 * De-allocate a complimentary seat from a sponsor, releasing it back to available.
 */
export async function deallocateSponsorSeat(seatId: string) {
  try {
    const user = await requireUser();
    const adminClient = createAdminClient();

    const { data: seat } = await adminClient
      .from('seats')
      .select('id, sponsor_id')
      .eq('id', seatId)
      .single();

    if (!seat || !seat.sponsor_id) {
      return { error: 'Seat is not currently allocated to a sponsor.' };
    }

    await adminClient
      .from('seats')
      .update({
        sponsor_id: null,
        guest_name: null,
        guest_phone: null,
        guest_email: null,
        pass_code: null,
        payment_status: 'pending',
        updated_at: new Date().toISOString(),
      })
      .eq('id', seatId);

    await logAudit(user.id, 'SPONSOR_SEAT_DEALLOCATED', 'seats', seatId, {
      sponsor_id: seat.sponsor_id,
    });

    revalidatePath('/admin/sponsors');
    revalidatePath('/admin/bands');
    revalidatePath('/dashboard');
    revalidatePath('/sell');

    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}

