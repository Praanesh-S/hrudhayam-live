'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAudit } from '@/lib/audit';
import { generateUniquePassCode } from '@/lib/band-utils';
import { signQrToken } from '@/lib/tokens';
import { revalidatePath } from 'next/cache';
import { IssuanceType, PaymentStatus } from '@/lib/types';

export interface CreateSaleInput {
  bandId: string;
  quantity: number;
  donorName: string;
  donorPhone: string;
  donorEmail?: string | null;
  paymentStatus: PaymentStatus;
  comment?: string | null;
  collectedAmountPerSeat?: number | null;
  discountApprovedBy?: string | null;
  individualGuests?: Array<{ name: string; phone: string; comment?: string }> | null;
  sponsorId?: string | null;
}

/**
 * Record a new sale of 1 or more seats in a price band.
 * Hard limit enforced: blocks sale if quantity > band remaining.
 */
export async function createSale(input: CreateSaleInput) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    const adminClient = createAdminClient();
    const { data: profile } = await adminClient
      .from('profiles')
      .select('id, role, is_active, full_name')
      .eq('id', user.id)
      .single();

    if (!profile || !profile.is_active) {
      throw new Error('User profile is not active');
    }

    if (profile.role === 'system_admin') {
      throw new Error('System Admin role does not record sales directly. Only Sub-Admins and Super Admins sell passes.');
    }

    const { 
      bandId, 
      quantity, 
      donorName, 
      donorPhone, 
      donorEmail, 
      paymentStatus, 
      comment, 
      collectedAmountPerSeat, 
      discountApprovedBy, 
      individualGuests,
      sponsorId
    } = input;

    if (!bandId || !donorName || !donorPhone || quantity < 1) {
      return { success: false, error: 'Missing required donor or quantity information' };
    }

    // Clean phone number (must be 10 digits)
    const cleanPhone = donorPhone.replace(/\D/g, '').slice(-10);
    if (cleanPhone.length !== 10) {
      return { success: false, error: 'Please enter a valid 10-digit mobile number for WhatsApp delivery' };
    }

    // 1. Fetch band details and check remaining capacity
    const { data: band, error: bandError } = await adminClient
      .from('bands')
      .select('*')
      .eq('id', bandId)
      .single();

    if (bandError || !band) {
      return { success: false, error: 'Selected price band not found' };
    }

    const { count: currentSoldCount } = await adminClient
      .from('sales')
      .select('*', { count: 'exact', head: true })
      .eq('band_id', bandId)
      .eq('cancelled', false);

    const sold = currentSoldCount || 0;
    const remaining = Math.max(0, band.total_capacity - sold);

    // Hard Limit Enforcement
    if (quantity > remaining) {
      return { 
        success: false, 
        error: `HARD LIMIT REACHED: Cannot fulfill sale of ${quantity} seats. Only ${remaining} seat${remaining === 1 ? '' : 's'} remaining in ${band.name}.` 
      };
    }

    // 2. Financial calculation
    const standardPrice = band.standard_price;
    let collectedPerSeat = collectedAmountPerSeat != null ? collectedAmountPerSeat : standardPrice;
    if (paymentStatus === 'pending') {
      collectedPerSeat = 0;
    }
    const discountPerSeat = Math.max(0, standardPrice - (collectedAmountPerSeat != null ? collectedAmountPerSeat : standardPrice));

    if (discountPerSeat > 0 && !discountApprovedBy) {
      return { success: false, error: 'A discount was specified, but no Super Admin or System Admin approver was selected.' };
    }

    // 3. Create SaleBatch if quantity > 1
    let saleBatchId: string | null = null;
    if (quantity > 1) {
      const { data: batchData, error: batchError } = await adminClient
        .from('sale_batches')
        .insert({
          lead_contact_name: donorName.trim(),
          lead_contact_phone: cleanPhone,
          note: comment?.trim() || `Group sale of ${quantity} seats in ${band.name}`,
          created_by: user.id,
        })
        .select('id')
        .single();

      if (batchError) throw batchError;
      saleBatchId = batchData.id;
    }

    // 4. Create each Sale record
    const createdSales = [];
    for (let i = 0; i < quantity; i++) {
      const seatGuest = individualGuests && individualGuests[i];
      const seatName = (seatGuest?.name && seatGuest.name.trim()) || donorName.trim();
      const seatPhone = (seatGuest?.phone && seatGuest.phone.replace(/\D/g, '').slice(-10)) || cleanPhone;
      const seatComment = seatGuest?.comment || comment?.trim() || null;

      const passCode = await generateUniquePassCode(adminClient);
      const qrToken = await signQrToken(passCode);

      const { data: saleData, error: saleError } = await adminClient
        .from('sales')
        .insert({
          band_id: bandId,
          donor_name: seatName,
          donor_phone: seatPhone,
          donor_email: donorEmail?.trim() || null,
          payment_status: paymentStatus,
          comment: seatComment,
          standard_price: standardPrice,
          collected_amount: collectedPerSeat,
          discount_amount: discountPerSeat,
          discount_approved_by: discountPerSeat > 0 ? discountApprovedBy : null,
          sold_by: user.id,
          pass_code: passCode,
          qr_token: qrToken,
          issuance_type: null,
          issued_at: null,
          checked_in: false,
          sponsor_id: sponsorId || null,
          sale_batch_id: saleBatchId,
          cancelled: false,
        })
        .select('*')
        .single();

      if (saleError) throw saleError;
      createdSales.push(saleData);

      // Log audit
      await logAudit(
        user.id,
        'SALE_CREATE',
        'sale',
        saleData.id,
        {
          band_name: band.name,
          donor_name: seatName,
          donor_phone: seatPhone,
          pass_code: passCode,
          payment_status: paymentStatus,
          standard_price: standardPrice,
          collected_amount: collectedPerSeat,
          discount_amount: discountPerSeat,
          sale_batch_id: saleBatchId,
          sold_by_name: profile.full_name,
        }
      );
    }

    revalidatePath('/sell');
    revalidatePath('/dashboard');
    revalidatePath('/guests');
    revalidatePath('/reports');

    return { 
      success: true, 
      sales: createdSales,
      saleBatchId,
      bandName: band.name 
    };
  } catch (err: any) {
    console.error('Error creating sale:', err);
    return { success: false, error: err.message || 'Failed to record sale' };
  }
}

