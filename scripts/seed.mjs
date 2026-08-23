import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function main() {
  console.log("🌱 Generating Sample Users...");

  const users = [
    { email: 'super1@test.com', full_name: 'Alice (Super)', role: 'super_admin' },
    { email: 'super2@test.com', full_name: 'Bob (Super)', role: 'super_admin' },
    ...Array.from({ length: 7 }).map((_, i) => ({
      email: `sub${i+1}@test.com`, 
      full_name: `Team Member ${i+1}`, 
      role: 'sub_admin'
    }))
  ];

  let subAdminIds = [];

  for (const u of users) {
    const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
      email: u.email,
      password: 'password123',
      email_confirm: true
    });

    if (authErr) {
      console.error(`Failed to create ${u.email}: ${authErr.message}`);
      continue;
    }

    const userId = authData.user.id;

    await supabase.from('profiles').upsert({
      id: userId,
      email: u.email,
      full_name: u.full_name,
      role: u.role,
      is_active: true
    });

    if (u.role === 'sub_admin') {
      subAdminIds.push(userId);
    }

    console.log(`Created ${u.email} (password123)`);
  }

  // Allocate some rows to Sub-Admins
  console.log("🎟️ Allocating rows to Sub-Admins...");
  const { data: rows } = await supabase.from('rows').select('id, section').limit(14);
  
  if (rows && rows.length >= 14 && subAdminIds.length >= 7) {
    for (let i = 0; i < 7; i++) {
      const subId = subAdminIds[i];
      const assignedRows = rows.slice(i * 2, (i * 2) + 2).map(r => r.id);
      
      await supabase.from('seats').update({ owner_id: subId }).in('row_id', assignedRows);
      await supabase.from('rows').update({ lock_status: 'Locked' }).in('id', assignedRows);
    }
    console.log("Rows randomly allocated.");
  }

  console.log("✅ Seed Complete! You can sign in with any email above and 'password123'");
}

main().catch(console.error);
