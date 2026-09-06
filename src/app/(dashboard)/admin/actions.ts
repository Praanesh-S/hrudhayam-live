'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireSuperOrSystemAdmin, requireSystemAdmin } from '@/lib/auth/guards';
import { logAudit } from '@/lib/audit';
import { hashPassword } from '@/lib/auth/password';

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
 * Helper to dynamically sync band inventory quotas directly from individual row seat counts.
 * Ensures Band Quotas = sum of physical seats in assigned rows (always sums to 1,398).
 */
export async function syncBandAllocationsFromSeats(adminClient: any) {
  const { data: seatsData } = await adminClient
    .from('seats')
    .select('tier')
    .neq('row_label', 'SPL VIP');

  const counts: Record<number, number> = {
    5000: 0,
    3500: 0,
    2500: 0,
    1500: 0,
  };

  if (seatsData) {
    for (const s of seatsData) {
      const tier = s.tier === 3000 ? 3500 : s.tier;
      if (tier && counts[tier] !== undefined) {
        counts[tier]++;
      }
    }
  }

  await Promise.all([
    adminClient.from('bands').update({ total_allocated: counts[5000], total_capacity: counts[5000], updated_at: new Date().toISOString() }).eq('id', 'band_5000'),
    adminClient.from('bands').update({ total_allocated: counts[3500], total_capacity: counts[3500], updated_at: new Date().toISOString() }).eq('id', 'band_3500'),
    adminClient.from('bands').update({ total_allocated: counts[2500], total_capacity: counts[2500], updated_at: new Date().toISOString() }).eq('id', 'band_2500'),
    adminClient.from('bands').update({ total_allocated: counts[1500], total_capacity: counts[1500], updated_at: new Date().toISOString() }).eq('id', 'band_1500'),
  ]);
}

/**
 * Bulk-set pricing tier on a range of rows (e.g. Ground Floor Rows A–F to ₹5,000).
 * Updates both the rows table and all individual seat records in public.seats,
 * and automatically recalibrates band inventory quotas to match row seat counts.
 */
export async function bulkSetRowTier(section: 'Ground Floor' | 'Balcony', fromRow: string, toRow: string, tier: number) {
  try {
    const user = await requireSuperOrSystemAdmin();
    const adminClient = createAdminClient();

    const { data: rowsData } = await adminClient.from('rows').select('*').eq('section', section);
    if (!rowsData || rowsData.length === 0) return { success: false, error: 'Rows not found' };

    const sortedRows = rowsData.sort((a, b) => a.display_order - b.display_order);
    const startIdx = sortedRows.findIndex(r => r.row_label === fromRow);
    const endIdx = sortedRows.findIndex(r => r.row_label === toRow);

    if (startIdx === -1 || endIdx === -1) return { success: false, error: 'Invalid row range' };

    const range = sortedRows.slice(Math.min(startIdx, endIdx), Math.max(startIdx, endIdx) + 1);
    const targetRowIds = range.map(r => r.id);

    // Update rows
    await adminClient
      .from('rows')
      .update({ tier, updated_at: new Date().toISOString() })
      .in('id', targetRowIds);

    // Update corresponding seats
    await adminClient
      .from('seats')
      .update({ tier, updated_at: new Date().toISOString() })
      .in('row_id', targetRowIds);

    // Synchronize band quotas to match exact seat counts
    await syncBandAllocationsFromSeats(adminClient);

    await logAudit(user.id, 'BULK_SET_ROW_TIER', 'rows', `${section} ${fromRow}-${toRow}`, {
      tier,
      rows_count: targetRowIds.length,
    });

    revalidatePath('/admin/bands');
    revalidatePath('/sell');
    revalidatePath('/dashboard');

    return { success: true, count: targetRowIds.length };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update row tiers.' };
  }
}

/**
 * Assign an individual row to a specific band tier and auto-sync band capacities.
 */
export async function assignRowToBand(rowId: string, targetTier: number) {
  try {
    const user = await requireSuperOrSystemAdmin();
    const adminClient = createAdminClient();

    await adminClient.from('rows').update({ tier: targetTier, updated_at: new Date().toISOString() }).eq('id', rowId);
    await adminClient.from('seats').update({ tier: targetTier, updated_at: new Date().toISOString() }).eq('row_id', rowId);

    await syncBandAllocationsFromSeats(adminClient);

    revalidatePath('/admin/bands');
    revalidatePath('/sell');
    revalidatePath('/dashboard');

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to assign row to band.' };
  }
}

/**
 * Block exact individual seats (e.g. ['GF-A-01', 'GF-B-05']).
 * Blocked seats cannot be sold in /sell.
 */
