import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function main() {
  console.log("🗑️ Clearing all users, requests, guests, and audit logs...");

  // Delete all audit logs
  await supabase.from('audit_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  // Delete all access requests
  await supabase.from('access_requests').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  // Reset all seats to blank
  await supabase.from('seats').update({
    owner_id: null,
    guest_name: null,
    guest_email: null,
    guest_phone: null,
    pass_code: null,
    qr_token: null,
    ticket_sent: false,
    ticket_sent_at: null,
    payment_status: 'pending',
    checked_in: false,
    checked_in_at: null,
    obligation: null
  }).neq('id', 'BLANK');

  // Unlock all rows and reset obligations
  await supabase.from('rows').update({
    lock_status: 'Unlocked',
    obligation: null
  }).neq('id', 'BLANK');

  // Delete all user profiles (this cascades if set up, but let's delete them)
  const { data: profiles } = await supabase.from('profiles').select('id');
  if (profiles) {
    for (const p of profiles) {
      await supabase.auth.admin.deleteUser(p.id);
    }
  }
  
  await supabase.from('profiles').delete().neq('id', 'BLANK');

  console.log("✅ Database wiped clean! Only structural rows & seats remain.");
}

main().catch(console.error);
