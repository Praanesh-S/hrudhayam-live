import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://hapacinfdltsalunxocl.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhhcGFjaW5mZGx0c2FsdW54b2NsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzQxNzM1MiwiZXhwIjoyMTAyOTkzMzUyfQ.I2FVayKiP-TsW7mN872lvbB69eWlC9e9WQP-AV19tpU';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const groundFloorRows = [
  { row_label: 'Special A', seat_count: 34, display_order: 1, provisional: false, category: 'b5000', price: 5000 },
  { row_label: 'B', seat_count: 40, display_order: 2, provisional: false, category: 'b5000', price: 5000 },
  { row_label: 'C', seat_count: 42, display_order: 3, provisional: false, category: 'b5000', price: 5000 },
  { row_label: 'D', seat_count: 43, display_order: 4, provisional: false, category: 'obligation', price: 0 },
  { row_label: 'E', seat_count: 46, display_order: 5, provisional: false, category: 'b3500', price: 3500 },
  { row_label: 'F', seat_count: 46, display_order: 6, provisional: false, category: 'b3500', price: 3500 },
  { row_label: 'G', seat_count: 47, display_order: 7, provisional: false, category: 'pp', price: 1000 },
  { row_label: 'H', seat_count: 50, display_order: 8, provisional: false, category: 'sponsor_comp', price: 0 },
  { row_label: 'I', seat_count: 53, display_order: 9, provisional: false, category: 'b2500', price: 2500 },
  { row_label: 'J', seat_count: 54, display_order: 10, provisional: false, category: 'b2500', price: 2500 },
  { row_label: 'K', seat_count: 56, display_order: 11, provisional: false, category: 'b2500', price: 2500 },
  { row_label: 'L', seat_count: 57, display_order: 12, provisional: false, category: 'b1500', price: 1500 },
  { row_label: 'M', seat_count: 40, display_order: 13, provisional: false, category: 'b1500', price: 1500 },
  { row_label: 'N', seat_count: 40, display_order: 14, provisional: false, category: 'b1500', price: 1500 },
  { row_label: 'SPL VIP', seat_count: 50, display_order: 15, provisional: false, category: 'vip', price: 0, is_vip: true },
];

const balconyRows = [
  { row_label: 'A', seat_count: 50, display_order: 1, provisional: false, category: 'b3500', price: 3500 },
  { row_label: 'B', seat_count: 50, display_order: 2, provisional: false, category: 'b3500', price: 3500 },
  { row_label: 'C', seat_count: 50, display_order: 3, provisional: false, category: 'b3500', price: 3500 },
  { row_label: 'D', seat_count: 42, display_order: 4, provisional: false, category: 'b3500', price: 3500 },
  { row_label: 'E', seat_count: 42, display_order: 5, provisional: false, category: 'b2500', price: 2500 },
  { row_label: 'F', seat_count: 46, display_order: 6, provisional: false, category: 'b2500', price: 2500 },
  { row_label: 'G', seat_count: 46, display_order: 7, provisional: false, category: 'b2500', price: 2500 },
  { row_label: 'H', seat_count: 50, display_order: 8, provisional: false, category: 'b1500', price: 1500 },
  { row_label: 'I', seat_count: 57, display_order: 9, provisional: true, category: 'b1500', price: 1500 },
  { row_label: 'J', seat_count: 57, display_order: 10, provisional: true, category: 'b1500', price: 1500 },
  { row_label: 'K', seat_count: 57, display_order: 11, provisional: true, category: 'b1500', price: 1500 },
  { row_label: 'L', seat_count: 58, display_order: 12, provisional: true, category: 'b1500', price: 1500 },
  { row_label: 'M', seat_count: 57, display_order: 13, provisional: true, category: 'b1500', price: 1500 },
  { row_label: 'N', seat_count: 44, display_order: 14, provisional: false, category: 'b1500', price: 1500 },
  { row_label: 'O', seat_count: 44, display_order: 15, provisional: false, category: 'b1500', price: 1500 },
];

