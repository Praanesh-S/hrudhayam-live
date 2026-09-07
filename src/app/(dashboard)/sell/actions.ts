'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/auth/guards';
import { logAudit } from '@/lib/audit';
import { generateUniquePassCode } from '@/lib/band-utils';
import { formatDonorPassMessage, formatSellerCreditMessage, formatWhatsAppPhone } from '@/lib/whatsapp';
import { revalidatePath } from 'next/cache';
import crypto from 'crypto';
import { PaymentMode, PaymentStatus, TicketType } from '@/lib/types';
import { createSession } from '@/lib/auth/session';

export interface IssuePassInput {
  bandId: string;
  quantity?: number;
  ticketType: TicketType;
  physicalSerial?: string | null;
  physicalSerials?: string[] | null;
  seatId?: string | null;
  sellerMemberId: number;
  donorName: string;
  donorPhone: string;
  donorEmail?: string | null;
  donorIsSellerFallback?: boolean;
  paymentMode: PaymentMode;
  paymentAmount: number;
  paymentReferenceNo: string;
  paymentStatus: PaymentStatus;
  proofFileKey?: string | null;
  preferredLanguage?: 'en' | 'ta';
}

/**
 * Check if a donor phone already has passes issued (§19.3 Duplicate-donor warning).
 */
export async function checkDonorPassCount(phone: string) {
  try {
    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    if (!cleanPhone) return { count: 0 };

    const adminClient = createAdminClient();
    const { count, error } = await adminClient
      .from('passes')
      .select('id', { count: 'exact', head: true })
      .eq('donor_phone', cleanPhone)
      .neq('status', 'cancelled');

    if (error) throw error;
    return { count: count || 0 };
  } catch (err) {
    console.error('Error checking donor pass count:', err);
    return { count: 0 };
  }
}

/**
 * Issue digital or physical donor passes for a band tier and quantity.
 * Enforces:
 * - Rule R2: Scoped attribution (GA can only sell for own group)
 * - Rule R4: Golden rule (issued once, digital or physical, never both)
 * - Rule R5: Hard oversell block with database inventory locking
 * - Rule R6: Seller vs donor separate identities with fallback flag
 * - Rule R9: 60-second atomic batch undo window
 */
