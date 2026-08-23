'use server';

import { createClient } from '@/lib/supabase/server';
import { queueEmail, getQueueStats } from '@/lib/email';

type EmailFilters = {
  section: string;
  tier: string;
  paymentStatus: string;
  ticketSent: string;
  ownerId?: string;
};

export async function getRecipientCount(filters: EmailFilters, isSuperAdmin: boolean, userId: string) {
  const supabase = await createClient();
  
  let query = supabase
    .from('seats')
    .select('id', { count: 'exact', head: true })
    .not('guest_email', 'is', null)
    .not('guest_email', 'eq', '');

  if (!isSuperAdmin) {
    query = query.eq('owner_id', userId);
  } else if (filters.ownerId && filters.ownerId !== 'All') {
    query = query.eq('owner_id', filters.ownerId);
  }

  if (filters.section !== 'All') query = query.eq('section', filters.section);
  if (filters.tier !== 'All') query = query.eq('tier', parseInt(filters.tier));
  if (filters.paymentStatus !== 'All') query = query.eq('payment_status', filters.paymentStatus);
  if (filters.ticketSent !== 'All') {
    query = query.eq('ticket_sent', filters.ticketSent === 'Yes');
  }

  const { count, error } = await query;
  if (error) {
    console.error('Count error:', error);
    return 0;
  }
  return count || 0;
}

export async function sendMassEmail(subject: string, body: string, filters: EmailFilters, isSuperAdmin: boolean, userId: string) {
  const supabase = await createClient();
  
  let query = supabase
    .from('seats')
    .select('id, guest_email, guest_name, owner_id')
    .not('guest_email', 'is', null)
    .not('guest_email', 'eq', '');

  if (!isSuperAdmin) {
    query = query.eq('owner_id', userId);
  } else if (filters.ownerId && filters.ownerId !== 'All') {
    query = query.eq('owner_id', filters.ownerId);
  }

  if (filters.section !== 'All') query = query.eq('section', filters.section);
  if (filters.tier !== 'All') query = query.eq('tier', parseInt(filters.tier));
  if (filters.paymentStatus !== 'All') query = query.eq('payment_status', filters.paymentStatus);
  if (filters.ticketSent !== 'All') {
    query = query.eq('ticket_sent', filters.ticketSent === 'Yes');
  }

  const { data: seats, error } = await query;
  
  if (error || !seats || seats.length === 0) {
    return { queued: 0 };
  }

  // Queue emails
  let queued = 0;
  for (const seat of seats) {
    if (seat.guest_email) {
      await queueEmail({
        to: seat.guest_email,
        subject,
        htmlBody: body,
        seatId: seat.id,
        emailType: 'mass',
        createdBy: userId,
      });
      queued++;
    }
  }

  // Assuming 100 per day limit
  const days = Math.ceil(queued / 100);
  
  return { queued, estimatedDays: days };
}

export async function getQueueStatus() {
  return await getQueueStats();
}
