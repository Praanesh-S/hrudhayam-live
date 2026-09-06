export const dynamic = 'force-dynamic';

import { getSessionUser } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { CheckinClient } from './checkin-client';

export const metadata = {
  title: 'Gate Check-in | Hrudhayam LIVE',
};

export default async function CheckinPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');

  return (
    <div className="flex flex-col gap-6 max-w-xl mx-auto pb-16">
      <div>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
          Gate Scanner & Check-in
        </h1>
        <p className="text-slate-400 text-sm sm:text-base mt-1">
          Scan donor WhatsApp QR codes or enter pass codes / physical ticket serials for admission.
        </p>
      </div>

      <CheckinClient
        currentUser={user}
        isSuperOrSystemAdmin={user.role === 'super_admin' || user.role === 'system_admin'}
      />
    </div>
  );
}
