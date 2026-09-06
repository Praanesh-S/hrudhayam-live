export const dynamic = 'force-dynamic';
import { redirect } from 'next/navigation';

export default function SetupRedirectPage() {
  redirect('/admin/bands');
}
