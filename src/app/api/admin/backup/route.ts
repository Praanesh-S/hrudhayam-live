import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    const isCronAuthorized = Boolean(cronSecret && authHeader === `Bearer ${cronSecret}`);
    const isVercelCron = request.headers.get('x-vercel-cron') === '1';
    const isCronParam = url.searchParams.get('cron') === 'true';
    const isSaveOnly = url.searchParams.get('save') === 'true';
    const action = url.searchParams.get('action');

    let authorizedUser = null;
    if (!isCronAuthorized && !isVercelCron) {
      const user = await getSessionUser();
      if (!user || (user.role !== 'super_admin' && user.role !== 'system_admin')) {
        return NextResponse.json({ error: 'Unauthorized. Admin access required.' }, { status: 401 });
      }
      authorizedUser = user;
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

    // Action: List archived backups in storage
    if (action === 'list') {
      const { data: files, error: listErr } = await adminClient.storage
        .from('backups')
        .list('', { sortBy: { column: 'created_at', order: 'desc' }, limit: 100 });

      if (listErr) throw listErr;

      const backups = await Promise.all(
        (files || [])
          .filter((f) => f.name.endsWith('.json'))
          .map(async (f) => {
            const { data: signed } = await adminClient.storage
              .from('backups')
              .createSignedUrl(f.name, 3600); // 1-hour signed download URL
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

      return NextResponse.json({ success: true, backups });
    }

    // 2. Fetch all critical tables in parallel (including participating_clubs)
    const [
      bandsRes,
      rowsRes,
      seatsRes,
      passesRes,
      paymentsRes,
      sponsorsRes,
      clubsRes,
      membersRes,
      groupsRes,
      protectedBlocksRes,
      auditLogsRes,
    ] = await Promise.all([
      adminClient.from('bands').select('*').order('price', { ascending: false }),
      adminClient.from('rows').select('*').order('display_order', { ascending: true }),
      adminClient.from('seats').select('*').order('seat_number', { ascending: true }),
      adminClient.from('passes').select('*').order('created_at', { ascending: false }),
      adminClient.from('payments').select('*').order('created_at', { ascending: false }),
      adminClient.from('sponsors').select('*').order('created_at', { ascending: false }),
      adminClient.from('participating_clubs').select('*').order('created_at', { ascending: false }),
      adminClient.from('members').select('*').order('created_at', { ascending: false }),
      adminClient.from('groups').select('*').order('name', { ascending: true }),
      adminClient.from('protected_blocks').select('*').order('created_at', { ascending: false }),
      adminClient.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(2000),
    ]);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupData = {
      meta: {
        exported_at: new Date().toISOString(),
        exported_by: authorizedUser ? (authorizedUser.fullName || authorizedUser.loginId || authorizedUser.id) : (isVercelCron ? 'vercel_cron' : 'cron_job'),
        app_version: '2.0.0',
        venue: 'The Music Academy, Madras',
        total_regular_capacity: 1448,
        ground_floor_capacity: 698,
        balcony_capacity: 750,
      },
      counts: {
        bands: bandsRes.data?.length || 0,
        rows: rowsRes.data?.length || 0,
        seats: seatsRes.data?.length || 0,
        passes: passesRes.data?.length || 0,
        payments: paymentsRes.data?.length || 0,
        sponsors: sponsorsRes.data?.length || 0,
        participating_clubs: clubsRes.data?.length || 0,
        members: membersRes.data?.length || 0,
        groups: groupsRes.data?.length || 0,
        protected_blocks: protectedBlocksRes.data?.length || 0,
        audit_logs: auditLogsRes.data?.length || 0,
      },
      data: {
        bands: bandsRes.data || [],
        rows: rowsRes.data || [],
        seats: seatsRes.data || [],
        passes: passesRes.data || [],
        payments: paymentsRes.data || [],
        sponsors: sponsorsRes.data || [],
        participating_clubs: clubsRes.data || [],
        members: membersRes.data || [],
        groups: groupsRes.data || [],
        protected_blocks: protectedBlocksRes.data || [],
        audit_logs: auditLogsRes.data || [],
      },
    };

    const jsonString = JSON.stringify(backupData, null, 2);
    const isAutomated = isCronAuthorized || isVercelCron || isCronParam;
    const filename = isAutomated
      ? `hrudhayam_auto_backup_${timestamp}.json`
      : `hrudhayam_manual_backup_${timestamp}.json`;

    // 3. Always archive a snapshot copy to Supabase Storage
    try {
      await adminClient.storage
        .from('backups')
        .upload(filename, jsonString, {
          contentType: 'application/json',
          upsert: true,
        });

      // Prune old automated backups if more than 60 exist
      const { data: allFiles } = await adminClient.storage.from('backups').list('', {
        sortBy: { column: 'created_at', order: 'desc' },
        limit: 100,
      });
      if (allFiles && allFiles.length > 60) {
        const filesToRemove = allFiles.slice(60).map((f) => f.name);
        await adminClient.storage.from('backups').remove(filesToRemove);
      }
    } catch (storageErr) {
      console.error('Warning: Failed to save copy to Supabase Storage:', storageErr);
    }

    // 4. Return JSON response for Cron / Save-only requests
    if (isAutomated || isSaveOnly) {
      return NextResponse.json({
        success: true,
        message: 'Database backup snapshot successfully generated and archived to Supabase Storage.',
        file: filename,
        storage_bucket: 'backups',
        exported_at: backupData.meta.exported_at,
        counts: backupData.counts,
        size_bytes: Buffer.byteLength(jsonString, 'utf8'),
      });
    }

    // 5. Return as downloadable JSON for direct browser downloads
    return new Response(jsonString, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="hrudhayam_database_backup_${timestamp}.json"`,
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error: any) {
    console.error('Database backup error:', error);
    return NextResponse.json({ error: error.message || 'Backup failed.' }, { status: 500 });
  }
}
