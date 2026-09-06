export const dynamic = 'force-dynamic';

import { getSessionUser } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { AdminPassesClient } from './passes-client';

export const metadata = {
  title: 'Pass Operations (System Admin) | Hrudhayam LIVE',
};

export default async function AdminPassesPage() {
  const user = await getSessionUser();
  // Rule R3: Strict System Admin or Super Admin access
  if (!user || (user.role !== 'system_admin' && user.role !== 'super_admin')) {
    redirect('/dashboard');
  }

  const adminClient = createAdminClient();

  // Fetch bands for move dropdown
  const { data: bands } = await adminClient
    .from('bands')
    .select('id, label, price, total_allocated, sort_order')
    .order('sort_order');

  // Fetch recent passes
  const { data: recentPasses } = await adminClient
    .from('passes')
    .select(`
      *,
      band:bands(id, label, price),
      seller:members(id, full_name, groups(name)),
      payments(id, mode, amount, reference_no, status)
    `)
    .order('created_at', { ascending: false })
    .limit(50);

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto pb-16">
      <div>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
          System Admin Pass Operations
        </h1>
        <p className="text-slate-400 text-sm sm:text-base mt-1">
          Rule R3 Technical Authority: Cancel already-issued passes and reassign passes across price bands with full audit traceability.
        </p>
      </div>

      <AdminPassesClient
        initialPasses={recentPasses || []}
        bands={bands || []}
        currentUser={user}
      />
    </div>
  );
}
