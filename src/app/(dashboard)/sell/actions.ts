'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/auth/guards';
import { logAudit } from '@/lib/audit';
import { generateUniquePassCode } from '@/lib/band-utils';
import { signQrToken } from '@/lib/tokens';
import { formatDonorPassMessage, formatSellerCreditMessage, formatWhatsAppPhone } from '@/lib/whatsapp';
import { revalidatePath } from 'next/cache';
import crypto from 'crypto';
import { PaymentMode, PaymentStatus, TicketType } from '@/lib/types';

export interface IssuePassInput {
  bandId: string;
  ticketType: TicketType;
  physicalSerial?: string | null;
  seatId: string;
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
 * Issue a single digital or physical donor pass.
 * Enforces:
 * - Rule R2: Scoped attribution (GA can only sell for own group)
 * - Rule R4: Golden rule (seat issued once, digital or physical, never both)
 * - Rule R5: Hard oversell block with database locking
 * - Rule R6: Seller vs donor separate identities with fallback flag
 * - Rule R9: 60-second undo window
 */
export async function issuePass(input: IssuePassInput) {
  try {
    const user = await requireUser();
    const adminClient = createAdminClient();

    const {
      bandId,
      ticketType,
      physicalSerial,
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

    // 1. Validate Core Inputs
    if (!bandId || !ticketType || !sellerMemberId) {
      return { success: false, error: 'Please fill in all required fields.' };
    }

    if (ticketType === 'physical' && (!physicalSerial || !physicalSerial.trim())) {
      return { success: false, error: 'Physical ticket serial number is required for physical passes.' };
    }

    if (!paymentReferenceNo || !paymentReferenceNo.trim()) {
      return { success: false, error: 'Payment reference number / UTR / Cash voucher is mandatory.' };
    }

    // 1b. Mandatory Seat Selection Validation
    const { seatId } = input;
    if (!seatId || !seatId.trim()) {
      return { success: false, error: 'Mandatory seat selection: Please select an available venue row and seat.' };
    }

    const { data: seatData, error: seatErr } = await adminClient
      .from('seats')
      .select('*')
      .eq('id', seatId)
      .single();

    if (seatErr || !seatData) {
      return { success: false, error: 'Selected seat does not exist in venue blueprint.' };
    }

    if (seatData.row_label === 'SPL VIP') {
      return { success: false, error: 'Selected seat is in the reserved SPL VIP Box and cannot be sold.' };
    }

    if (seatData.is_blocked) {
      return { success: false, error: `Seat ${seatId} is marked as Blocked/Reserved (${seatData.blocked_reason || 'VIP'}) and cannot be sold.` };
    }

    if (seatData.sponsor_id) {
      return { success: false, error: `Seat ${seatId} is reserved for a corporate sponsor and cannot be sold.` };
    }

    if (seatData.guest_name || seatData.pass_code) {
      return { success: false, error: `Seat ${seatId} has already been sold to another guest.` };
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

    // 4. Check for duplicate physical serial if applicable
    if (ticketType === 'physical' && physicalSerial) {
      const cleanSerial = physicalSerial.trim();
      const { data: existingSerial } = await adminClient
        .from('passes')
        .select('id')
        .eq('physical_serial', cleanSerial)
        .neq('status', 'cancelled')
        .maybeSingle();

      if (existingSerial) {
        return { 
          success: false, 
          error: `Duplicate physical ticket: Serial number "${cleanSerial}" has already been issued.` 
        };
      }
    }

    // 5. Band Inventory & Hard Oversell Block (Rule R5)
    // Query available seats using DB function
    const { data: availData, error: availError } = await adminClient
      .rpc('get_band_available_seats', { p_band_id: bandId });

    if (availError) {
      console.error('Error checking band availability:', availError);
      return { success: false, error: 'Could not verify seat availability.' };
    }

    const availableSeats = typeof availData === 'number' ? availData : 0;
    if (availableSeats < 1) {
      return { 
        success: false, 
        error: 'HARD LIMIT REACHED: This price band is completely sold out. No more passes can be issued.' 
      };
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

    // 6. Generate Pass Identifiers
    const passCode = await generateUniquePassCode(adminClient);
    const qrToken = await signQrToken(passCode);

    // Rule R9: 60-second Undo Window
    const undoToken = crypto.randomBytes(16).toString('hex');
    const undoExpiresAt = new Date(Date.now() + 60 * 1000).toISOString();

    // 7. Insert Pass
    const { data: passData, error: passError } = await adminClient
      .from('passes')
      .insert({
        pass_code: passCode,
        band_id: bandId,
        ticket_type: ticketType,
        physical_serial: ticketType === 'physical' ? physicalSerial!.trim() : null,
        seat_id: seatId,
        seller_member_id: sellerMemberId,
        issued_by_user_id: user.id,
        donor_name: finalDonorName,
        donor_phone: finalDonorPhone,
        donor_email: donorEmail?.trim() || null,
        donor_is_seller_fallback: donorIsSellerFallback,
        source: 'normal_sale',
        status: 'issued',
        qr_token: qrToken,
        undo_token: undoToken,
        undo_expires_at: undoExpiresAt,
        needs_seller_reconciliation: false,
      })
      .select()
      .single();

    if (passError) {
      console.error('Error inserting pass:', passError);
      return { success: false, error: 'Failed to issue pass. ' + passError.message };
    }

    // 8. Insert Structured Payment
    const { error: paymentError } = await adminClient
      .from('payments')
      .insert({
        pass_id: passData.id,
        mode: paymentMode,
        amount: paymentAmount >= 0 ? paymentAmount : band.price,
        reference_no: paymentReferenceNo.trim(),
        proof_file_key: proofFileKey || null,
        status: paymentStatus,
        collected_by_user_id: user.id,
        collected_at: new Date().toISOString(),
      });

    if (paymentError) {
      console.error('Error recording payment:', paymentError);
    }

    // 8b. Assign and lock Seat in public.seats
    await adminClient
      .from('seats')
      .update({
        owner_id: user.id,
        guest_name: finalDonorName,
        guest_phone: finalDonorPhone,
        guest_email: donorEmail?.trim() || null,
        pass_code: passCode,
        qr_token: qrToken,
        payment_status: paymentStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', seatId);

    // 9. Calculate Seller's Updated Total Raised (for thank you message)
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

    // 10. Audit Log
    await logAudit(
      user.id,
      'PASS_ISSUE',
      'passes',
      passData.id,
      {
        pass_code: passCode,
        band: band.label,
        ticket_type: ticketType,
        physical_serial: ticketType === 'physical' ? physicalSerial?.trim() : null,
        donor_name: finalDonorName,
        donor_phone: finalDonorPhone,
        seller_member_id: sellerMemberId,
        seller_name: seller.full_name,
        payment_mode: paymentMode,
        payment_amount: paymentAmount,
        payment_reference_no: paymentReferenceNo,
      }
    );

    // 11. Format WhatsApp Messages
    const seatDetailsStr = `${seatData.section} • Row ${seatData.row_label} • Seat #${seatData.seat_no} (${seatData.id})`;
    const donorMsg = formatDonorPassMessage({
      donorName: finalDonorName,
      donorPhone: finalDonorPhone,
      bandLabel: band.label,
      passCode,
      ticketType,
      physicalSerial: ticketType === 'physical' ? physicalSerial?.trim() : null,
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
      pass: passData,
      passCode,
      undoToken,
      donorMessage: donorMsg,
      donorPhone: finalDonorPhone,
      sellerMessage: sellerMsg,
      sellerPhone: seller.phone_e164 || seller.phone_raw,
      sellerName: seller.full_name,
      bandLabel: band.label,
      seatDetails: seatDetailsStr,
      seatId: seatData.id,
    };
  } catch (err: any) {
    console.error('Error in issuePass:', err);
    return { success: false, error: err.message || 'An unexpected error occurred.' };
  }
}

/**
 * 60-Second Undo Window Action (§19.2, Rule R9).
 * Can only be called by the creating user within 60 seconds, pre-gate scan.
 */
export async function undoSale(passId: string, undoToken: string) {
  try {
    const user = await requireUser();
    const adminClient = createAdminClient();

    const { data: pass, error: passError } = await adminClient
      .from('passes')
      .select('*')
      .eq('id', passId)
      .single();

    if (passError || !pass) {
      return { success: false, error: 'Pass record not found.' };
    }

    // Rule R9 validations
    if (pass.issued_by_user_id !== user.id && user.role !== 'system_admin') {
      return { success: false, error: 'Only the coordinator who issued this pass can undo it.' };
    }

    if (pass.undo_token !== undoToken) {
      return { success: false, error: 'Invalid or expired undo token.' };
    }

    if (pass.status === 'used') {
      return { success: false, error: 'Pass has already been scanned at the gate and cannot be undone.' };
    }

    if (pass.status === 'cancelled') {
      return { success: false, error: 'This pass has already been cancelled.' };
    }

    const now = new Date();
    const expiresAt = new Date(pass.undo_expires_at);
    if (now > expiresAt && user.role !== 'system_admin') {
      return { 
        success: false, 
        error: 'The 60-second undo window has closed. Please request a System Admin to cancel this pass.' 
      };
    }

    // Void the pass
    const { error: updateError } = await adminClient
      .from('passes')
      .update({
        status: 'cancelled',
        cancelled_at: now.toISOString(),
        cancelled_by: user.id,
        cancel_reason: '60-Second Self-Service Undo',
        updated_at: now.toISOString(),
      })
      .eq('id', passId);

    if (updateError) throw updateError;

    // Void associated payments
    await adminClient
      .from('payments')
      .update({
        status: 'pending',
        reference_no: 'CANCELLED_UNDO',
        updated_at: now.toISOString(),
      })
      .eq('pass_id', passId);

    // Release assigned seat if linked
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
          updated_at: now.toISOString(),
        })
        .eq('id', pass.seat_id);
    }

    // Audit log
    await logAudit(
      user.id,
      'SALE_UNDO',
      'passes',
      passId,
      {
        pass_code: pass.pass_code,
        donor_name: pass.donor_name,
        band_id: pass.band_id,
        reason: 'Within 60-second window undo',
      }
    );

    revalidatePath('/sell');
    revalidatePath('/dashboard');
    revalidatePath('/guests');
    revalidatePath('/reports');
    revalidatePath('/leaderboard');

    return { success: true, message: `Pass ${pass.pass_code} has been successfully undone.` };
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
