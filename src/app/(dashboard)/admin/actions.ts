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
 * Update the price of a price band (e.g. change ₹5,000 to ₹6,000).
 * Updates bands.price, bands.standard_price, and bands.label/name.
 * Also synchronizes the tier column on associated rows and seats.
 */
export async function updateBandPrice(bandId: string, newPrice: number) {
  try {
    const user = await requireSuperOrSystemAdmin();
    const adminClient = createAdminClient();

    if (!newPrice || newPrice <= 0) {
      return { success: false, error: 'Price must be greater than 0.' };
    }

    const { data: oldBand } = await adminClient
      .from('bands')
      .select('*')
      .eq('id', bandId)
      .single();

    if (!oldBand) return { success: false, error: 'Band not found.' };

    const oldPrice = oldBand.price;
    // Derive clean letter prefix, e.g. "Band A" from "Band A (₹5,000)"
    const bandLetter = oldBand.label ? oldBand.label.split('(')[0].trim() : (oldBand.name ? oldBand.name.split('(')[0].trim() : 'Band');
    const newLabel = `${bandLetter} (₹${newPrice.toLocaleString('en-IN')})`;

    const updatePayload = {
      price: newPrice,
      standard_price: newPrice,
      label: newLabel,
      name: newLabel,
      updated_at: new Date().toISOString(),
    };

    const { error: updateError } = await adminClient
      .from('bands')
      .update(updatePayload)
      .eq('id', bandId);

    if (updateError) throw updateError;

    // Update tier in rows and seats that matched oldPrice
    if (oldPrice && oldPrice !== newPrice) {
      await adminClient
        .from('rows')
        .update({ tier: newPrice, updated_at: new Date().toISOString() })
        .eq('tier', oldPrice);

      await adminClient
        .from('seats')
        .update({ tier: newPrice, updated_at: new Date().toISOString() })
        .eq('tier', oldPrice);
    }

    await logAudit(user.id, 'BAND_PRICE_UPDATE', 'bands', bandId, {
      old_price: oldPrice,
      new_price: newPrice,
      label: newLabel,
    });

    revalidatePath('/admin/bands');
    revalidatePath('/sell');
    revalidatePath('/dashboard');
    revalidatePath('/reports');
    return { success: true, band: { ...oldBand, ...updatePayload } };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update band price.' };
  }
}

/**
 * Dynamic helper to synchronize band allocation counts strictly from public.seats.
 */
