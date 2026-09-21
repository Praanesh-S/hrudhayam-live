export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { BackupClient } from './backup-client';
import { StoredBackupItem } from '../actions';

export const metadata = {
  title: 'Database Backups | Hrudhayam LIVE',
};

export default async function AdminBackupPage() {
  const user = await getSessionUser();

  if (!user || (user.role !== 'super_admin' && user.role !== 'system_admin')) {
    redirect('/dashboard');
  }

  const adminClient = createAdminClient();

  // Ensure backups bucket exists
  const { data: buckets } = await adminClient.storage.listBuckets();
  if (!buckets?.some((b) => b.id === 'backups')) {
    await adminClient.storage.createBucket('backups', {
      public: false,
      fileSizeLimit: 20971520, // 20MB
    });
  }

  // Fetch initial backups list
  const { data: files } = await adminClient.storage
    .from('backups')
    .list('', { sortBy: { column: 'created_at', order: 'desc' }, limit: 100 });

  const initialBackups: StoredBackupItem[] = await Promise.all(
    (files || [])
      .filter((f) => f.name.endsWith('.json'))
      .map(async (f) => {
        const { data: signed } = await adminClient.storage
          .from('backups')
          .createSignedUrl(f.name, 3600);

        return {
          name: f.name,
          size: f.metadata?.size || 0,
          created_at: f.created_at,
          updated_at: f.updated_at,
          download_url: signed?.signedUrl || null,
          is_auto: f.name.includes('_auto_'),
        };
      })
  );

  return (
    <BackupClient
      initialBackups={initialBackups}
      currentUser={user}
    />
  );
}
