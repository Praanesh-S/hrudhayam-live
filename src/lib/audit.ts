import { createAdminClient } from '@/lib/supabase/admin';
import type { AuditAction } from '@/lib/types';

/**
 * Centralized audit logging utility.
 * Writes immutable audit log entries to public.audit_logs via admin client.
 */
export async function logAudit(
  userId: string | null,
  action: AuditAction,
  entityType: string,
  entityId: string | null = null,
  details: Record<string, unknown> | null = null
) {
  try {
    const adminClient = createAdminClient();
    const { error } = await adminClient.from('audit_logs').insert({
      user_id: userId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      details: details ?? {},
    });

    if (error) {
      console.error('[AUDIT_LOG_ERROR]', error);
    }
  } catch (err) {
    console.error('[AUDIT_LOG_EXCEPTION]', err);
  }
}
