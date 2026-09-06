export const dynamic = 'force-dynamic';

import { getSessionUser } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { PaymentsClient } from './payments-client';

export const metadata = {
  title: 'Payments & Collections | Hrudhayam LIVE',
};

export default async function PaymentsPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');

  const adminClient = createAdminClient();

  // Fetch payments with linked pass, sponsor, and club
  const { data: paymentsData } = await adminClient
    .from('payments')
    .select(`
      *,
      pass:passes(
        id,
        pass_code,
        donor_name,
        donor_phone,
        status,
        band:bands(label)
      ),
      sponsor:sponsors(
        id,
        sponsor_name,
        contact_name,
        contact_phone,
        tier,
        status
      ),
      club:participating_clubs(
        id,
        club_name,
        contact_name,
        contact_phone
      )
    `)
    .order('created_at', { ascending: false });

  // Fetch UPI VPA from settings
  const { data: upiSetting } = await adminClient
    .from('app_settings_v2')
    .select('value')
    .eq('key', 'trust_upi_vpa')
    .maybeSingle();

  const upiVpa = upiSetting?.value || 'hrudhayamlive@indianbank';

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto pb-16">
      <div>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
          Structured Payments & Reminders
        </h1>
        <p className="text-slate-400 text-sm sm:text-base mt-1">
          Track received and pending collections, confirm UTR references, and send instant WhatsApp reminders with Trust bank UPI details (§12, §19.5).
        </p>
      </div>

      <PaymentsClient
        payments={paymentsData || []}
        upiVpa={String(upiVpa).replace(/"/g, '')}
        currentUser={user}
      />
    </div>
  );
}