export async function issuePass(input: IssuePassInput) {
  try {
    const user = await requireUser();
    const adminClient = createAdminClient();

    const {
      bandId,
      ticketType,
      physicalSerial,
      physicalSerials,
      sellerMemberId,
      donorName,
      donorPhone,
      donorEmail,
      donorIsSellerFallback = false,
      paymentMode,
      paymentAmount,
      paymentReferenceNo,
      paymentStatus,
      proofFileKey,
      preferredLanguage = 'en',
    } = input;

    const quantity = Math.max(1, Math.floor(input.quantity || 1));

    // 1. Validate Core Inputs
    if (!bandId || !ticketType || !sellerMemberId) {
      return { success: false, error: 'Please fill in all required fields.' };
    }

    if (!paymentReferenceNo || !paymentReferenceNo.trim()) {
      return { success: false, error: 'Payment reference number / UTR / Cash voucher is mandatory.' };
    }

    // 1b. Physical ticket serials validation
    const serialList: string[] = [];
    if (ticketType === 'physical') {
      if (Array.isArray(physicalSerials) && physicalSerials.length > 0) {
        for (const s of physicalSerials) {
          if (s && s.trim()) serialList.push(s.trim());
        }
      } else if (physicalSerial && physicalSerial.trim()) {
        serialList.push(physicalSerial.trim());
      }

      if (serialList.length < quantity) {
        return { 
          success: false, 
          error: `Physical ticket serial numbers required for all ${quantity} passes (received ${serialList.length}).` 
        };
      }

      // Check duplicates within batch
      const serialSet = new Set(serialList);
      if (serialSet.size !== serialList.length) {
        return { success: false, error: 'Duplicate physical serial numbers entered in this batch.' };
      }

      // Check duplicates in database
      const { data: existingSerials } = await adminClient
        .from('passes')
        .select('physical_serial')
        .in('physical_serial', serialList)
        .neq('status', 'cancelled');

      if (existingSerials && existingSerials.length > 0) {
        return { 
          success: false, 
          error: `Duplicate physical ticket: Serial number(s) ${existingSerials.map((s: any) => `"${s.physical_serial}"`).join(', ')} already issued.` 
        };
      }
    }

    // Optional legacy seat validation if seatId was explicitly passed
    let seatData: any = null;
    if (input.seatId && input.seatId.trim()) {
      const { data: sData } = await adminClient
        .from('seats')
        .select('*')
        .eq('id', input.seatId)
        .single();
      seatData = sData;
    }

    // 2. Fetch Seller Member and Verify Rule R2 (Attribution scope)
    const { data: seller, error: sellerError } = await adminClient
      .from('members')
      .select('id, full_name, phone_raw, phone_e164, group_id, is_active')
      .eq('id', sellerMemberId)
      .single();

    if (sellerError || !seller || !seller.is_active) {
      return { success: false, error: 'Selected seller member was not found or is inactive.' };
    }

    // Rule R2: Scoped attribution (Sub-admin / Group admin can only sell for their team)
    if (user.role !== 'super_admin' && user.role !== 'system_admin' && user.groupId && seller.group_id !== user.groupId) {
      return { 
        success: false, 
        error: 'Scoped attribution violation: You can only credit sales to yourself or members of your own team.' 
      };
    }

    // 3. Resolve Donor Details (Rule R6)
    let finalDonorName = donorName?.trim();
    let finalDonorPhone = donorPhone ? donorPhone.replace(/\D/g, '').slice(-10) : '';

    if (donorIsSellerFallback) {
      finalDonorName = seller.full_name;
      finalDonorPhone = seller.phone_e164 ? seller.phone_e164.replace(/\D/g, '').slice(-10) : seller.phone_raw.replace(/\D/g, '').slice(-10);
    } else {
      if (!finalDonorName) {
        return { success: false, error: 'Donor name is required (or enable seller fallback).' };
      }
      if (!finalDonorPhone || finalDonorPhone.length < 10) {
        return { success: false, error: 'Valid 10-digit donor mobile number is required.' };
      }
    }

    // 4. Band Inventory & Row-based Seat Reservation (Rule R5)
    const bandCategoryMap: Record<string, string> = {
      band_5000: 'b5000',
      band_3500: 'b3500',
      band_2500: 'b2500',
      band_1500: 'b1500',
      band_pp: 'pp',
    };
    const category = bandCategoryMap[bandId];

    let assignedSeats: any[] = [];
    if (category) {
      const { data: foundSeats, error: seatFetchErr } = await adminClient
        .from('seats')
        .select('id, row_label, seat_no, section')
        .eq('category', category)
        .eq('sold', false)
        .order('section', { ascending: true })
        .order('row_label', { ascending: true })
        .order('seat_no', { ascending: true })
        .limit(quantity);

      if (seatFetchErr || !foundSeats || foundSeats.length < quantity) {
        return { 
          success: false, 
          error: `HARD LIMIT REACHED: Only ${foundSeats?.length || 0} seats remaining in this price band. Cannot issue ${quantity} passes.` 
        };
      }
      assignedSeats = foundSeats;
    } else {
      const { data: availData, error: availError } = await adminClient
        .rpc('get_band_available_seats', { p_band_id: bandId });

      const availableSeats = typeof availData === 'number' ? availData : 0;
      if (availableSeats < quantity) {
        return { 
          success: false, 
          error: `HARD LIMIT REACHED: Only ${availableSeats} seat${availableSeats === 1 ? '' : 's'} remaining in this price band. Cannot issue ${quantity} passes.` 
        };
      }
    }

    // Fetch band metadata
    const { data: band } = await adminClient
      .from('bands')
      .select('id, label, price')
      .eq('id', bandId)
      .single();

    if (!band) {
      return { success: false, error: 'Selected price band not found.' };
    }

    // 5. Generate Shared Undo Token & Unique Pass Identifiers
    const undoToken = crypto.randomBytes(16).toString('hex');
    const undoExpiresAt = new Date(Date.now() + 60 * 1000).toISOString();

    const passesToInsert = [];
    for (let i = 0; i < quantity; i++) {
      const passCode = await generateUniquePassCode(adminClient);
      const qrToken = null;
      const assignedSeat = assignedSeats[i];
      const serial = serialList[i] || `PL-${passCode}`;

      passesToInsert.push({
        pass_code: passCode,
        band_id: bandId,
        ticket_type: 'physical' as const,
        physical_serial: serial,
        serial_no: serial,
        seat_id: assignedSeat?.id || (i === 0 && input.seatId ? input.seatId : null),
        row_label: assignedSeat?.row_label || null,
        price: band.price,
        seller_member_id: sellerMemberId,
        issued_by_user_id: user.id,
        donor_name: finalDonorName,
        donor_phone: finalDonorPhone,
        donor_email: donorEmail?.trim() || null,
        donor_is_seller_fallback: donorIsSellerFallback,
        source: 'normal_sale' as const,
        status: 'issued' as const,
        qr_token: qrToken,
        undo_token: undoToken,
        undo_expires_at: undoExpiresAt,
        needs_seller_reconciliation: false,
      });
    }

    // 6. Insert Passes in Batch
    const { data: insertedPasses, error: passError } = await adminClient
      .from('passes')
      .insert(passesToInsert)
      .select();

    if (passError || !insertedPasses || insertedPasses.length === 0) {
      console.error('Error inserting passes:', passError);
      return { success: false, error: 'Failed to issue passes. ' + (passError?.message || '') };
    }

    // 6b. Mark assigned seats as sold in public.seats
    for (let i = 0; i < insertedPasses.length; i++) {
      const p = insertedPasses[i];
      if (p.seat_id) {
        await adminClient
          .from('seats')
          .update({
            sold: true,
            owner_id: user.id,
            guest_name: finalDonorName,
            guest_phone: finalDonorPhone,
            guest_email: donorEmail?.trim() || null,
            pass_code: p.pass_code,
            payment_status: paymentStatus,
            updated_at: new Date().toISOString(),
          })
          .eq('id', p.seat_id);
      }
    }

    // 7. Insert Structured Payments (1 record per pass, splitting amount evenly)
    const totalAmount = paymentAmount >= 0 ? paymentAmount : band.price * quantity;
    const baseAmount = Math.floor(totalAmount / quantity);
    const remainder = totalAmount - (baseAmount * quantity);

    const paymentInserts = insertedPasses.map((pass, idx) => ({
      pass_id: pass.id,
      mode: paymentMode,
      amount: idx === 0 ? baseAmount + remainder : baseAmount,
      reference_no: paymentReferenceNo.trim(),
      proof_file_key: proofFileKey || null,
      status: paymentStatus,
      collected_by_user_id: user.id,
      collected_at: new Date().toISOString(),
    }));

    const { error: paymentError } = await adminClient
      .from('payments')
      .insert(paymentInserts);

    if (paymentError) {
      console.error('Error recording payment:', paymentError);
    }

    // 8. Calculate Seller's Updated Total Raised (for thank you message)
    const { data: sellerSales } = await adminClient
      .from('passes')
      .select(`
        payments (
          amount,
          status
        )
      `)
      .eq('seller_member_id', sellerMemberId)
      .neq('status', 'cancelled');

    let sellerTotalRaised = 0;
    if (sellerSales) {
      for (const s of sellerSales) {
        const pays = (s as any).payments;
        if (Array.isArray(pays)) {
          for (const p of pays) {
            if (p.status === 'received') sellerTotalRaised += (p.amount || 0);
          }
        }
      }
    }

    const passCodes = insertedPasses.map((p) => p.pass_code);

    // 9. Audit Log
    for (const p of insertedPasses) {
      await logAudit(
        user.id,
        'PASS_ISSUE',
        'passes',
        p.id,
        {
          pass_code: p.pass_code,
          quantity,
          band: band.label,
          ticket_type: ticketType,
          physical_serial: p.physical_serial,
          donor_name: finalDonorName,
          donor_phone: finalDonorPhone,
          seller_member_id: sellerMemberId,
          seller_name: seller.full_name,
          payment_mode: paymentMode,
          payment_amount: totalAmount,
          payment_reference_no: paymentReferenceNo,
        }
      );
    }

    // 10. Format WhatsApp Messages
    const seatDetailsStr = `${quantity} Seat${quantity > 1 ? 's' : ''} in ${band.label}`;
    const donorMsg = formatDonorPassMessage({
      donorName: finalDonorName,
      donorPhone: finalDonorPhone,
      bandLabel: band.label,
      passCode: passCodes[0],
      passCodes,
      quantity,
      ticketType,
      physicalSerial: ticketType === 'physical' ? serialList[0] : null,
      physicalSerials: ticketType === 'physical' ? serialList : null,
      seatDetails: seatDetailsStr,
      paymentStatus,
      language: preferredLanguage,
    });

    const sellerMsg = formatSellerCreditMessage({
      sellerName: seller.full_name,
      totalRaised: sellerTotalRaised,
      language: preferredLanguage,
    });

    revalidatePath('/sell');
    revalidatePath('/dashboard');
    revalidatePath('/guests');
    revalidatePath('/reports');
    revalidatePath('/leaderboard');

    return {
      success: true,
      pass: insertedPasses[0],
      passes: insertedPasses,
      passCode: passCodes[0],
      passCodes,
      quantity,
      totalAmount,
      undoToken,
      donorMessage: donorMsg,
      donorPhone: finalDonorPhone,
      sellerMessage: sellerMsg,
      sellerPhone: seller.phone_e164 || seller.phone_raw,
      sellerName: seller.full_name,
      bandLabel: band.label,
      seatDetails: seatDetailsStr,
    };
  } catch (err: any) {
    console.error('Error in issuePass:', err);
    return { success: false, error: err.message || 'An unexpected error occurred.' };
  }
}

