import { createAdminClient } from '@/lib/supabase/admin';

export interface AuditParams {
  actorUserId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  beforeJson?: Record<string, unknown> | null;
  afterJson?: Record<string, unknown> | null;
}

/**
 * Centralized audit logging utility.
 * Writes immutable audit log entries to public.audit_log per §4 & §15.
 */
export async function logAudit(
  actorUserId: string | null,
  action: string,
  entity: string,
  entityId: string | null = null,
  afterJsonOrDetails: Record<string, unknown> | null = null,
  beforeJson: Record<string, unknown> | null = null
) {
  try {
    const adminClient = createAdminClient();
    const { error } = await adminClient.from('audit_log').insert({
      actor_user_id: actorUserId,
      action,
      entity,
      entity_id: entityId,
      before_json: beforeJson ?? null,
      after_json: afterJsonOrDetails ?? null,
    });

    if (error) {
      console.error('[AUDIT_LOG_ERROR]', error);
    }
  } catch (err) {
    console.error('[AUDIT_LOG_EXCEPTION]', err);
  }
}
