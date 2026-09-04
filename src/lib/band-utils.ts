import { SupabaseClient } from '@supabase/supabase-js';
import { Band, ReservedPool, Sale } from './types';
import { BANDS_CONFIG } from './constants';

/**
 * Fetch all bands with live aggregated sales metrics.
 */
export async function fetchBandsWithMetrics(supabase: SupabaseClient): Promise<Band[]> {
  // 1. Fetch all bands
  const { data: bandsData, error: bandsError } = await supabase
    .from('bands')
    .select('*')
    .order('display_order', { ascending: true });

  if (bandsError || !bandsData) {
    console.error('Error fetching bands:', bandsError);
    return [];
  }

  // 2. Fetch all active (non-cancelled) sales
  const { data: salesData, error: salesError } = await supabase
    .from('sales')
    .select('id, band_id, payment_status, standard_price, collected_amount, discount_amount, cancelled')
    .eq('cancelled', false);

  if (salesError) {
    console.error('Error fetching sales for band metrics:', salesError);
  }

  const activeSales = salesData || [];

  // Group sales by band_id
  const salesByBand = new Map<string, typeof activeSales>();
  for (const sale of activeSales) {
    const list = salesByBand.get(sale.band_id) || [];
    list.push(sale);
    salesByBand.set(sale.band_id, list);
  }

  return bandsData.map((b) => {
    const bandSales = salesByBand.get(b.id) || [];
    const soldCount = bandSales.length;
    const remainingCount = Math.max(0, b.total_capacity - soldCount);

    let collectedAmount = 0;
    let pendingAmount = 0;
    let discountAmount = 0;

    for (const s of bandSales) {
      discountAmount += s.discount_amount || 0;
      if (s.payment_status === 'paid') {
        collectedAmount += s.collected_amount || (s.standard_price - (s.discount_amount || 0));
      } else {
        pendingAmount += (s.standard_price - (s.discount_amount || 0));
      }
    }

    return {
      ...b,
      sold_count: soldCount,
      remaining_count: remainingCount,
      collected_amount: collectedAmount,
      pending_amount: pendingAmount,
      discount_amount: discountAmount,
    };
  });
}

/**
 * Generate a guaranteed unique pass code.
 */
export async function generateUniquePassCode(supabase: SupabaseClient): Promise<string> {
  let isUnique = false;
  let code = '';
  let attempts = 0;

  while (!isUnique && attempts < 20) {
    attempts++;
    // Generate random 4-digit number between 1000 and 9999
    const num = Math.floor(1000 + Math.random() * 9000);
    code = `HL-${num}`;

    const { data } = await supabase
      .from('sales')
      .select('id')
      .eq('pass_code', code)
      .maybeSingle();

    if (!data) {
      isUnique = true;
    }
  }

  if (!isUnique) {
    code = `HL-${Date.now().toString().slice(-4)}`;
  }

  return code;
}

/**
 * Fetch high-level event summary statistics.
 */
export async function fetchEventSummaryMetrics(supabase: SupabaseClient) {
  const [bands, salesRes, poolsRes] = await Promise.all([
    fetchBandsWithMetrics(supabase),
    supabase
      .from('sales')
      .select('id, payment_status, collected_amount, standard_price, discount_amount, checked_in, cancelled')
      .eq('cancelled', false),
    supabase
      .from('reserved_pools')
      .select('id, total_count'),
  ]);

  const activeSales = salesRes.data || [];
  const pools = poolsRes.data || [];

  const totalCapacity = bands.reduce((sum, b) => sum + b.total_capacity, 0);
  const totalSold = activeSales.length;
  const totalRemaining = Math.max(0, totalCapacity - totalSold);
  const totalCheckedIn = activeSales.filter(s => s.checked_in).length;

  let totalCollected = 0;
  let totalPending = 0;
  let totalDiscounts = 0;

  for (const s of activeSales) {
    totalDiscounts += s.discount_amount || 0;
    if (s.payment_status === 'paid') {
      totalCollected += s.collected_amount || (s.standard_price - (s.discount_amount || 0));
    } else {
      totalPending += (s.standard_price - (s.discount_amount || 0));
    }
  }

  const potentialRevenue = totalCollected + totalPending;
  const totalReservedSeats = pools.reduce((sum, p) => sum + (p.total_count || 0), 0);

  return {
    totalCapacity,
    totalSold,
    totalRemaining,
    totalCheckedIn,
    totalCollected,
    totalPending,
    totalDiscounts,
    potentialRevenue,
    totalReservedSeats,
    bands,
  };
}