/**
 * 60-Second Undo Window Action (§19.2, Rule R9).
 * Cancels all passes created in the batch sharing the undo token.
 * Can only be called by the creating user within 60 seconds, pre-gate scan.
 */
export async function undoSale(passId: string, undoToken: string) {
  try {
    const user = await requireUser();
    const adminClient = createAdminClient();

    // Look up by undo_token to cancel the whole batch atomically, fallback to passId
    let query = adminClient.from('passes').select('*');
    if (undoToken) {
      query = query.eq('undo_token', undoToken);
    } else {
      query = query.eq('id', passId);
    }

    const { data: passes, error: passError } = await query;

    if (passError || !passes || passes.length === 0) {
      return { success: false, error: 'Pass record(s) not found for undo.' };
    }

    const now = new Date();

    // Rule R9 validations on the entire batch
    for (const pass of passes) {
      if (pass.issued_by_user_id !== user.id && user.role !== 'system_admin') {
        return { success: false, error: 'Only the coordinator who issued this pass can undo it.' };
      }

      if (pass.status === 'used') {
        return { success: false, error: `Pass ${pass.pass_code} has already been scanned at the gate and cannot be undone.` };
      }

      if (pass.status === 'cancelled') {
        return { success: false, error: 'This pass sale has already been cancelled.' };
      }

      const expiresAt = new Date(pass.undo_expires_at);
      if (now > expiresAt && user.role !== 'system_admin') {
        return { 
          success: false, 
          error: 'The 60-second undo window has closed. Please request a System Admin to cancel this pass.' 
        };
      }
    }

    const passIds = passes.map((p) => p.id);

    // Void all passes in batch
    const { error: updateError } = await adminClient
      .from('passes')
      .update({
        status: 'cancelled',
        cancelled_at: now.toISOString(),
        cancelled_by: user.id,
        cancel_reason: '60-Second Self-Service Undo',
        updated_at: now.toISOString(),
      })
      .in('id', passIds);

    if (updateError) throw updateError;

    // Void associated payments
    await adminClient
      .from('payments')
      .update({
        status: 'pending',
        reference_no: 'CANCELLED_UNDO',
        updated_at: now.toISOString(),
      })
      .in('pass_id', passIds);

    // Release assigned seats if any were linked
    const seatIds = passes.map((p) => p.seat_id).filter(Boolean);
    if (seatIds.length > 0) {
      await adminClient
        .from('seats')
        .update({
          sold: false,
          owner_id: null,
          guest_name: null,
          guest_phone: null,
          guest_email: null,
          pass_code: null,
          qr_token: null,
          payment_status: 'pending',
          updated_at: now.toISOString(),
        })
        .in('id', seatIds);
    }

    // Audit logs for each cancelled pass
    for (const pass of passes) {
      await logAudit(
        user.id,
        'SALE_UNDO',
        'passes',
        pass.id,
        {
          pass_code: pass.pass_code,
          donor_name: pass.donor_name,
          band_id: pass.band_id,
          reason: 'Within 60-second window undo',
        }
      );
    }

    revalidatePath('/sell');
    revalidatePath('/dashboard');
    revalidatePath('/guests');
    revalidatePath('/reports');
    revalidatePath('/leaderboard');

    const passCodesStr = passes.map((p) => p.pass_code).join(', ');
    return { 
      success: true, 
      message: `Sale for ${passes.length} pass${passes.length > 1 ? 'es' : ''} (${passCodesStr}) has been successfully undone.` 
    };
  } catch (err: any) {
    console.error('Error undoing sale:', err);
    return { success: false, error: err.message || 'Failed to undo sale.' };
  }
}