/**
 * Update small details on ANY sale (Open to all team members).
 */
export async function updateSaleDetails(
  saleId: string, 
  details: { 
    donor_name?: string; 
    donor_phone?: string; 
    donor_email?: string | null; 
    comment?: string | null; 
    payment_status?: PaymentStatus;
  }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    const adminClient = createAdminClient();
    const { data: profile } = await adminClient
      .from('profiles')
      .select('id, role, is_active, full_name')
      .eq('id', user.id)
      .single();

    if (!profile || !profile.is_active) throw new Error('Unauthorized');

    const { data: oldSale } = await adminClient
      .from('sales')
      .select('*')
      .eq('id', saleId)
      .single();

    if (!oldSale) throw new Error('Sale record not found');

    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (details.donor_name !== undefined) updatePayload.donor_name = details.donor_name.trim();
    if (details.donor_phone !== undefined) updatePayload.donor_phone = details.donor_phone.replace(/\D/g, '').slice(-10);
    if (details.donor_email !== undefined) updatePayload.donor_email = details.donor_email?.trim() || null;
    if (details.comment !== undefined) updatePayload.comment = details.comment?.trim() || null;
    if (details.payment_status !== undefined) {
      updatePayload.payment_status = details.payment_status;
      if (details.payment_status === 'paid' && oldSale.payment_status === 'pending') {
        updatePayload.collected_amount = oldSale.standard_price - (oldSale.discount_amount || 0);
      } else if (details.payment_status === 'pending') {
        updatePayload.collected_amount = 0;
      }
    }

    const { error: updateError } = await adminClient
      .from('sales')
      .update(updatePayload)
      .eq('id', saleId);

    if (updateError) throw updateError;

    // Log audit
    const action = details.payment_status && details.payment_status !== oldSale.payment_status 
      ? 'PAYMENT_STATUS_CHANGE' 
      : 'DETAIL_EDIT';

    await logAudit(
      user.id,
      action,
      'sale',
      saleId,
      {
        pass_code: oldSale.pass_code,
        changes: updatePayload,
        edited_by: profile.full_name,
      }
    );

    revalidatePath('/guests');
    revalidatePath('/dashboard');
    revalidatePath('/reports');

    return { success: true };
  } catch (err: any) {
    console.error('Error updating sale details:', err);
    return { success: false, error: err.message || 'Failed to update sale details' };
  }
}

/**
 * Record pass issuance (WhatsApp or Printed).
 * Golden Rule: Once issued as WhatsApp or Printed, cannot switch channels.
 */
