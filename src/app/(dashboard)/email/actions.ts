'use server';

import { createClient } from '@/lib/supabase/server';
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
