'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAudit } from '@/lib/audit';
import { revalidatePath } from 'next/cache';

async function checkAdminAuth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const adminClient = createAdminClient();
  const { data: profile } = await adminClient
    .from('profiles')
    .select('id, role, is_active')
    .eq('id', user.id)
    .single();

  if (!profile || !profile.is_active || (profile.role !== 'super_admin' && profile.role !== 'system_admin')) {
    throw new Error('Permission denied: Only Super Admin or System Admin can configure bands and reserved pools');
  }

  return { user, profile, adminClient };
}

/**
 * Update a band's total capacity.
 */
export async function updateBandCapacity(bandId: string, totalCapacity: number) {
  try {
    const { user, profile, adminClient } = await checkAdminAuth();

    if (totalCapacity < 0) {
      return { success: false, error: 'Capacity cannot be negative' };
    }

    // 1. Check current sold count
    const { count: soldCount } = await adminClient
      .from('sales')
      .select('*', { count: 'exact', head: true })
      .eq('band_id', bandId)
      .eq('cancelled', false);

    const currentSold = soldCount || 0;
    if (totalCapacity < currentSold) {
      return { 
        success: false, 
        error: `Cannot set capacity to ${totalCapacity}. Already sold ${currentSold} seats in this band.` 
      };
    }

    // 2. Fetch previous band state for audit
    const { data: oldBand } = await adminClient
      .from('bands')
      .select('*')
      .eq('id', bandId)
      .single();

    // 3. Update band
    const { error: updateError } = await adminClient
      .from('bands')
      .update({ 
        total_capacity: totalCapacity,
        updated_at: new Date().toISOString()
      })
      .eq('id', bandId);

    if (updateError) throw updateError;

    // 4. Log audit
    await logAudit(
      user.id,
      'BAND_CAPACITY_SET',
      'band',
      bandId,
      {
        band_name: oldBand?.name,
        old_capacity: oldBand?.total_capacity,
        new_capacity: totalCapacity,
        updated_by: profile.role,
      }
    );

    revalidatePath('/setup');
    revalidatePath('/dashboard');
    revalidatePath('/sell');
    revalidatePath('/reports');

    return { success: true };
  } catch (err: any) {
    console.error('Error updating band capacity:', err);
    return { success: false, error: err.message || 'Failed to update band capacity' };
  }
}

/**
 * Update a band's standard price.
 */
export async function updateBandPrice(bandId: string, standardPrice: number) {
  try {
    const { user, profile, adminClient } = await checkAdminAuth();

    if (standardPrice <= 0) {
      return { success: false, error: 'Price must be greater than zero' };
    }

    const { data: oldBand } = await adminClient
      .from('bands')
      .select('*')
      .eq('id', bandId)
      .single();

    const { error: updateError } = await adminClient
      .from('bands')
      .update({ 
        standard_price: standardPrice,
        updated_at: new Date().toISOString()
      })
      .eq('id', bandId);

    if (updateError) throw updateError;

    await logAudit(
      user.id,
      'DISCOUNT_APPROVE',
      'band',
      bandId,
      {
        action_note: 'Global band price adjustment',
        band_name: oldBand?.name,
        old_price: oldBand?.standard_price,
        new_price: standardPrice,
        approved_by: profile.role,
      }
    );

    revalidatePath('/setup');
    revalidatePath('/dashboard');
    revalidatePath('/sell');
    revalidatePath('/reports');

    return { success: true };
  } catch (err: any) {
    console.error('Error updating band price:', err);
    return { success: false, error: err.message || 'Failed to update band price' };
  }
}

/**
 * Update reserved pool total count.
 */
export async function updateReservedPool(poolId: string, totalCount: number) {
  try {
    const { user, profile, adminClient } = await checkAdminAuth();

    if (totalCount < 0) {
      return { success: false, error: 'Count cannot be negative' };
    }

    const { data: oldPool } = await adminClient
      .from('reserved_pools')
      .select('*')
      .eq('id', poolId)
      .single();

    const { error } = await adminClient
      .from('reserved_pools')
      .update({ 
        total_count: totalCount,
        updated_at: new Date().toISOString()
      })
      .eq('id', poolId);

    if (error) throw error;

    await logAudit(
      user.id,
      'RESERVED_POOL_SET',
      'reserved_pool',
      poolId,
      {
        pool_category: oldPool?.category,
        pool_name: oldPool?.name,
        old_count: oldPool?.total_count,
        new_count: totalCount,
      }
    );

    revalidatePath('/setup');
    revalidatePath('/dashboard');
    revalidatePath('/reports');

    return { success: true };
  } catch (err: any) {
    console.error('Error updating reserved pool:', err);
    return { success: false, error: err.message || 'Failed to update reserved pool' };
  }
}

/**
 * Add or update a reserved guest name entry.
 */
export async function saveReservedEntry(poolId: string, entryId: string | null, name: string, notes: string | null = null) {
  try {
    const { user, adminClient } = await checkAdminAuth();

    if (!name || name.trim() === '') {
      return { success: false, error: 'Guest name is required' };
    }

    if (entryId) {
      const { error } = await adminClient
        .from('reserved_entries')
        .update({ name: name.trim(), notes: notes?.trim() || null })
        .eq('id', entryId);

      if (error) throw error;

      await logAudit(
        user.id,
        'RESERVED_NAME_FILL',
        'reserved_entry',
        entryId,
        { pool_id: poolId, name: name.trim(), notes }
      );
    } else {
      const { data, error } = await adminClient
        .from('reserved_entries')
        .insert({
          pool_id: poolId,
          name: name.trim(),
          notes: notes?.trim() || null,
        })
        .select('id')
        .single();

      if (error) throw error;

      await logAudit(
        user.id,
        'RESERVED_NAME_FILL',
        'reserved_entry',
        data.id,
        { pool_id: poolId, name: name.trim(), notes }
      );
    }

    revalidatePath('/setup');
    return { success: true };
  } catch (err: any) {
    console.error('Error saving reserved entry:', err);
    return { success: false, error: err.message || 'Failed to save reserved entry' };
  }
}

/**
 * Delete a reserved guest entry.
 */
export async function deleteReservedEntry(entryId: string) {
  try {
    const { adminClient } = await checkAdminAuth();
    const { error } = await adminClient
      .from('reserved_entries')
      .delete()
      .eq('id', entryId);

    if (error) throw error;

    revalidatePath('/setup');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to delete entry' };
  }
}
