import { SupabaseClient } from '@supabase/supabase-js';
import { Band } from './types';
import crypto from 'crypto';

/**
 * Fetch all bands with live aggregated metrics derived from passes, payments, and soft holds.
 * Rule R5: Oversell block accounts for both sold passes and active soft holds.
 */
export async function fetchBandsWithMetrics(supabase: SupabaseClient): Promise<Band[]> {
  // 1. Fetch bands
  const { data: bandsData, error: bandsError } = await supabase
    .from('bands')
    .select('*')
    .order('sort_order', { ascending: true });

  if (bandsError || !bandsData) {
    console.error('Error fetching bands:', bandsError);
    return [];
  }

  // 2. Fetch active passes
  const { data: passesData, error: passesError } = await supabase
    .from('passes')
    .select(`
      id,
      band_id,
      status,
      payments (
        amount,
        status
      )
    `)
    .neq('status', 'cancelled');

  if (passesError) {
    console.error('Error fetching passes for metrics:', passesError);
  }

  // 3. Fetch active soft holds
  const nowIso = new Date().toISOString();
  const { data: holdsData, error: holdsError } = await supabase
    .from('soft_holds')
    .select('band_id, count')
    .eq('status', 'active')
    .gt('expires_at', nowIso);

  if (holdsError) {
    console.error('Error fetching soft holds for metrics:', holdsError);
  }

  const activePasses = passesData || [];
  const activeHolds = holdsData || [];

  // Group passes by band_id
  const passesByBand = new Map<string, typeof activePasses>();
  for (const p of activePasses) {
    const list = passesByBand.get(p.band_id) || [];
    list.push(p);
    passesByBand.set(p.band_id, list);
  }

  // Group holds by band_id
  const holdsByBand = new Map<string, number>();
  for (const h of activeHolds) {
    const current = holdsByBand.get(h.band_id) || 0;
    holdsByBand.set(h.band_id, current + (h.count || 0));
  }

  return bandsData.map((b) => {
    const bandPasses = passesByBand.get(b.id) || [];
    const soldCount = bandPasses.length;
    const holdsCount = holdsByBand.get(b.id) || 0;
    const totalAllocated = b.total_allocated ?? 0;
    const remainingCount = Math.max(0, totalAllocated - soldCount - holdsCount);

    let collectedAmount = 0;
    let pendingAmount = 0;

    for (const p of bandPasses) {
      const paymentList = (p as any).payments;
      if (Array.isArray(paymentList) && paymentList.length > 0) {
        for (const pay of paymentList) {
          if (pay.status === 'received') {
            collectedAmount += pay.amount || 0;
          } else {
            pendingAmount += pay.amount || 0;
          }
        }
      } else {
        // Fallback to band price if payment record not joined
        collectedAmount += b.price;
      }
    }

    return {
      ...b,
      sold_count: soldCount,
      active_holds_count: holdsCount,
      remaining_count: remainingCount,
      collected_amount: collectedAmount,
      pending_amount: pendingAmount,
    };
  });
}

/**
 * Generate a cryptographically unguessable pass code (e.g. HL-7K3X9A).
 */
export async function generateUniquePassCode(supabase: SupabaseClient): Promise<string> {
  let isUnique = false;
  let code = '';
  let attempts = 0;

  while (!isUnique && attempts < 20) {
    attempts++;
    // 6-character random alphanumeric string
    const randomHex = crypto.randomBytes(3).toString('hex').toUpperCase();
    code = `HL-${randomHex}`;

    const { data } = await supabase
      .from('passes')
      .select('id')
      .eq('pass_code', code)
      .maybeSingle();

    if (!data) {
      isUnique = true;
    }
  }

  if (!isUnique) {
    code = `HL-${Date.now().toString().slice(-6)}`;
  }

  return code;
}

/**
 * Fetch high-level event summary metrics for the Fill/Goal Dashboard.
 * Rule R7: Participating clubs are ring-fenced and excluded from competition/revenue calculations.
 */
export async function fetchEventSummaryMetrics(supabase: SupabaseClient) {
  const [bands, passesRes, sponsorsRes, protectedRes, settingsRes] = await Promise.all([
    fetchBandsWithMetrics(supabase),
    supabase
      .from('passes')
      .select('id, status, source, payments(amount, status)')
      .neq('status', 'cancelled'),
    supabase
      .from('sponsors')
      .select('id, amount, status'),
    supabase
      .from('protected_blocks')
      .select('id, seat_count'),
    supabase
      .from('app_settings_v2')
      .select('key, value')
      .in('key', ['aed_station_cost', 'aed_target_stations']),
  ]);

  const allPasses = passesRes.data || [];
  // Exclude participating club passes from normal sales metrics per §11
  const normalPasses = allPasses.filter(p => p.source !== 'participating_club');

  const totalCapacity = bands.reduce((sum, b) => sum + (b.total_allocated || 0), 0);
  const totalSold = normalPasses.length;
  const totalRemaining = bands.reduce((sum, b) => sum + (b.remaining_count || 0), 0);
  const totalCheckedIn = allPasses.filter(p => p.status === 'used').length;

  let totalPassesCollected = 0;
  let totalPassesPending = 0;

  for (const p of normalPasses) {
    const payList = (p as any).payments;
    if (Array.isArray(payList)) {
      for (const pay of payList) {
        if (pay.status === 'received') {
          totalPassesCollected += pay.amount || 0;
        } else {
          totalPassesPending += pay.amount || 0;
        }
      }
    }
  }

  // Sponsor amounts
  const sponsors = sponsorsRes.data || [];
  const sponsorsReceived = sponsors.filter(s => s.status === 'received').reduce((sum, s) => sum + s.amount, 0);
  const sponsorsCommitted = sponsors.filter(s => s.status === 'committed').reduce((sum, s) => sum + s.amount, 0);

  const totalCollected = totalPassesCollected + sponsorsReceived;
  const totalPending = totalPassesPending + sponsorsCommitted;
  const totalRaised = totalCollected;

  const totalProtectedSeats = (protectedRes.data || []).reduce((sum, pb) => sum + (pb.seat_count || 0), 0);

  // Settings for AED stations
  const settingsMap = new Map((settingsRes.data || []).map(s => [s.key, s.value]));
  const stationCost = Number(settingsMap.get('aed_station_cost')) || 150000;
  const targetStations = Number(settingsMap.get('aed_target_stations')) || 25;
  const fundedStations = Math.floor(totalRaised / stationCost);
  const partialStationPercent = Math.min(100, Math.round(((totalRaised % stationCost) / stationCost) * 100));

  return {
    bands,
    totalCapacity,
    totalSold,
    totalRemaining,
    totalCheckedIn,
    totalPassesCollected,
    totalPassesPending,
    sponsorsReceived,
    sponsorsCommitted,
    totalCollected,
    totalPending,
    totalRaised,
    totalProtectedSeats,
    stationCost,
    targetStations,
    fundedStations,
    partialStationPercent,
  };
}
