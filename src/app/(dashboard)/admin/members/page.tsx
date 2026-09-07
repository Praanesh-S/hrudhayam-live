export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';

export default function MembersRedirectPage() {
  redirect('/admin/users');
}