export async function blockExactSeats(seatIds: string[], reason: string = 'VIP / Reserved') {
  try {
    const user = await requireSuperOrSystemAdmin();
    const adminClient = createAdminClient();

    if (!seatIds || seatIds.length === 0) {
      return { success: false, error: 'No seats selected to block.' };
    }

    // Verify none of the selected seats are already sold/issued
    const { data: soldSeats } = await adminClient
      .from('seats')
      .select('id, guest_name, pass_code')
      .in('id', seatIds)
      .or('guest_name.not.is.null,pass_code.not.is.null');

    if (soldSeats && soldSeats.length > 0) {
      return {
        success: false,
        error: `Cannot block: ${soldSeats.length} of the selected seats already have passes issued or guests assigned.`,
      };
    }

    const { error: updateErr } = await adminClient
      .from('seats')
      .update({
        is_blocked: true,
        blocked_reason: reason.trim() || 'VIP / Reserved',
        updated_at: new Date().toISOString(),
      })
      .in('id', seatIds);

    if (updateErr) throw updateErr;

    await logAudit(user.id, 'SEATS_BLOCKED', 'seats', seatIds.join(','), {
      seat_count: seatIds.length,
      seat_ids: seatIds,
      reason,
    });

    revalidatePath('/admin/bands');
    revalidatePath('/sell');
    revalidatePath('/dashboard');

    return { success: true, count: seatIds.length };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to block seats.' };
  }
}

/**
 * Unblock exact individual seats to release them back for sale.
 */
export async function unblockExactSeats(seatIds: string[]) {
  try {
    const user = await requireSuperOrSystemAdmin();
    const adminClient = createAdminClient();

    if (!seatIds || seatIds.length === 0) {
      return { success: false, error: 'No seats selected to unblock.' };
    }

    const { error: updateErr } = await adminClient
      .from('seats')
      .update({
        is_blocked: false,
        blocked_reason: null,
        updated_at: new Date().toISOString(),
      })
      .in('id', seatIds);

    if (updateErr) throw updateErr;

    await logAudit(user.id, 'SEATS_UNBLOCKED', 'seats', seatIds.join(','), {
      seat_count: seatIds.length,
      seat_ids: seatIds,
    });

    revalidatePath('/admin/bands');
    revalidatePath('/sell');
    revalidatePath('/dashboard');

    return { success: true, count: seatIds.length };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to unblock seats.' };
  }
}

/**
 * Block an entire row by section and row label (e.g. Balcony Row F).
 */
export async function blockRow(section: 'Ground Floor' | 'Balcony', rowLabel: string, reason: string = 'VIP / Reserved') {
  try {
    const user = await requireSuperOrSystemAdmin();
    const adminClient = createAdminClient();

    const { data: rowSeats } = await adminClient
      .from('seats')
      .select('id, guest_name, pass_code')
      .eq('section', section)
      .eq('row_label', rowLabel);

    if (!rowSeats || rowSeats.length === 0) {
      return { success: false, error: `Row ${rowLabel} in ${section} not found.` };
    }

    const soldCount = rowSeats.filter(s => s.guest_name || s.pass_code).length;
    if (soldCount > 0) {
      return {
        success: false,
        error: `Cannot block entire row: ${soldCount} seats in ${section} Row ${rowLabel} are already sold.`,
      };
    }

    const seatIds = rowSeats.map(s => s.id);
    return await blockExactSeats(seatIds, reason);
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to block row.' };
  }
}

/**
 * Unblock an entire row by section and row label.
 */
export async function unblockRow(section: 'Ground Floor' | 'Balcony', rowLabel: string) {
  try {
    const user = await requireSuperOrSystemAdmin();
    const adminClient = createAdminClient();

    const { data: rowSeats } = await adminClient
      .from('seats')
      .select('id')
      .eq('section', section)
      .eq('row_label', rowLabel);

    if (!rowSeats || rowSeats.length === 0) {
      return { success: false, error: `Row ${rowLabel} in ${section} not found.` };
    }

    const seatIds = rowSeats.map(s => s.id);
    return await unblockExactSeats(seatIds);
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to unblock row.' };
  }
}

/**
 * Recalibrate Band Capacities to match the exact venue architectural layout:
 * 1,398 Total Regular Seats: 467 (₹5,000) + 474 (₹3,500) + 0 (₹2,500) + 457 (₹1,500)
 * plus 50 SPL VIP Box seats.
 */
