'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/auth/guards';
import { queueEmail, getQueueStats } from '@/lib/email';
import { logAudit } from '@/lib/audit';

export interface TargetRecipient {
  email: string;
  name?: string;
  seatId?: string;
}

export async function sendCustomMassEmail(
  subject: string, 
  body: string, 
  recipients: TargetRecipient[], 
  userId: string
) {
  if (!subject || !body) {
    throw new Error('Subject and body are required');
  }

  if (!recipients || recipients.length === 0) {
    throw new Error('No recipients provided');
  }

  // Deduplicate emails
  const uniqueMap = new Map<string, TargetRecipient>();
  for (const r of recipients) {
    const clean = r.email.trim().toLowerCase();
    if (clean && !uniqueMap.has(clean)) {
      uniqueMap.set(clean, { ...r, email: clean });
    }
  }

  const uniqueRecipients = Array.from(uniqueMap.values());
  let queued = 0;

  for (const r of uniqueRecipients) {
    await queueEmail({
      to: r.email,
      subject,
      htmlBody: body,
      seatId: r.seatId || undefined,
      emailType: 'mass',
      createdBy: userId,
    });
    queued++;
  }

  await logAudit(userId, 'MASS_EMAIL_BROADCAST', 'user', userId, {
    action: 'mass_email_broadcast',
    subject,
    recipientCount: queued
  });

  const estimatedDays = Math.ceil(queued / 100);
  return { queued, estimatedDays };
}

export async function getQueueStatus() {
  return await getQueueStats();
}

/**
 * Log WhatsApp broadcast / click-to-send campaign to DB campaigns table (Step 8).
 */
export async function logWhatsAppCampaign(data: {
  templateId?: string | null;
  body: string;
  audienceType: string;
  audienceFilter?: string | null;
  recipientCount: number;
  method: 'broadcast_list' | 'click_to_send';
}) {
  try {
    const user = await requireUser();
    const adminClient = createAdminClient();

    const { data: campaign, error } = await adminClient
      .from('campaigns')
      .insert({
        template_id: data.templateId || null,
        adhoc_body: data.body,
        audience_type: data.audienceType,
        audience_filter: data.audienceFilter || null,
        recipient_count: data.recipientCount,
        method: data.method,
        sent_by: user.fullName || user.loginId,
        sent_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to log campaign:', error);
      return { success: false, error: error.message };
    }

    await logAudit(user.id, 'WHATSAPP_CAMPAIGN_LOGGED', 'campaigns', campaign.id, {
      audience_type: data.audienceType,
      recipient_count: data.recipientCount,
      method: data.method,
      sent_by: user.fullName,
    });

    return { success: true, campaign };
  } catch (err: any) {
    console.error('Error in logWhatsAppCampaign:', err);
    return { success: false, error: err.message };
  }
}