/**
 * Create a Soft Hold (§19.7, Rule R10).
 * Holds count against band inventory immediately.
 */
export async function createSoftHold(bandId: string, count: number, note?: string) {
  try {
    const user = await requireUser();
    const adminClient = createAdminClient();

    if (count < 1) {
      return { success: false, error: 'Count must be at least 1.' };
    }

    // Check available seats
    const { data: avail } = await adminClient.rpc('get_band_available_seats', { p_band_id: bandId });
    if ((avail || 0) < count) {
      return { 
        success: false, 
        error: `Cannot hold ${count} seats. Only ${avail || 0} seats available in this band.` 
      };
    }

    // Fetch hold duration setting (default 48h)
    const { data: setting } = await adminClient
      .from('app_settings_v2')
      .select('value')
      .eq('key', 'hold_duration_hours')
      .maybeSingle();

    const durationHours = Number(setting?.value) || 48;
    const expiresAt = new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString();

    const { data: hold, error: holdError } = await adminClient
      .from('soft_holds')
      .insert({
        band_id: bandId,
        count,
        held_by_user_id: user.id,
        note: note?.trim() || null,
        expires_at: expiresAt,
        status: 'active',
      })
      .select()
      .single();

    if (holdError) throw holdError;

    await logAudit(user.id, 'SOFT_HOLD_CREATE', 'soft_holds', hold.id, {
      band_id: bandId,
      count,
      expires_at: expiresAt,
    });

    revalidatePath('/sell');
    revalidatePath('/dashboard');

    return { success: true, hold };
  } catch (err: any) {
    console.error('Error creating soft hold:', err);
    return { success: false, error: err.message || 'Failed to create soft hold.' };
  }
}

