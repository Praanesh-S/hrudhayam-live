export const dynamic = 'force-dynamic';

import { requireUser } from '@/lib/auth/guards';
import { createAdminClient } from '@/lib/supabase/admin';
import { WhatsAppHubClient } from './email-client';

export const metadata = {
  title: 'WhatsApp Communications Hub | Hrudhayam LIVE',
};

export default async function EmailPage() {
  const user = await requireUser();
  const adminClient = createAdminClient();

  const isSuperAdmin = user.role === 'super_admin' || user.role === 'system_admin';

  // 1. Fetch message templates
  const { data: templates } = await adminClient
    .from('message_templates')
    .select('*')
    .order('created_at', { ascending: true });

  // 2. Fetch all members with group
  const { data: members } = await adminClient
    .from('members')
    .select('id, full_name, phone_raw, phone_e164, group_id, groups(id, name)')
    .eq('is_active', true)
    .order('group_id')
    .order('full_name');

  // 3. Fetch groups
  const { data: groups } = await adminClient
    .from('groups')
    .select('*')
    .order('id', { ascending: true });

  // 4. Fetch bands
  const { data: bands } = await adminClient
    .from('bands')
    .select('*')
    .order('sort_order', { ascending: true });

  // 5. Fetch all passes with donor details
  let passesQuery = adminClient
    .from('passes')
    .select(`
      id,
      pass_code,
      physical_serial,
      serial_no,
      donor_name,
      donor_phone,
      donor_email,
      band_id,
      row_label,
      created_at,
      bands (
        id,
        label,
        price
      ),
      seller:members (
        id,
        full_name,
        group_id,
        groups (
          id,
          name
        )
      )
    `)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false });

  if (!isSuperAdmin && user.groupId) {
    passesQuery = passesQuery.eq('seller.group_id', user.groupId);
  }

  const { data: passes } = await passesQuery;

  // 6. Fetch recent logged campaigns
  const { data: recentCampaigns } = await adminClient
    .from('campaigns')
    .select('*')
    .order('sent_at', { ascending: false })
    .limit(10);

  return (
    <div className="max-w-6xl mx-auto pb-16 space-y-6">
      <WhatsAppHubClient
        templates={templates || []}
        members={members || []}
        groups={groups || []}
        bands={bands || []}
        passes={passes || []}
        recentCampaigns={recentCampaigns || []}
        currentUser={user}
        isSuperAdmin={isSuperAdmin}
      />
    </div>
  );
}