async function seed() {
  console.log('Seeding rows and seats for Hrudhayam LIVE...');

  // 1. Delete old rows and seats
  console.log('Clearing old seats and rows...');
  const { error: seatDelErr } = await supabase.from('seats').delete().neq('id', 'dummy');
  if (seatDelErr) console.error('Error clearing seats:', seatDelErr);

  const { error: rowDelErr } = await supabase.from('rows').delete().neq('row_label', 'dummy');
  if (rowDelErr) console.error('Error clearing rows:', rowDelErr);

  // 2. Insert rows and seats
  let totalSeats = 0;
  let totalRegularSeats = 0;
  let totalVIPSeats = 0;

  const rowsToInsert = [];
  const seatsToInsert = [];

  for (const r of groundFloorRows) {
    const rowId = crypto.randomUUID();
    rowsToInsert.push({
      id: rowId,
      section: 'Ground Floor',
      row_label: r.row_label,
      seat_count: r.seat_count,
      tier: r.price,
      lock_status: 'Unlocked',
      display_order: r.display_order,
      is_placeholder: r.provisional,
    });

    const isVip = r.row_label === 'SPL VIP';
    for (let s = 1; s <= r.seat_count; s++) {
      const seatId = `GF-${r.row_label}-${String(s).padStart(2, '0')}`;
      seatsToInsert.push({
        id: seatId,
        section: 'Ground Floor',
        row_label: r.row_label,
        seat_no: s,
        row_id: rowId,
        tier: r.price,
        category: r.category,
        price: r.price,
        counts_to_raise: ['b5000', 'b3500', 'b2500', 'b1500', 'pp'].includes(r.category),
        obligation_type: isVip ? 'vip' : (r.category === 'obligation' ? 'police' : null),
        provisional: r.provisional,
        payment_status: 'pending',
        checked_in: false,
        is_blocked: r.category === 'blocked',
        sold: false,
      });
      totalSeats++;
      if (isVip) totalVIPSeats++;
      else totalRegularSeats++;
    }
  }

  for (const r of balconyRows) {
    const rowId = crypto.randomUUID();
    rowsToInsert.push({
      id: rowId,
      section: 'Balcony',
      row_label: r.row_label,
      seat_count: r.seat_count,
      tier: r.price,
      lock_status: 'Unlocked',
      display_order: r.display_order,
      is_placeholder: r.provisional,
    });

    for (let s = 1; s <= r.seat_count; s++) {
      const seatId = `BAL-${r.row_label}-${String(s).padStart(2, '0')}`;
      seatsToInsert.push({
        id: seatId,
        section: 'Balcony',
        row_label: r.row_label,
        seat_no: s,
        row_id: rowId,
        tier: r.price,
        category: r.category,
        price: r.price,
        counts_to_raise: ['b5000', 'b3500', 'b2500', 'b1500', 'pp'].includes(r.category),
        obligation_type: null,
        provisional: r.provisional,
        payment_status: 'pending',
        checked_in: false,
        is_blocked: r.category === 'blocked',
        sold: false,
      });
      totalSeats++;
      totalRegularSeats++;
    }
  }

  console.log(`Inserting ${rowsToInsert.length} rows...`);
  const { error: rErr } = await supabase.from('rows').insert(rowsToInsert);
  if (rErr) throw rErr;

  console.log(`Inserting ${seatsToInsert.length} seats in batches...`);
  const batchSize = 200;
  for (let i = 0; i < seatsToInsert.length; i += batchSize) {
    const batch = seatsToInsert.slice(i, i + batchSize);
    const { error: sErr } = await supabase.from('seats').insert(batch);
    if (sErr) throw sErr;
    console.log(`  Inserted batch ${i + 1} to ${Math.min(i + batchSize, seatsToInsert.length)}`);
  }

  // 3. Compute quotas and sync bands table
  const categoryCounts = {
    b5000: 0,
    b3500: 0,
    b2500: 0,
    b1500: 0,
    pp: 0,
  };

  for (const s of seatsToInsert) {
    if (categoryCounts[s.category] !== undefined) {
      categoryCounts[s.category]++;
    }
  }

  console.log('Category Quotas:', categoryCounts);

  await supabase.from('bands').update({ total_allocated: categoryCounts.b5000, total_capacity: categoryCounts.b5000 }).eq('id', 'band_5000');
  await supabase.from('bands').update({ total_allocated: categoryCounts.b3500, total_capacity: categoryCounts.b3500 }).eq('id', 'band_3500');
  await supabase.from('bands').update({ total_allocated: categoryCounts.b2500, total_capacity: categoryCounts.b2500 }).eq('id', 'band_2500');
  await supabase.from('bands').update({ total_allocated: categoryCounts.b1500, total_capacity: categoryCounts.b1500 }).eq('id', 'band_1500');
  await supabase.from('bands').update({ total_allocated: categoryCounts.pp, total_capacity: categoryCounts.pp }).eq('id', 'band_pp');

  console.log(`Done! Total seats: ${totalSeats} (Regular: ${totalRegularSeats}, VIP: ${totalVIPSeats})`);
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