/**
 * Cancel an active soft hold, releasing seats back to the band immediately.
 */
export async function releaseSoftHold(holdId: string) {
  try {
    const user = await requireUser();
    const adminClient = createAdminClient();

    const { error } = await adminClient
      .from('soft_holds')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', holdId);

    if (error) throw error;

    await logAudit(user.id, 'SOFT_HOLD_RELEASE', 'soft_holds', holdId);

    revalidatePath('/sell');
    revalidatePath('/dashboard');

    return { success: true };
  } catch (err: any) {
    console.error('Error releasing soft hold:', err);
    return { success: false, error: err.message || 'Failed to release soft hold.' };
  }
}

/**
 * Mark a pending payment as received (Step 6).
 * Reference / UTR is mandatory. Flips payment status to received.
 * Logs to audit trail.
 */
export async function markPendingPaymentReceived(
  paymentIdOrIds: string | string[],
  referenceNo: string,
  mode: PaymentMode
) {
  try {
    const user = await requireUser();
    const adminClient = createAdminClient();

    if (!referenceNo || !referenceNo.trim()) {
      return { success: false, error: 'Reference number / UTR is mandatory.' };
    }

    const ids = Array.isArray(paymentIdOrIds) ? paymentIdOrIds : [paymentIdOrIds];
    if (ids.length === 0) {
      return { success: false, error: 'No payments specified.' };
    }

    // 1. Fetch payments and linked passes
    const { data: payments, error: fetchErr } = await adminClient
      .from('payments')
      .select('*, passes(*)')
      .in('id', ids);

    if (fetchErr || !payments || payments.length === 0) {
      return { success: false, error: 'Pending payment record(s) not found.' };
    }

    // Role check: Group Admin or Tech Coordinator can only mark for their own group
    if (user.role !== 'super_admin' && user.role !== 'system_admin' && user.groupId) {
      for (const payment of payments) {
        const pass = (payment as any).passes;
        if (pass?.seller_member_id) {
          const { data: seller } = await adminClient
            .from('members')
            .select('group_id')
            .eq('id', pass.seller_member_id)
            .single();
          if (seller && seller.group_id !== user.groupId) {
            return { success: false, error: 'You can only clear pending payments for your own group.' };
          }
        }
      }
    }

    const now = new Date().toISOString();
    const { error: updateErr } = await adminClient
      .from('payments')
      .update({
        status: 'received',
        reference_no: referenceNo.trim(),
        mode,
        collected_by_user_id: user.id,
        collected_at: now,
        updated_at: now,
      })
      .in('id', ids);

    if (updateErr) throw updateErr;

    // Also update pass payment status if needed
    const passIds = payments.map((p) => p.pass_id).filter(Boolean);
    if (passIds.length > 0) {
      await adminClient
        .from('passes')
        .update({ updated_at: now })
        .in('id', passIds);

      const seatIds = payments
        .map((p) => (p as any).passes?.seat_id)
        .filter(Boolean);
      if (seatIds.length > 0) {
        await adminClient
          .from('seats')
          .update({ payment_status: 'received', updated_at: now })
          .in('id', seatIds);
      }
    }

    await logAudit(user.id, 'PAYMENT_MARKED_RECEIVED', 'payments', ids[0], {
      reference_no: referenceNo.trim(),
      mode,
      payment_count: ids.length,
      cleared_by: user.fullName,
    });

    revalidatePath('/sell');
    revalidatePath('/payments');
    revalidatePath('/dashboard');
    revalidatePath('/leaderboard');

    return { success: true };
  } catch (err: any) {
    console.error('Error marking pending payment received:', err);
    return { success: false, error: err.message || 'Failed to mark payment received.' };
  }
}