export async function recalibrateBandsToVenueCapacity() {
  try {
    const user = await requireSuperOrSystemAdmin();
    const adminClient = createAdminClient();

    await syncBandAllocationsFromSeats(adminClient);

    await logAudit(user.id, 'RECALIBRATE_VENUE_CAPACITY', 'bands', 'all', {
      total_allocated: 1398,
      note: 'Recalibrated band capacities from exact row seat sum (1,398 regular seats + 50 VIP box)',
    });

    revalidatePath('/admin/bands');
    revalidatePath('/sell');
    revalidatePath('/dashboard');
    revalidatePath('/reports');

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to recalibrate band capacities.' };
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
    revalidatePath('/admin/members');
    return { success: true, message: `User "${targetUser.login_id}" is now Super Admin.` };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ──────────────────────────────────────────────
// 5. Sub-Admin & User Account Management (§10)
// ──────────────────────────────────────────────

/**
 * Create a new user login account (Sub-Admin / Coordinator / Staff).
 */
export async function createUserAccount(data: {
  loginId: string;
  password: string;
  role: 'super_admin' | 'system_admin' | 'group_admin';
  memberId?: number | null;
  mustChangePassword?: boolean;
}) {
  try {
    const user = await requireSuperOrSystemAdmin();
    const adminClient = createAdminClient();

    const cleanLoginId = data.loginId.trim();
    if (!cleanLoginId || cleanLoginId.length < 3) {
      return { success: false, error: 'Login ID must be at least 3 characters long.' };
    }

    if (!data.password || data.password.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters long.' };
    }

    // Check uniqueness
    const { data: existing } = await adminClient
      .from('users')
      .select('id, login_id')
      .eq('login_id', cleanLoginId)
      .maybeSingle();

    if (existing) {
      return { success: false, error: `An account with login ID "${cleanLoginId}" already exists.` };
    }

    // Check if member already has an account
    if (data.memberId) {
      const { data: existingMemberUser } = await adminClient
        .from('users')
        .select('id, login_id')
        .eq('member_id', data.memberId)
        .maybeSingle();

      if (existingMemberUser) {
        return {
          success: false,
          error: `This member already has an active account with login ID "${existingMemberUser.login_id}".`,
        };
      }
    }

    const passwordHash = await hashPassword(data.password);

    const { data: newUser, error: insertError } = await adminClient
      .from('users')
      .insert({
        login_id: cleanLoginId,
        password_hash: passwordHash,
        role: data.role || 'group_admin',
        member_id: data.memberId || null,
        must_change_password: data.mustChangePassword !== false,
        is_active: true,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    await logAudit(user.id, 'USER_ACCOUNT_CREATE', 'users', newUser.id, {
      login_id: cleanLoginId,
      role: data.role,
      member_id: data.memberId,
      created_by: user.fullName,
    });

    revalidatePath('/admin/members');
    return { success: true, user: newUser };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to create user account.' };
  }
}

/**
 * 1-Click Provision of the 8 Team Coordinators with their 10-digit mobile number as login ID.
 */
export async function provisionAllCoordinators(defaultPassword = 'Welcome@2026') {
  try {
    const user = await requireSuperOrSystemAdmin();
    const adminClient = createAdminClient();

    const { data: coordinators, error: coordErr } = await adminClient
      .from('members')
      .select('id, full_name, phone_raw, phone_e164, group_id')
      .eq('is_group_admin', true)
      .order('group_id', { ascending: true });

    if (coordErr || !coordinators) throw coordErr || new Error('Could not fetch coordinators.');

    const passwordHash = await hashPassword(defaultPassword);
    let createdCount = 0;
    let skippedCount = 0;
    const summary: Array<{ name: string; team: number; loginId: string; status: 'created' | 'already_exists' }> = [];

    for (const c of coordinators) {
      const rawDigits = (c.phone_e164 || c.phone_raw || '').replace(/\D/g, '');
      const loginId = rawDigits.length >= 10 ? rawDigits.slice(-10) : rawDigits;

      if (!loginId) {
        skippedCount++;
        summary.push({ name: c.full_name, team: c.group_id, loginId: 'None', status: 'already_exists' });
        continue;
      }

      const { data: existing } = await adminClient
        .from('users')
        .select('id, member_id')
        .eq('login_id', loginId)
        .maybeSingle();

      if (existing) {
        if (!existing.member_id) {
          await adminClient.from('users').update({ member_id: c.id }).eq('id', existing.id);
        }
        skippedCount++;
        summary.push({ name: c.full_name, team: c.group_id, loginId, status: 'already_exists' });
      } else {
        const { error: insertErr } = await adminClient.from('users').insert({
          login_id: loginId,
          password_hash: passwordHash,
          role: 'group_admin',
          member_id: c.id,
          must_change_password: true,
          is_active: true,
        });

        if (insertErr) {
          console.error(`Failed to insert coordinator user ${c.full_name}:`, insertErr);
        } else {
          createdCount++;
          summary.push({ name: c.full_name, team: c.group_id, loginId, status: 'created' });
        }
      }
    }

    await logAudit(user.id, 'AUTO_PROVISION_COORDINATORS', 'users', 'bulk', {
      created_count: createdCount,
      skipped_count: skippedCount,
      default_password: defaultPassword,
      performed_by: user.fullName,
    });

    revalidatePath('/admin/members');
    return {
      success: true,
      createdCount,
      skippedCount,
      total: coordinators.length,
      defaultPassword,
      summary,
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to auto-provision coordinators.' };
  }
}

/**
 * Reset password for any user account.
 */
export async function resetUserPassword(userId: string, newPassword: string, forceChange = true) {
  try {
    const user = await requireSuperOrSystemAdmin();
    const adminClient = createAdminClient();

    if (!newPassword || newPassword.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters long.' };
    }

    const { data: targetUser } = await adminClient
      .from('users')
      .select('id, login_id')
      .eq('id', userId)
      .single();

    if (!targetUser) return { success: false, error: 'User not found.' };

    const newHash = await hashPassword(newPassword);

    const { error: updateErr } = await adminClient
      .from('users')
      .update({
        password_hash: newHash,
        must_change_password: forceChange,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (updateErr) throw updateErr;

    // Terminate existing sessions so password change takes immediate effect
    await adminClient.from('user_sessions').delete().eq('user_id', userId);

    await logAudit(user.id, 'USER_PASSWORD_RESET', 'users', userId, {
      login_id: targetUser.login_id,
      reset_by: user.fullName,
      must_change_password: forceChange,
    });

    revalidatePath('/admin/members');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to reset password.' };
  }
}

/**
 * Toggle active status of a user account (deactivate or reactivate).
 */
export async function toggleUserActive(userId: string, isActive: boolean) {
  try {
    const user = await requireSuperOrSystemAdmin();
    const adminClient = createAdminClient();

    if (user.id === userId) {
      return { success: false, error: 'You cannot deactivate your own account.' };
    }

    const { data: targetUser } = await adminClient
      .from('users')
      .select('id, login_id')
      .eq('id', userId)
      .single();

    if (!targetUser) return { success: false, error: 'User not found.' };

    const { error: updateErr } = await adminClient
      .from('users')
      .update({
        is_active: isActive,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (updateErr) throw updateErr;

    if (!isActive) {
      await adminClient.from('user_sessions').delete().eq('user_id', userId);
    }

    await logAudit(user.id, 'USER_STATUS_TOGGLE', 'users', userId, {
      login_id: targetUser.login_id,
      is_active: isActive,
      modified_by: user.fullName,
    });

    revalidatePath('/admin/members');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update account status.' };
  }
}

/**
 * Delete a user account (or deactivate if tied to audit or pass activity).
 */
export async function deleteUserAccount(userId: string) {
  try {
    const user = await requireSuperOrSystemAdmin();
    const adminClient = createAdminClient();

    if (user.id === userId) {
      return { success: false, error: 'You cannot delete your own account.' };
    }

    const { data: targetUser } = await adminClient
      .from('users')
      .select('id, login_id')
      .eq('id', userId)
      .single();

    if (!targetUser) return { success: false, error: 'User not found.' };

    // Check if user has associated passes or payments
    const [
      { count: passesCount },
      { count: paymentsCount },
    ] = await Promise.all([
      adminClient.from('passes').select('id', { count: 'exact', head: true }).eq('issued_by_user_id', userId),
      adminClient.from('payments').select('id', { count: 'exact', head: true }).eq('collected_by_user_id', userId),
    ]);

    if ((passesCount || 0) > 0 || (paymentsCount || 0) > 0) {
      // Deactivate to protect relational integrity and audit history
      await adminClient.from('user_sessions').delete().eq('user_id', userId);
      await adminClient.from('users').update({ is_active: false, updated_at: new Date().toISOString() }).eq('id', userId);
      await logAudit(user.id, 'USER_DEACTIVATE_PRESERVE_FK', 'users', userId, {
        login_id: targetUser.login_id,
        reason: 'User has recorded passes/payments. Deactivated instead of deleted to protect audit history.',
      });
      revalidatePath('/admin/members');
      return {
        success: true,
        deactivatedInstead: true,
        message: `Account "${targetUser.login_id}" has recorded sales or collections. It has been deactivated instead of deleted to preserve audit integrity.`,
      };
    }

    // Otherwise safe to hard delete
    await adminClient.from('user_sessions').delete().eq('user_id', userId);
    const { error: delErr } = await adminClient.from('users').delete().eq('id', userId);
    if (delErr) throw delErr;

    await logAudit(user.id, 'USER_ACCOUNT_DELETE', 'users', userId, {
      login_id: targetUser.login_id,
      deleted_by: user.fullName,
    });

    revalidatePath('/admin/members');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to delete user account.' };
  }
}
