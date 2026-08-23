import { createAdminClient } from './supabase/admin';

export type AuditAction = 
  | 'allocate_rows' 
  | 'release_rows' 
  | 'update_row_tier'
  | 'update_row_obligation'
  | 'update_seat_count'
  | 'update_guest'
  | 'issue_pass'
  | 'revoke_pass'
  | 'toggle_payment'
  | 'send_ticket'
  | 'check_in'
  | 'approve_user'
  | 'reject_user'
  | 'invite_user'
  | 'update_user'
  | 'update_access_request';

export type EntityType = 'row' | 'seat' | 'user' | 'request' | 'access_request';

export async function logAudit(
  userId: string,
  action: AuditAction,
  entityType: EntityType,
  entityId: string,
  details: Record<string, any> = {}
) {
  try {
    const adminClient = createAdminClient();
    const { error } = await adminClient
      .from('audit_logs')
      .insert({
        user_id: userId,
        action,
        entity_type: entityType,
        entity_id: entityId,
        details,
      });

    if (error) {
      console.error('Audit log failed:', error);
    }
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}
