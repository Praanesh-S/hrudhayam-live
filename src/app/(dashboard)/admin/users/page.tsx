export const dynamic = 'force-dynamic';
import { redirect } from 'next/navigation';

export default function UsersRedirectPage() {
  redirect('/admin/members');
}