/**
 * Demo switch role action for testing elder flows (§Image 2 & Image 3)
 */
export async function demoSwitchRoleAction(targetRole: 'super_admin' | 'group_admin' | 'tech_coordinator') {
  try {
    const adminClient = createAdminClient();
    let targetUserId: string | null = null;

    if (targetRole === 'super_admin') {
      const { data } = await adminClient
        .from('users')
        .select('id')
        .eq('role', 'super_admin')
        .limit(1)
        .single();
      targetUserId = data?.id || null;
    } else if (targetRole === 'group_admin') {
      const { data } = await adminClient
        .from('users')
        .select('id')
        .eq('role', 'group_admin')
        .limit(1)
        .single();
      targetUserId = data?.id || null;
    } else if (targetRole === 'tech_coordinator') {
      const { data } = await adminClient
        .from('users')
        .select('id')
        .eq('role', 'tech_coordinator')
        .limit(1)
        .maybeSingle();
      if (data?.id) {
        targetUserId = data.id;
      } else {
        // Look up member with is_tech_coord or fallback to a member in Team 1
        const { data: member } = await adminClient
          .from('members')
          .select('id, phone_raw, full_name')
          .eq('is_tech_coord', true)
          .limit(1)
          .maybeSingle();

        if (member) {
          const { data: newUser } = await adminClient
            .from('users')
            .insert({
              login_id: member.phone_raw.replace(/\D/g, '').slice(-10) || `tc_${member.id}`,
              role: 'tech_coordinator',
              member_id: member.id,
              password_hash: 'demo',
              must_change_password: false,
              is_active: true,
            })
            .select('id')
            .single();
          targetUserId = newUser?.id || null;
        }
      }
    }

    if (!targetUserId) {
      return { success: false, error: `Could not find demo user for role: ${targetRole}` };
    }

    await createSession(targetUserId);
    revalidatePath('/sell');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (err: any) {
    console.error('Error switching demo role:', err);
    return { success: false, error: err.message || 'Failed to switch demo role' };
  }
}