export async function syncBandAllocationsFromSeats(adminClient: any) {
  const [{ data: bandsData }, { data: seatsData }] = await Promise.all([
    adminClient.from('bands').select('*').order('sort_order'),
    adminClient.from('seats').select('tier').neq('row_label', 'SPL VIP'),
  ]);

  if (!bandsData || bandsData.length === 0) return;

  const bandPriceMap = new Map<number, string>();
  for (const b of bandsData) {
    bandPriceMap.set(b.price, b.id);
  }

  const counts: Record<string, number> = {};
  for (const b of bandsData) {
    counts[b.id] = 0;
  }

  if (seatsData) {
    for (const s of seatsData) {
      const tier = s.tier;
      if (tier && bandPriceMap.has(tier)) {
        const bandId = bandPriceMap.get(tier)!;
        counts[bandId] = (counts[bandId] || 0) + 1;
      }
    }
  }

  await Promise.all(
    bandsData.map((b: any) =>
      adminClient
        .from('bands')
        .update({
          total_allocated: counts[b.id] || 0,
          total_capacity: counts[b.id] || 0,
          updated_at: new Date().toISOString(),
        })
        .eq('id', b.id)
    )
  );
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
 * Save complete hall layout plan with staged checks (Step 3).
 * Updates seats, rows, recomputes band quotas, and records audit trail.
 */
export async function saveLayoutPlan(
  seatsUpdates: Array<{
    id: string;
    category: string;
    price: number;
    counts_to_raise: boolean;
    obligation_type?: string | null;
    name?: string | null;
  }>,
  reassignments?: Array<{
    row: string;
    section: string;
    salesCount: number;
    oldPrice: number;
    newPrice: number;
  }>
) {
  try {
    const user = await requireSuperOrSystemAdmin();
    const adminClient = createAdminClient();

    if (!seatsUpdates || seatsUpdates.length === 0) {
      return { success: false, error: 'No seat updates provided.' };
    }

    // 1. Fetch currently sold or pending seats to protect historical pass prices
    const { data: bookedSeats } = await adminClient
      .from('seats')
      .select('id, price, category')
      .or('sold.eq.true,payment_status.not.is.null');

    const bookedMap = new Map((bookedSeats || []).map((s) => [s.id, s]));

    // 2. Update seats in parallel batches, preserving prices on already-sold seats
    const now = new Date().toISOString();
    const batchSize = 100;
    for (let i = 0; i < seatsUpdates.length; i += batchSize) {
      const batch = seatsUpdates.slice(i, i + batchSize);
      await Promise.all(
        batch.map((s) => {
          const booked = bookedMap.get(s.id);
          // If seat was already booked/sold, strictly preserve its historical price & category
          const category = booked ? booked.category : s.category;
          const price = booked && booked.price !== null ? booked.price : s.price;

          return adminClient
            .from('seats')
            .update({
              category,
              tier: price,
              price,
              counts_to_raise: s.counts_to_raise,
              obligation_type: s.obligation_type || null,
              name: s.name || null,
              is_blocked: s.category === 'blocked',
              updated_at: now,
            })
            .eq('id', s.id);
        })
      );
    }

    // 3. If rows were re-tiered, update rows table tier and record required audit entries
    if (reassignments && reassignments.length > 0) {
      for (const r of reassignments) {
        // Update rows table tier for future seat allocations
        await adminClient
          .from('rows')
          .update({ tier: r.newPrice, updated_at: now })
          .eq('section', r.section)
          .eq('row_label', r.row);

        // Record individual re-tier audit log
        await logAudit(user.id, 'ROW_RETIERED', 'rows', `${r.section} Row ${r.row}`, {
          row: `Row ${r.row}`,
          section: r.section,
          previous_price: r.oldPrice,
          new_price: r.newPrice,
          already_sold_count: r.salesCount,
          timestamp: now,
        });
      }
    }

    // 4. Compute quotas for each band
    const bandCounts: Record<string, number> = {
      band_5000: 0,
      band_3500: 0,
      band_2500: 0,
      band_1500: 0,
      band_pp: 0,
    };

    for (const s of seatsUpdates) {
      if (s.category === 'b5000') bandCounts.band_5000++;
      else if (s.category === 'b3500') bandCounts.band_3500++;
      else if (s.category === 'b2500') bandCounts.band_2500++;
      else if (s.category === 'b1500') bandCounts.band_1500++;
      else if (s.category === 'pp') bandCounts.band_pp++;
    }

    // 5. Update bands table quotas
    await Promise.all([
      adminClient.from('bands').update({ total_allocated: bandCounts.band_5000, total_capacity: bandCounts.band_5000, updated_at: now }).eq('id', 'band_5000'),
      adminClient.from('bands').update({ total_allocated: bandCounts.band_3500, total_capacity: bandCounts.band_3500, updated_at: now }).eq('id', 'band_3500'),
      adminClient.from('bands').update({ total_allocated: bandCounts.band_2500, total_capacity: bandCounts.band_2500, updated_at: now }).eq('id', 'band_2500'),
      adminClient.from('bands').update({ total_allocated: bandCounts.band_1500, total_capacity: bandCounts.band_1500, updated_at: now }).eq('id', 'band_1500'),
      adminClient.from('bands').update({ total_allocated: bandCounts.band_pp, total_capacity: bandCounts.band_pp, updated_at: now }).eq('id', 'band_pp'),
    ]);

    // 6. Record layout plan committed audit log
    await logAudit(user.id, 'LAYOUT_PLAN_COMMITTED', 'seats', 'all', {
      total_seats_updated: seatsUpdates.length,
      band_quotas: bandCounts,
      reassignments: reassignments || [],
      saved_at: now,
    });

    revalidatePath('/admin/bands');
    revalidatePath('/dashboard');
    revalidatePath('/sell');
    revalidatePath('/reports');

    return { success: true, savedAt: now };
  } catch (err: any) {
    console.error('Error saving layout plan:', err);
    return { success: false, error: err.message || 'Failed to save layout plan.' };
  }
}

/**
 * Update an individual seat's name (for VIP, Obligation, or Sponsor comp).
 */
export async function updateSeatName(seatId: string, name: string) {
  try {
    const user = await requireSuperOrSystemAdmin();
    const adminClient = createAdminClient();

    const cleanName = name.trim() || null;
    const { error } = await adminClient
      .from('seats')
      .update({
        name: cleanName,
        guest_name: cleanName,
        updated_at: new Date().toISOString(),
      })
      .eq('id', seatId);

    if (error) throw error;

    await logAudit(user.id, 'SEAT_NAME_UPDATE', 'seats', seatId, {
      seat_id: seatId,
      name: cleanName,
    });

    revalidatePath('/admin/bands');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update seat name.' };
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
 * Earmarks seats from a specific price band, deducting from sellable quota so total remains 1,398.
 */
export async function createProtectedBlock(label: string, seatCount: number, bandId?: string) {
  try {
    const user = await requireSuperOrSystemAdmin();
    const adminClient = createAdminClient();

    if (!label.trim() || seatCount < 1) {
      return { success: false, error: 'Label and positive seat count are required.' };
    }

    const targetBandId = bandId || 'band_5000';

    const { data: band } = await adminClient
      .from('bands')
      .select('id, label, total_allocated')
      .eq('id', targetBandId)
      .single();

    if (!band) return { success: false, error: 'Price band not found.' };

    if ((band.total_allocated || 0) < seatCount) {
      return {
        success: false,
        error: `Cannot block ${seatCount} seats from ${band.label}. Only ${band.total_allocated || 0} seats available.`,
      };
    }

    const { data: block, error } = await adminClient
      .from('protected_blocks')
      .insert({
        label: label.trim(),
        seat_count: seatCount,
        band_id: targetBandId,
      })
      .select()
      .single();

    if (error) throw error;

    // Deduct from the band's sellable quota
    const newAllocation = Math.max(0, (band.total_allocated || 0) - seatCount);
    await adminClient
      .from('bands')
      .update({
        total_allocated: newAllocation,
        total_capacity: newAllocation,
        updated_at: new Date().toISOString(),
      })
      .eq('id', targetBandId);

    await logAudit(user.id, 'PROTECTED_BLOCK_CREATE', 'protected_blocks', block.id, {
      label: block.label,
      seat_count: block.seat_count,
      band_id: targetBandId,
      band_label: band.label,
      new_band_allocation: newAllocation,
    });

    revalidatePath('/admin/bands');
    revalidatePath('/dashboard');
    revalidatePath('/sell');
    return { success: true, block };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Release a Protected Block into a sellable band (§10).
 * Restores the block's seat count back into the target band's inventory.
 */
export async function releaseProtectedBlock(blockId: string, targetBandId?: string) {
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

    const releaseBandId = targetBandId || block.band_id || 'band_5000';

    const { data: band } = await adminClient
      .from('bands')
      .select('id, label, total_allocated')
      .eq('id', releaseBandId)
      .single();

    if (!band) return { success: false, error: 'Target band not found.' };

    const newAllocation = (band.total_allocated || 0) + block.seat_count;

    // 1. Update band allocation (restore seats)
    await adminClient
      .from('bands')
      .update({ total_allocated: newAllocation, total_capacity: newAllocation, updated_at: new Date().toISOString() })
      .eq('id', releaseBandId);

    // 2. Mark block as released
    await adminClient
      .from('protected_blocks')
      .update({
        released_to_band_id: releaseBandId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', blockId);

    await logAudit(user.id, 'PROTECTED_BLOCK_RELEASE', 'protected_blocks', blockId, {
      released_to_band_id: releaseBandId,
      seats_restored: block.seat_count,
      new_band_total: newAllocation,
    });

    revalidatePath('/admin/bands');
    revalidatePath('/sell');
    revalidatePath('/dashboard');
    revalidatePath('/reports');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Delete / Remove an Earmarked Protected Block.
 * If unreleased, returns the earmarked seats back to its originating band.
 */
export async function deleteProtectedBlock(blockId: string) {
  try {
    const user = await requireSuperOrSystemAdmin();
    const adminClient = createAdminClient();

    const { data: block } = await adminClient
      .from('protected_blocks')
      .select('*')
      .eq('id', blockId)
      .single();

    if (!block) return { success: false, error: 'Block not found.' };

    // If unreleased, return seats back to its band
    if (!block.released_to_band_id && block.band_id) {
      const { data: band } = await adminClient
        .from('bands')
        .select('id, total_allocated')
        .eq('id', block.band_id)
        .single();

      if (band) {
        const restored = (band.total_allocated || 0) + block.seat_count;
        await adminClient
          .from('bands')
          .update({ total_allocated: restored, total_capacity: restored, updated_at: new Date().toISOString() })
          .eq('id', block.band_id);
      }
    }

    await adminClient.from('protected_blocks').delete().eq('id', blockId);

    await logAudit(user.id, 'PROTECTED_BLOCK_DELETE', 'protected_blocks', blockId, block);

    revalidatePath('/admin/bands');
    revalidatePath('/dashboard');
    revalidatePath('/sell');
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
 * Create a new user login account (Members or Non-Members: Sub-Admin / Coordinator / Staff).
 */
export async function createUserAccount(data: {
  loginId: string;
  password: string;
  role: 'super_admin' | 'system_admin' | 'group_admin' | 'tech_coordinator';
  memberId?: number | null;
  fullName?: string | null;
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
        full_name: data.fullName?.trim() || null,
        must_change_password: data.mustChangePassword !== false,
        is_active: true,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // If linked to member, update member login status
    if (data.memberId) {
      const memberUpdates: any = {
        has_login: true,
        updated_at: new Date().toISOString(),
      };
      if (data.role === 'tech_coordinator') {
        memberUpdates.is_tech_coord = true;
      }
      await adminClient.from('members').update(memberUpdates).eq('id', data.memberId);
    }

    await logAudit(user.id, 'USER_ACCOUNT_CREATE', 'users', newUser.id, {
      login_id: cleanLoginId,
      role: data.role,
      member_id: data.memberId,
      full_name: data.fullName,
      created_by: user.fullName,
    });

    revalidatePath('/admin/users');
    revalidatePath('/admin/members');
    return { success: true, user: newUser };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to create user account.' };
  }
}

/**
 * Update an existing user account (Login ID, Full Name, Role, Active Status, or Password).
 */
export async function updateUserAccount(data: {
  userId: string;
  loginId?: string;
  fullName?: string | null;
  role?: 'super_admin' | 'system_admin' | 'group_admin' | 'tech_coordinator';
  password?: string;
  isActive?: boolean;
  mustChangePassword?: boolean;
}) {
  try {
    const user = await requireSuperOrSystemAdmin();
    const adminClient = createAdminClient();

    const { data: existingUser } = await adminClient
      .from('users')
      .select('id, login_id, member_id, role')
      .eq('id', data.userId)
      .single();

    if (!existingUser) return { success: false, error: 'User account not found.' };

    const updatePayload: any = {
      updated_at: new Date().toISOString(),
    };

    if (data.loginId) {
      const cleanLogin = data.loginId.trim();
      if (cleanLogin.length < 3) {
        return { success: false, error: 'Login ID must be at least 3 characters.' };
      }
      // Check collision
      const { data: collision } = await adminClient
        .from('users')
        .select('id')
        .eq('login_id', cleanLogin)
        .neq('id', data.userId)
        .maybeSingle();

      if (collision) {
        return { success: false, error: `Login ID "${cleanLogin}" is already taken by another account.` };
      }
      updatePayload.login_id = cleanLogin;
    }

    if (data.fullName !== undefined) {
      updatePayload.full_name = data.fullName ? data.fullName.trim() : null;
    }

    if (data.role) {
      updatePayload.role = data.role;
    }

    if (data.isActive !== undefined) {
      updatePayload.is_active = data.isActive;
      if (!data.isActive) {
        // Kill session immediately
        await adminClient.from('user_sessions').delete().eq('user_id', data.userId);
      }
    }

    if (data.mustChangePassword !== undefined) {
      updatePayload.must_change_password = data.mustChangePassword;
    }

    if (data.password && data.password.trim()) {
      if (data.password.length < 6) {
        return { success: false, error: 'Password must be at least 6 characters long.' };
      }
      updatePayload.password_hash = await hashPassword(data.password);
      // Kill previous sessions on password change
      await adminClient.from('user_sessions').delete().eq('user_id', data.userId);
    }

    const { error: updateErr } = await adminClient
      .from('users')
      .update(updatePayload)
      .eq('id', data.userId);

    if (updateErr) throw updateErr;

    // If role changed for a member, sync tech coordinator flag
    if (existingUser.member_id && data.role) {
      if (data.role === 'tech_coordinator') {
        await adminClient.from('members').update({ is_tech_coord: true }).eq('id', existingUser.member_id);
      } else if ((existingUser.role as any) === 'tech_coordinator' && (data.role as any) !== 'tech_coordinator') {
        await adminClient.from('members').update({ is_tech_coord: false }).eq('id', existingUser.member_id);
      }
    }

    await logAudit(user.id, 'USER_ACCOUNT_UPDATE', 'users', data.userId, {
      login_id: data.loginId || existingUser.login_id,
      updated_fields: Object.keys(updatePayload),
      updated_by: user.fullName,
    });

    revalidatePath('/admin/users');
    revalidatePath('/admin/members');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update user account.' };
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

    revalidatePath('/admin/users');
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

    revalidatePath('/admin/users');
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
      .select('id, login_id, member_id')
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
      revalidatePath('/admin/users');
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

    // Reset member has_login if this user was linked to a member
    if (targetUser.member_id) {
      await adminClient
        .from('members')
        .update({ has_login: false, is_tech_coord: false, updated_at: new Date().toISOString() })
        .eq('id', targetUser.member_id);
    }

    await logAudit(user.id, 'USER_ACCOUNT_DELETE', 'users', userId, {
      login_id: targetUser.login_id,
      deleted_by: user.fullName,
    });

    revalidatePath('/admin/users');
    revalidatePath('/admin/members');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to delete user account.' };
  }
}

/**
 * Promote a member to Tech Coordinator for their team (Step 7).
 * Enforces exactly 1 Tech Coordinator per team. Captures mobile for login.
 */
export async function makeTechCoordinatorAction(memberId: number, mobile: string) {
  try {
    const user = await requireSuperOrSystemAdmin();
    const adminClient = createAdminClient();

    const { data: member, error: memberErr } = await adminClient
      .from('members')
      .select('id, full_name, group_id, phone_raw')
      .eq('id', memberId)
      .single();

    if (memberErr || !member) {
      return { success: false, error: 'Member not found.' };
    }

    const cleanMobile = mobile.trim();
    const loginDigits = cleanMobile.replace(/\D/g, '').slice(-10);
    if (!loginDigits || loginDigits.length < 10) {
      return { success: false, error: 'A valid 10-digit mobile number is required for login.' };
    }

    // 1. Unset tech coordinator from any existing member in this group
    await adminClient
      .from('members')
      .update({ is_tech_coord: false, has_login: false, updated_at: new Date().toISOString() })
      .eq('group_id', member.group_id)
      .eq('is_tech_coord', true);

    // Deactivate old tech coordinator user accounts for this group
    const { data: groupMembers } = await adminClient
      .from('members')
      .select('id')
      .eq('group_id', member.group_id)
      .neq('id', memberId);

    if (groupMembers && groupMembers.length > 0) {
      const otherMemberIds = groupMembers.map((m) => m.id);
      await adminClient
        .from('users')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .in('member_id', otherMemberIds)
        .eq('role', 'tech_coordinator');
    }

    // 2. Set this member as tech coordinator
    await adminClient
      .from('members')
      .update({
        is_tech_coord: true,
        has_login: true,
        phone_raw: cleanMobile,
        updated_at: new Date().toISOString(),
      })
      .eq('id', memberId);

    // 3. Upsert user login account
    const { data: existingUser } = await adminClient
      .from('users')
      .select('id')
      .eq('member_id', memberId)
      .maybeSingle();

    if (existingUser) {
      await adminClient
        .from('users')
        .update({
          login_id: loginDigits,
          role: 'tech_coordinator',
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingUser.id);
    } else {
      const passwordHash = await hashPassword('Welcome@2026');
      await adminClient.from('users').insert({
        login_id: loginDigits,
        password_hash: passwordHash,
        role: 'tech_coordinator',
        member_id: memberId,
        must_change_password: true,
        is_active: true,
      });
    }

    await logAudit(user.id, 'MAKE_TECH_COORDINATOR', 'members', String(memberId), {
      member_name: member.full_name,
      group_id: member.group_id,
      login_id: loginDigits,
      promoted_by: user.fullName,
    });

    revalidatePath('/admin/members');
    revalidatePath('/admin/users');
    revalidatePath('/sell');

    return { success: true };
  } catch (err: any) {
    console.error('Error making tech coordinator:', err);
    return { success: false, error: err.message || 'Failed to promote to Tech Coordinator.' };
  }
}

/**
 * Remove Tech Coordinator role from a member (Step 7).
 */
export async function removeTechCoordinatorAction(memberId: number) {
  try {
    const user = await requireSuperOrSystemAdmin();
    const adminClient = createAdminClient();

    const { data: member } = await adminClient
      .from('members')
      .select('id, full_name, group_id')
      .eq('id', memberId)
      .single();

    if (!member) {
      return { success: false, error: 'Member not found.' };
    }

    await adminClient
      .from('members')
      .update({
        is_tech_coord: false,
        has_login: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', memberId);

    // Deactivate linked user account
    await adminClient
      .from('users')
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('member_id', memberId)
      .eq('role', 'tech_coordinator');

    await logAudit(user.id, 'REMOVE_TECH_COORDINATOR', 'members', String(memberId), {
      member_name: member.full_name,
      group_id: member.group_id,
      removed_by: user.fullName,
    });

    revalidatePath('/admin/members');
    revalidatePath('/admin/users');
    revalidatePath('/sell');

    return { success: true };
  } catch (err: any) {
    console.error('Error removing tech coordinator:', err);
    return { success: false, error: err.message || 'Failed to remove Tech Coordinator role.' };
  }
}

/**
 * Add a new member to a team (Step 7).
 */
export async function addTeamMemberAction(groupId: number, fullName: string, phone: string) {
  try {
    const user = await requireSuperOrSystemAdmin();
    const adminClient = createAdminClient();

    if (!fullName.trim() || !phone.trim()) {
      return { success: false, error: 'Name and mobile number are required.' };
    }

    const { data: newMember, error: insErr } = await adminClient
      .from('members')
      .insert({
        group_id: groupId,
        full_name: fullName.trim(),
        phone_raw: phone.trim(),
        is_group_admin: false,
        is_tech_coord: false,
        has_login: false,
        is_active: true,
      })
      .select()
      .single();

    if (insErr) throw insErr;

    await logAudit(user.id, 'ADD_TEAM_MEMBER', 'members', String(newMember.id), {
      full_name: fullName.trim(),
      phone: phone.trim(),
      group_id: groupId,
      added_by: user.fullName,
    });

    revalidatePath('/admin/members');
    revalidatePath('/admin/users');
    revalidatePath('/sell');

    return { success: true, member: newMember };
  } catch (err: any) {
    console.error('Error adding team member:', err);
    return { success: false, error: err.message || 'Failed to add member.' };
  }
}

/**
 * Update member details (Name & Mobile).
 */
export async function updateMemberDetailsAction(memberId: number, fullName: string, phone: string) {
  try {
    const user = await requireSuperOrSystemAdmin();
    const adminClient = createAdminClient();

    if (!fullName.trim() || !phone.trim()) {
      return { success: false, error: 'Name and mobile number are required.' };
    }

    const cleanPhone = phone.trim();
    const cleanDigits = cleanPhone.replace(/\D/g, '').slice(-10);

    const { error: updErr } = await adminClient
      .from('members')
      .update({
        full_name: fullName.trim(),
        phone_raw: cleanPhone,
        updated_at: new Date().toISOString(),
      })
      .eq('id', memberId);

    if (updErr) throw updErr;

    // If user account linked, update login_id
    if (cleanDigits.length >= 10) {
      await adminClient
        .from('users')
        .update({
          login_id: cleanDigits,
          updated_at: new Date().toISOString(),
        })
        .eq('member_id', memberId);
    }

    await logAudit(user.id, 'UPDATE_MEMBER_DETAILS', 'members', String(memberId), {
      full_name: fullName.trim(),
      phone: cleanPhone,
      updated_by: user.fullName,
    });

    revalidatePath('/admin/members');
    revalidatePath('/admin/users');
    revalidatePath('/sell');

    return { success: true };
  } catch (err: any) {
    console.error('Error updating member details:', err);
    return { success: false, error: err.message || 'Failed to update member.' };
  }
}
