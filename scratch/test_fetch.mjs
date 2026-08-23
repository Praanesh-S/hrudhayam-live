import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(url, key);

export async function fetchAllSeats(supabaseClient, options = {}) {
  const selectFields = options.select || '*';
  
  const buildQuery = (from, to) => {
    let q = supabaseClient.from('seats').select(selectFields).range(from, to);
    if (options.ownerId) {
      q = q.eq('owner_id', options.ownerId);
    }
    q = q.order('section', { ascending: true })
         .order('row_label', { ascending: true })
         .order('seat_no', { ascending: true });
    return q;
  };

  const [batch1, batch2] = await Promise.all([
    buildQuery(0, 999),
    buildQuery(1000, 1999)
  ]);

  const data1 = batch1.data || [];
  const data2 = batch2.data || [];

  return [...data1, ...data2];
}

async function check() {
  const seats = await fetchAllSeats(supabase);
  console.log('fetchAllSeats returned total rows:', seats.length);
}

check().catch(console.error);
