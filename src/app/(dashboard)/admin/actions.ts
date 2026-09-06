'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireSuperOrSystemAdmin, requireSystemAdmin } from '@/lib/auth/guards';
import { logAudit } from '@/lib/audit';

// ──────────────────────────────────────────────
// 1. Bands & Protected Seats (§10)
// ──────────────────────────────────────────────

/**
 * Update Band Allocation & Price.
 * Guard: Cannot reduce total below the number of passes already issued!
 */
export async function updateBandAllocation(bandId: string, newTotal: number, newPrice?: number) {
  try {
    const user = await requireSuperOrSystemAdmin();
    const adminClient = createAdminClient();

    // 1. Count active passes in this band
    const { count: activePassesCount } = await adminClient
      .from('passes')
      .select('id', { count: 'exact', head: true })
      .eq('band_id', bandId)
      .neq('status', 'cancelled');

    const issuedCount = activePassesCount || 0;

    if (newTotal < issuedCount) {
      return {
        success: false,
        error: `Cannot reduce allocation to ${newTotal}. There are already ${issuedCount} passes issued in this band.`,
      };
    }

    const { data: oldBand } = await adminClient.from('bands').select('*').eq('id', bandId).single();

    const updatePayload: Record<string, any> = {
      total_allocated: newTotal,
      total_capacity: newTotal, // sync legacy column
      updated_at: new Date().toISOString(),
    };

    if (newPrice !== undefined && newPrice > 0) {
      updatePayload.price = newPrice;
      updatePayload.standard_price = newPrice;
    }

    const { error: updateError } = await adminClient
      .from('bands')
      .update(updatePayload)
      .eq('id', bandId);

    if (updateError) throw updateError;

    await logAudit(user.id, 'BAND_CAPACITY_SET', 'bands', bandId, updatePayload, oldBand);

    revalidatePath('/admin/bands');
    revalidatePath('/sell');
    revalidatePath('/dashboard');
    revalidatePath('/reports');

    return { success: true };
  } catch (err: any) {
    console.error('Error updating band allocation:', err);
    return { success: false, error: err.message || 'Failed to update band.' };
  }
}

/**
 * Create an Earmarked Protected Block (VIP, Police, Corporation).
 */
