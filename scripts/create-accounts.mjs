import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DEFAULT_TEMP_PASSWORD = process.env.INITIAL_ADMIN_PASSWORD || 'Welcome@2026';

async function main() {
  console.log('🔐 Setting up initial Hrudhayam LIVE v2 user accounts...');
  console.log('Temporary initial password will require change on first login.');

  const passwordHash = await bcrypt.hash(DEFAULT_TEMP_PASSWORD, 12);

  // 1. Fetch 8 Group Coordinators
  const { data: coordinators, error: coordError } = await supabase
    .from('members')
    .select('id, full_name, phone_raw, phone_e164, group_id')
    .eq('is_group_admin', true)
    .order('group_id', { ascending: true });

  if (coordError || !coordinators || coordinators.length === 0) {
    console.error('Could not fetch coordinators from members table:', coordError);
    process.exit(1);
  }

  console.log(`Found ${coordinators.length} group coordinators.`);

  // Create accounts for 8 Group Admins
  for (const c of coordinators) {
    // Normalise login ID: 10-digit phone number or e164
    const loginId = c.phone_e164 ? c.phone_e164.replace(/\D/g, '').slice(-10) : c.phone_raw.replace(/\D/g, '').slice(-10);

    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('login_id', loginId)
      .maybeSingle();

    if (existingUser) {
      console.log(`- Group Admin (${c.full_name}): Account already exists for login_id ${loginId}`);
      continue;
    }

    const { error: insertError } = await supabase.from('users').insert({
      member_id: c.id,
      role: 'group_admin',
      login_id: loginId,
      password_hash: passwordHash,
      must_change_password: true,
      is_active: true,
    });

    if (insertError) {
      console.error(`Failed to create user for ${c.full_name} (${loginId}):`, insertError.message);
    } else {
      console.log(`✓ Group Admin created: ${c.full_name} -> Login ID: ${loginId} (Team ${c.group_id})`);
    }
  }

  // 2. System Admins: Praanesh & Krithiga
  const systemAdmins = [
    { login_id: 'praanesh', name: 'Praanesh (System Admin)' },
    { login_id: 'krithiga', name: 'Krithiga (System Admin)' },
  ];

  for (const sa of systemAdmins) {
    const { data: existingSA } = await supabase
      .from('users')
      .select('id')
      .eq('login_id', sa.login_id)
      .maybeSingle();

    if (!existingSA) {
      const { error: saErr } = await supabase.from('users').insert({
        role: 'system_admin',
        login_id: sa.login_id,
        password_hash: passwordHash,
        must_change_password: true,
        is_active: true,
      });

      if (saErr) {
        console.error(`Failed to create System Admin ${sa.name}:`, saErr.message);
      } else {
        console.log(`✓ System Admin created: ${sa.name} -> Login ID: ${sa.login_id}`);
      }
    } else {
      console.log(`- System Admin already exists for login_id ${sa.login_id}`);
    }
  }

  // 3. Super Admin
  const superAdminLogin = process.env.SUPER_ADMIN_LOGIN || 'superadmin';
  const { data: existingSuper } = await supabase
    .from('users')
    .select('id')
    .eq('login_id', superAdminLogin)
    .maybeSingle();

  if (!existingSuper) {
    const { error: superErr } = await supabase.from('users').insert({
      role: 'super_admin',
      login_id: superAdminLogin,
      password_hash: passwordHash,
      must_change_password: true,
      is_active: true,
    });

    if (superErr) {
      console.error(`Failed to create Super Admin:`, superErr.message);
    } else {
      console.log(`✓ Super Admin created -> Login ID: ${superAdminLogin}`);
    }
  } else {
    console.log(`- Super Admin already exists for login_id ${superAdminLogin}`);
  }

  console.log('\n🎉 Account provisioning complete!');
  console.log('All provisioned accounts have must_change_password = true.');
}

main().catch(console.error);
