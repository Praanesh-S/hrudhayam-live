'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/auth/guards';
import { logAudit } from '@/lib/audit';
import { revalidatePath } from 'next/cache';

/**
 * Confirm a pending payment as received (§12, §19.5).
 */
export async function markPaymentReceived(paymentId: string, referenceNo: string) {
  try {
    const user = await requireUser();
    const adminClient = createAdminClient();

    if (!referenceNo || !referenceNo.trim()) {
      return { success: false, error: 'Transaction reference number / UTR is mandatory.' };
    }

    const { data: payment, error: fetchError } = await adminClient
      .from('payments')
      .select('*, pass:passes(id, pass_code, donor_name)')
      .eq('id', paymentId)
      .single();

    if (fetchError || !payment) {
      return { success: false, error: 'Payment record not found.' };
    }

    const now = new Date().toISOString();
    const { error: updateError } = await adminClient
      .from('payments')
      .update({
        status: 'received',
        reference_no: referenceNo.trim(),
        collected_by_user_id: user.id,
        collected_at: now,
        updated_at: now,
      })
      .eq('id', paymentId);

    if (updateError) throw updateError;

    // If linked to a sponsor, also update sponsor status to received
    if (payment.sponsor_id) {
      await adminClient
        .from('sponsors')
        .update({ status: 'received', updated_at: now })
        .eq('id', payment.sponsor_id);
    }

    await logAudit(user.id, 'PAYMENT_RECEIVED', 'payments', paymentId, {
      amount: payment.amount,
      reference_no: referenceNo.trim(),
      confirmed_by: user.fullName,
    });

    revalidatePath('/payments');
    revalidatePath('/dashboard');
    revalidatePath('/reports');
    revalidatePath('/leaderboard');

    return { success: true };
  } catch (err: any) {
    console.error('Error confirming payment:', err);
    return { success: false, error: err.message || 'Failed to update payment.' };
  }
}