export async function createProtectedBlock(label: string, seatCount: number) {
  try {
    const user = await requireSuperOrSystemAdmin();
    const adminClient = createAdminClient();

    if (!label.trim() || seatCount < 1) {
      return { success: false, error: 'Label and positive seat count are required.' };
    }

    const { data: block, error } = await adminClient
      .from('protected_blocks')
      .insert({
        label: label.trim(),
        seat_count: seatCount,
      })
      .select()
      .single();

    if (error) throw error;

    await logAudit(user.id, 'PROTECTED_BLOCK_CREATE', 'protected_blocks', block.id, {
      label: block.label,
      seat_count: block.seat_count,
    });

    revalidatePath('/admin/bands');
    revalidatePath('/dashboard');
    return { success: true, block };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Release a Protected Block into a sellable band (§10).
 * Increments target band's total_allocated count by the block's seat count.
 */
export async function releaseProtectedBlock(blockId: string, targetBandId: string) {
  try {
    const user = await requireSuperOrSystemAdmin();
    const adminClient = createAdminClient();

    const { data: block } = await adminClient
      .from('protected_blocks')
      .select('*')
      .eq('id', blockId)
      .single();

    if (!block) return { success: false, error: 'Protected block not found.' };
    if (block.released_to_band_id) {
      return { success: false, error: 'This block has already been released.' };
    }

    const { data: band } = await adminClient
      .from('bands')
      .select('id, label, total_allocated')
      .eq('id', targetBandId)
      .single();

    if (!band) return { success: false, error: 'Target band not found.' };

    const newAllocation = (band.total_allocated || 0) + block.seat_count;

    // 1. Update band allocation
    await adminClient
      .from('bands')
      .update({ total_allocated: newAllocation, total_capacity: newAllocation })
      .eq('id', targetBandId);

    // 2. Mark block as released
    await adminClient
      .from('protected_blocks')
      .update({
        released_to_band_id: targetBandId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', blockId);

    await logAudit(user.id, 'PROTECTED_BLOCK_RELEASE', 'protected_blocks', blockId, {
      released_to_band_id: targetBandId,
      seats_added: block.seat_count,
      new_band_total: newAllocation,
    });

    revalidatePath('/admin/bands');
    revalidatePath('/sell');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ──────────────────────────────────────────────
// 2. Groups & Members Management (§10)
// ──────────────────────────────────────────────

/**
 * Edit mobile number of a member (First-class action, §10).
 */
export async function updateMemberPhone(memberId: number, newPhoneRaw: string) {
  try {
    const user = await requireSuperOrSystemAdmin();
    const adminClient = createAdminClient();

    const { data: oldMember } = await adminClient.from('members').select('*').eq('id', memberId).single();
    if (!oldMember) return { success: false, error: 'Member not found.' };

    const digits = newPhoneRaw.replace(/\D/g, '');
    let status: 'ok' | 'missing' | 'foreign' | 'unparsed' = 'ok';
    let e164: string | null = null;

    if (!digits || digits.length < 5) {
      status = 'missing';
    } else if (newPhoneRaw.trim().startsWith('+1') || digits.length === 11 && digits.startsWith('1')) {
      status = 'foreign';
      e164 = `+${digits}`;
    } else if (digits.length === 10) {
      status = 'ok';
      e164 = `+91${digits}`;
    } else {
      status = 'unparsed';
      e164 = `+${digits}`;
    }

    const { error: updateErr } = await adminClient
      .from('members')
      .update({
        phone_raw: newPhoneRaw.trim(),
        phone_e164: e164,
        phone_status: status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', memberId);

    if (updateErr) throw updateErr;

    await logAudit(user.id, 'MEMBER_PHONE_UPDATE', 'members', String(memberId), {
      old_phone: oldMember.phone_raw,
      new_phone: newPhoneRaw,
      phone_status: status,
    });

    revalidatePath('/admin/members');
    revalidatePath('/sell');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Move a member to another group (§10).
 * Confirmation requirement: "This will move N sales and ₹X from Team A to Team B."
 * Sales automatically follow the member because sales credit is tied to seller_member_id!
 */
export async function moveMemberToGroup(memberId: number, targetGroupId: number) {
  try {
    const user = await requireSuperOrSystemAdmin();
    const adminClient = createAdminClient();

    const { data: member } = await adminClient
      .from('members')
      .select('*, groups(id, name)')
      .eq('id', memberId)
      .single();

    if (!member) return { success: false, error: 'Member not found.' };

    const { data: targetGroup } = await adminClient
      .from('groups')
      .select('*')
      .eq('id', targetGroupId)
      .single();

    if (!targetGroup) return { success: false, error: 'Target team not found.' };

    // Count sales and amount moving
    const { data: memberPasses } = await adminClient
      .from('passes')
      .select('id, payments(amount, status)')
      .eq('seller_member_id', memberId)
      .neq('status', 'cancelled');

    let totalAmount = 0;
    const passesCount = memberPasses?.length || 0;
    for (const p of memberPasses || []) {
      const pays = (p as any).payments;
      if (Array.isArray(pays)) {
        for (const pay of pays) {
          if (pay.status === 'received') totalAmount += pay.amount || 0;
        }
      }
    }

    // Move member
    const { error: moveErr } = await adminClient
      .from('members')
      .update({
        group_id: targetGroupId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', memberId);

    if (moveErr) throw moveErr;

    await logAudit(user.id, 'MEMBER_MOVE_GROUP', 'members', String(memberId), {
      member_name: member.full_name,
      from_group_id: member.group_id,
      from_group_name: member.groups?.name,
      to_group_id: targetGroupId,
      to_group_name: targetGroup.name,
      passes_moved: passesCount,
      amount_moved: totalAmount,
    });

    revalidatePath('/admin/members');
    revalidatePath('/leaderboard');
    revalidatePath('/reports');
    revalidatePath('/sell');

    return {
      success: true,
      passesMoved: passesCount,
      amountMoved: totalAmount,
      fromGroupName: member.groups?.name,
      toGroupName: targetGroup.name,
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ──────────────────────────────────────────────
// 3. Cancel or Move a Pass (Rule R3: System Admin Only)
// ──────────────────────────────────────────────

/**
 * Cancel a Pass and release seat back to band (Rule R3: SYSTEM ADMIN ONLY).
 */
export async function cancelPassBySystemAdmin(passId: string, reason: string) {
  try {
    const user = await requireSystemAdmin();
    const adminClient = createAdminClient();

    if (!reason?.trim()) {
      return { success: false, error: 'A specific cancellation reason is mandatory for audit compliance.' };
    }

    const { data: pass } = await adminClient
      .from('passes')
      .select('*')
      .eq('id', passId)
      .single();

    if (!pass) return { success: false, error: 'Pass not found.' };
    if (pass.status === 'cancelled') return { success: false, error: 'Pass is already cancelled.' };

    const now = new Date().toISOString();

    // Void pass
    const { error: passErr } = await adminClient
      .from('passes')
      .update({
        status: 'cancelled',
        cancelled_at: now,
        cancelled_by: user.id,
        cancel_reason: reason.trim(),
        updated_at: now,
      })
      .eq('id', passId);

    if (passErr) throw passErr;

    // Void payment
    await adminClient
      .from('payments')
      .update({
        status: 'pending',
        reference_no: `CANCELLED: ${reason.trim()}`,
        updated_at: now,
      })
      .eq('pass_id', passId);

    await logAudit(user.id, 'PASS_CANCEL', 'passes', passId, {
      pass_code: pass.pass_code,
      donor_name: pass.donor_name,
      band_id: pass.band_id,
      reason: reason.trim(),
      system_admin: user.fullName,
    });

    revalidatePath('/admin/passes');
    revalidatePath('/sell');
    revalidatePath('/dashboard');
    revalidatePath('/reports');
    revalidatePath('/leaderboard');

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Move a Pass to Another Band (Rule R3: SYSTEM ADMIN ONLY).
 */
export async function movePassToBandBySystemAdmin(passId: string, targetBandId: string, reason: string) {
  try {
    const user = await requireSystemAdmin();
    const adminClient = createAdminClient();

    const { data: pass } = await adminClient.from('passes').select('*').eq('id', passId).single();
    if (!pass) return { success: false, error: 'Pass not found.' };

    // Check availability in target band
    const { data: avail } = await adminClient.rpc('get_band_available_seats', { p_band_id: targetBandId });
    if ((avail || 0) < 1) {
      return { success: false, error: 'Target band is completely full. Cannot move pass.' };
    }

    const { data: targetBand } = await adminClient.from('bands').select('*').eq('id', targetBandId).single();

    const { error: moveErr } = await adminClient
      .from('passes')
      .update({
        band_id: targetBandId,
        cancel_reason: reason ? `Moved: ${reason}` : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', passId);

    if (moveErr) throw moveErr;

    // Update payment amount if necessary
    if (targetBand) {
      await adminClient
        .from('payments')
        .update({
          amount: targetBand.price,
          updated_at: new Date().toISOString(),
        })
        .eq('pass_id', passId);
    }

    await logAudit(user.id, 'PASS_MOVE_BAND', 'passes', passId, {
      pass_code: pass.pass_code,
      from_band: pass.band_id,
      to_band: targetBandId,
      reason,
      system_admin: user.fullName,
    });

    revalidatePath('/admin/passes');
    revalidatePath('/sell');
    revalidatePath('/dashboard');
    revalidatePath('/reports');
    revalidatePath('/leaderboard');

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ──────────────────────────────────────────────
// 4. Role & Super Admin Reassignment
// ──────────────────────────────────────────────

/**
 * Reassign Super Admin role to a different user account.
 * Accessible by Praanesh / System Admin to delegate organizer role if required.
 */
export async function reassignSuperAdmin(targetUserId: string) {
  try {
    const user = await requireSuperOrSystemAdmin();
    const adminClient = createAdminClient();

    const { data: targetUser } = await adminClient
      .from('users')
      .select('id, login_id, role')
      .eq('id', targetUserId)
      .single();

    if (!targetUser) return { success: false, error: 'Target user account not found.' };

    const { error: updateErr } = await adminClient
      .from('users')
      .update({
        role: 'super_admin',
        updated_at: new Date().toISOString(),
      })
      .eq('id', targetUserId);

    if (updateErr) throw updateErr;

    await logAudit(user.id, 'REASSIGN_SUPER_ADMIN', 'users', targetUserId, {
      new_super_admin: targetUser.login_id,
      assigned_by: user.fullName,
    });

    revalidatePath('/admin/users');
    return { success: true, message: `User "${targetUser.login_id}" is now Super Admin.` };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
