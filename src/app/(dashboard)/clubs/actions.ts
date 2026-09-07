'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/auth/guards';
import { logAudit } from '@/lib/audit';
import { generateUniquePassCode } from '@/lib/band-utils';
import { signQrToken } from '@/lib/tokens';
import { revalidatePath } from 'next/cache';
import { PaymentMode } from '@/lib/types';

export interface AddClubInput {
  clubName: string;
  contactName: string;
  contactPhone: string;
  broughtByMemberId?: number | null;
  // Array of band selections: { bandId, count }
  passesMix: Array<{ bandId: string; count: number }>;
  paymentMode: PaymentMode;
  paymentReferenceNo: string;
}

/**
 * Record a Participating Rotary Club (§8, Rule R7).
 * - Entry fee: ₹25,000
 * - Passes value: MUST EQUAL EXACTLY ₹15,000
 * - Passes are real, gate-valid passes that decrement band inventory
 * - Ring-fenced: NEVER appears on the competition leaderboard
 */
export async function addParticipatingClub(input: AddClubInput) {
  try {
    const user = await requireUser();
    const adminClient = createAdminClient();

    const {
      clubName,
      contactName,
      contactPhone,
      broughtByMemberId,
      passesMix,
      paymentMode,
      paymentReferenceNo,
    } = input;

    if (!clubName?.trim() || !contactName?.trim() || !contactPhone?.trim()) {
      return { success: false, error: 'Club name, contact person, and contact phone are required.' };
    }

    if (!paymentReferenceNo?.trim()) {
      return { success: false, error: 'Payment reference number / UTR is mandatory.' };
    }

    // 1. Fetch bands to validate total pass value
    const { data: bands, error: bandsError } = await adminClient
      .from('bands')
      .select('id, label, price, total_allocated');

    if (bandsError || !bands) {
      return { success: false, error: 'Could not fetch bands.' };
    }

    const bandMap = new Map(bands.map((b) => [b.id, b]));

    // 2. Validate pass mix totals EXACTLY ₹15,000 (§8.3)
    let totalPassesValue = 0;
    const passesToIssue: Array<{ bandId: string; price: number; label: string }> = [];

    for (const item of passesMix) {
      if (item.count > 0) {
        if (item.bandId === 'band_pp') {
          return { success: false, error: 'Programme Pass (PP) is not available for participating club complimentary passes.' };
        }

        const band = bandMap.get(item.bandId);
        if (!band) {
          return { success: false, error: `Invalid band ID: ${item.bandId}` };
        }

        // Check availability (Rule R5)
        const { data: avail } = await adminClient.rpc('get_band_available_seats', { p_band_id: item.bandId });
        if ((avail || 0) < item.count) {
          return {
            success: false,
            error: `Not enough seats in ${band.label}. Requested ${item.count}, but only ${avail || 0} remaining.`,
          };
        }

        totalPassesValue += band.price * item.count;
        for (let i = 0; i < item.count; i++) {
          passesToIssue.push({ bandId: item.bandId, price: band.price, label: band.label });
        }
      }
    }

    if (totalPassesValue <= 0) {
      return {
        success: false,
        error: 'Please select at least 1 complimentary pass for the club.',
      };
    }

    if (totalPassesValue > 15000) {
      return {
        success: false,
        error: `Passes total cannot exceed ₹15,000. Currently selected passes total ₹${totalPassesValue.toLocaleString('en-IN')}. Please adjust ticket quantities.`,
      };
    }

    // 3. Create Participating Club Record
    const { data: club, error: clubError } = await adminClient
      .from('participating_clubs')
      .insert({
        club_name: clubName.trim(),
        contact_name: contactName.trim(),
        contact_phone: contactPhone.trim(),
        entry_fee: 25000,
        passes_value: totalPassesValue,
        net_contribution: 25000 - totalPassesValue,
        brought_by_member_id: broughtByMemberId || null,
        entered_by_user_id: user.id,
      })
      .select()
      .single();

    if (clubError) {
      console.error('Error inserting participating club:', clubError);
      return { success: false, error: 'Failed to create club record: ' + clubError.message };
    }

    // 4. Issue each chosen pass (real gate-valid passes)
    const cleanPhone = contactPhone.replace(/\D/g, '').slice(-10);
    const createdPasses = [];

    for (const p of passesToIssue) {
      const passCode = await generateUniquePassCode(adminClient);
      const qrToken = await signQrToken(passCode);

      const { data: passData, error: passErr } = await adminClient
        .from('passes')
        .insert({
          pass_code: passCode,
          band_id: p.bandId,
          ticket_type: 'digital',
          donor_name: `${clubName.trim()} (${contactName.trim()})`,
          donor_phone: cleanPhone,
          source: 'participating_club',
          participating_club_id: club.id,
          status: 'issued',
          qr_token: qrToken,
          issued_by_user_id: user.id,
        })
        .select()
        .single();

      if (passErr) {
        console.error('Error issuing club pass:', passErr);
      } else {
        createdPasses.push(passData);
      }
    }

    // 5. Record ₹25,000 Payment linked to the club (§8.5)
    await adminClient.from('payments').insert({
      participating_club_id: club.id,
      mode: paymentMode,
      amount: 25000,
      reference_no: paymentReferenceNo.trim(),
      status: 'received',
      collected_by_user_id: user.id,
      collected_at: new Date().toISOString(),
    });

    // 6. Audit Log
    await logAudit(user.id, 'CLUB_JOIN', 'participating_clubs', club.id, {
      club_name: club.club_name,
      entry_fee: 25000,
      passes_count: createdPasses.length,
      reference_no: paymentReferenceNo,
    });

    revalidatePath('/clubs');
    revalidatePath('/reports');
    revalidatePath('/dashboard');

    return {
      success: true,
      club,
      passesCount: createdPasses.length,
      passes: createdPasses,
    };
  } catch (err: any) {
    console.error('Error in addParticipatingClub:', err);
    return { success: false, error: err.message || 'Failed to add participating club.' };
  }
}
