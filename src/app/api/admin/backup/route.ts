import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    // 1. Authenticate: Super Admin, System Admin, or CRON_SECRET header
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    const isCronAuthorized = cronSecret && authHeader === `Bearer ${cronSecret}`;

    let authorizedUser = null;
    if (!isCronAuthorized) {
      const user = await getSessionUser();
      if (!user || (user.role !== 'super_admin' && user.role !== 'system_admin')) {
        return NextResponse.json({ error: 'Unauthorized. Admin access required.' }, { status: 401 });
      }
      authorizedUser = user;
    }

    const adminClient = createAdminClient();

    // 2. Fetch all critical tables in parallel
    const [
      bandsRes,
      rowsRes,
      seatsRes,
      passesRes,
      paymentsRes,
      sponsorsRes,
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
      adminClient.from('members').select('*').order('created_at', { ascending: false }),
      adminClient.from('groups').select('*').order('name', { ascending: true }),
      adminClient.from('protected_blocks').select('*').order('created_at', { ascending: false }),
      adminClient.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(1000),
    ]);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupData = {
      meta: {
        exported_at: new Date().toISOString(),
        exported_by: authorizedUser ? (authorizedUser.fullName || authorizedUser.loginId || authorizedUser.id) : 'cron_job',
        app_version: '1.0.0',
        venue: 'The Music Academy, Madras',
        total_regular_capacity: 1398,
        vip_box_capacity: 50,
      },
      counts: {
        bands: bandsRes.data?.length || 0,
        rows: rowsRes.data?.length || 0,
        seats: seatsRes.data?.length || 0,
        passes: passesRes.data?.length || 0,
        payments: paymentsRes.data?.length || 0,
        sponsors: sponsorsRes.data?.length || 0,
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
        members: membersRes.data || [],
        groups: groupsRes.data || [],
        protected_blocks: protectedBlocksRes.data || [],
        audit_logs: auditLogsRes.data || [],
      },
    };

    // Return as downloadable JSON
    return new Response(JSON.stringify(backupData, null, 2), {
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