export async function recordIssuance(saleId: string, issuanceType: 'whatsapp' | 'printed') {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    const adminClient = createAdminClient();

    const { data: sale } = await adminClient
      .from('sales')
      .select('*')
      .eq('id', saleId)
      .single();

    if (!sale) throw new Error('Sale not found');

    // Golden rule enforcement
    if (sale.issuance_type && sale.issuance_type !== issuanceType && sale.issuance_type !== 'legacy_email') {
      return { 
        success: false, 
        error: `GOLDEN RULE ENFORCEMENT: Pass ${sale.pass_code} was already issued as "${sale.issuance_type.toUpperCase()}". It cannot be re-issued through a different channel.` 
      };
    }

    // Set issuance
    const now = new Date().toISOString();
    const { error } = await adminClient
      .from('sales')
      .update({
        issuance_type: issuanceType,
        issued_at: sale.issued_at || now,
        updated_at: now,
      })
      .eq('id', saleId);

    if (error) throw error;

    await logAudit(
      user.id,
      issuanceType === 'whatsapp' ? 'ISSUANCE_WHATSAPP' : 'ISSUANCE_PRINTED',
      'sale',
      saleId,
      {
        pass_code: sale.pass_code,
        donor_name: sale.donor_name,
        donor_phone: sale.donor_phone,
        issuance_type: issuanceType,
      }
    );

    revalidatePath('/guests');
    revalidatePath('/reports');

    return { success: true };
  } catch (err: any) {
    console.error('Error recording issuance:', err);
    return { success: false, error: err.message || 'Failed to record issuance' };
  }
}

/**
 * Cancel a sale and release inventory back to the band (SYSTEM ADMIN ONLY).
 */
export async function cancelSale(saleId: string, reason: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    const adminClient = createAdminClient();
    const { data: profile } = await adminClient
      .from('profiles')
      .select('id, role, is_active, full_name')
      .eq('id', user.id)
      .single();

    if (!profile || !profile.is_active || profile.role !== 'system_admin') {
      return { 
        success: false, 
        error: 'PROTECTED ACTION: Only the System Admin can cancel a seat sale to preserve audit integrity.' 
      };
    }

    const { data: sale } = await adminClient
      .from('sales')
      .select('*')
      .eq('id', saleId)
      .single();

    if (!sale) throw new Error('Sale not found');
    if (sale.cancelled) return { success: false, error: 'Sale is already cancelled' };

    const now = new Date().toISOString();
    const { error } = await adminClient
      .from('sales')
      .update({
        cancelled: true,
        cancelled_by: user.id,
        cancelled_at: now,
        updated_at: now,
      })
      .eq('id', saleId);

    if (error) throw error;

    await logAudit(
      user.id,
      'SALE_CANCEL',
      'sale',
      saleId,
      {
        pass_code: sale.pass_code,
        donor_name: sale.donor_name,
        donor_phone: sale.donor_phone,
        reason: reason?.trim() || 'No reason provided',
        cancelled_by: profile.full_name,
      }
    );

    revalidatePath('/guests');
    revalidatePath('/dashboard');
    revalidatePath('/sell');
    revalidatePath('/setup');
    revalidatePath('/reports');

    return { success: true };
  } catch (err: any) {
    console.error('Error cancelling sale:', err);
    return { success: false, error: err.message || 'Failed to cancel sale' };
  }
}

/**
 * Reassign a sale to a new donor (SYSTEM ADMIN ONLY).
 */
export async function reassignSale(saleId: string, newDonorName: string, newDonorPhone: string, notes?: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    const adminClient = createAdminClient();
    const { data: profile } = await adminClient
      .from('profiles')
      .select('id, role, is_active, full_name')
      .eq('id', user.id)
      .single();

    if (!profile || !profile.is_active || profile.role !== 'system_admin') {
      return { 
        success: false, 
        error: 'PROTECTED ACTION: Only the System Admin can reassign a seat sale.' 
      };
    }

    const { data: sale } = await adminClient
      .from('sales')
      .select('*')
      .eq('id', saleId)
      .single();

    if (!sale) throw new Error('Sale not found');

    const cleanPhone = newDonorPhone.replace(/\D/g, '').slice(-10);
    if (cleanPhone.length !== 10) {
      return { success: false, error: 'Please enter a valid 10-digit mobile number' };
    }

    const now = new Date().toISOString();
    const { error } = await adminClient
      .from('sales')
      .update({
        donor_name: newDonorName.trim(),
        donor_phone: cleanPhone,
        reassigned_to: `${newDonorName.trim()} (${cleanPhone})`,
        comment: notes ? `${sale.comment || ''} | Reassigned: ${notes}` : sale.comment,
        updated_at: now,
      })
      .eq('id', saleId);

    if (error) throw error;

    await logAudit(
      user.id,
      'SALE_REASSIGN',
      'sale',
      saleId,
      {
        pass_code: sale.pass_code,
        old_donor_name: sale.donor_name,
        old_donor_phone: sale.donor_phone,
        new_donor_name: newDonorName.trim(),
        new_donor_phone: cleanPhone,
        notes,
        reassigned_by: profile.full_name,
      }
    );

    revalidatePath('/guests');
    revalidatePath('/dashboard');
    revalidatePath('/reports');

    return { success: true };
  } catch (err: any) {
    console.error('Error reassigning sale:', err);
    return { success: false, error: err.message || 'Failed to reassign sale' };
  }
}
