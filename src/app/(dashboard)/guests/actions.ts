'use server';
import { revalidatePath } from "next/cache";

import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { generatePassCode, signQrToken } from '@/lib/tokens';
import { logAudit } from '@/lib/audit';

const updateSchema = z.object({
  guest_name: z.string().max(100).optional().or(z.literal('')),
  guest_email: z.string().email().optional().or(z.literal('')),
  guest_phone: z.string().regex(/^\d{10}$/).optional().or(z.literal('')),
});

export async function updateGuest(seatId: string, data: any) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  const isAdmin = profile?.role === 'super_admin';

  // Validate ownership
  if (!isAdmin) {
    const { data: seat } = await supabase.from('seats').select('owner_id').eq('id', seatId).single();
    if (seat?.owner_id !== user.id) throw new Error('Forbidden');
  }

  const parsed = updateSchema.parse(data);
  const updates: any = { ...parsed };

  // If clearing name, reset state
  if (updates.guest_name === '') {
    updates.ticket_sent = false;
    updates.payment_status = 'pending';
    updates.guest_email = null;
    updates.guest_phone = null;
    updates.guest_name = null;
  } else {
    // Generate pass code if first assignment
    const { data: seat } = await supabase.from('seats').select('pass_code, guest_name').eq('id', seatId).single();
    if (!seat?.pass_code && updates.guest_name && updates.guest_name !== '') {
      try {
        const { data: nextVal } = await supabase.rpc('increment_pass_code_counter');
        const count = nextVal || Math.floor(Math.random() * 10000);
        updates.pass_code = `HRU${String(count).padStart(4, '0')}`;
        updates.qr_token = await signQrToken(updates.pass_code);
      } catch (e) {
        updates.pass_code = `HRU${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`;
        updates.qr_token = await signQrToken(updates.pass_code);
      }
    }
    
    // convert empty strings to null
    if (updates.guest_email === '') updates.guest_email = null;
    if (updates.guest_phone === '') updates.guest_phone = null;
  }

  const { data: updatedSeat, error } = await supabase
    .from('seats')
    .update(updates)
    .eq('id', seatId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  await logAudit(user.id, "update_guest", "seat", seatId, updates);
  revalidatePath("/", "layout"); return updatedSeat;
}

export async function togglePayment(seatId: string, status: 'pending' | 'received') {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  const isAdmin = profile?.role === 'super_admin';

  if (!isAdmin) {
    const { data: seat } = await supabase.from('seats').select('owner_id').eq('id', seatId).single();
    if (seat?.owner_id !== user.id) throw new Error('Forbidden');
  }

  const { data: updatedSeat, error } = await supabase
    .from('seats')
    .update({ payment_status: status })
    .eq('id', seatId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  await logAudit(user.id, "toggle_payment", "seat", seatId, { status });
  revalidatePath("/", "layout"); return updatedSeat;
}

export async function sendTicket(seatId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  const isAdmin = profile?.role === 'super_admin';

  if (!isAdmin) {
    const { data: seat } = await supabase.from('seats').select('owner_id').eq('id', seatId).single();
    if (seat?.owner_id !== user.id) throw new Error('Forbidden');
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const res = await fetch(`${baseUrl}/api/tickets/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `sb-access-token=${user.id}` // simplified auth mock for internal fetch
    },
    body: JSON.stringify({ seatId })
  });

  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Failed to send ticket');
  }

  await logAudit(user.id, "send_ticket", "seat", seatId, {});
  revalidatePath("/", "layout"); return true;
}

export async function updateGuestGroup(seatIds: string[], data: any) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  const isAdmin = profile?.role === 'super_admin';

  if (!isAdmin) {
    const { data: seats } = await supabase.from('seats').select('owner_id').in('id', seatIds);
    if (seats?.some(s => s.owner_id !== user.id)) throw new Error('Forbidden');
  }

  const parsed = updateSchema.parse(data);
  const updates: any = { ...parsed };

  if (updates.guest_name === '') {
    updates.ticket_sent = false;
    updates.payment_status = 'pending';
    updates.guest_email = null;
    updates.guest_phone = null;
    updates.guest_name = null;
    updates.pass_code = null;
    updates.qr_token = null;
  } else {
    let passCode = '';
    try {
      const { data: nextVal } = await supabase.rpc('increment_pass_code_counter');
      const count = nextVal || Math.floor(Math.random() * 10000);
      passCode = `HRU${String(count).padStart(4, '0')}`;
    } catch (e) {
      passCode = `HRU${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`;
    }
    updates.pass_code = passCode;
    updates.qr_token = await signQrToken(passCode);

    if (updates.guest_email === '') updates.guest_email = null;
    if (updates.guest_phone === '') updates.guest_phone = null;
  }

  const { error } = await supabase.from('seats').update(updates).in('id', seatIds);
  if (error) throw new Error(error.message);

  await logAudit(user.id, "update_guest", "seat", "group", { seatIds, updates });
  revalidatePath("/", "layout");
  return true;
}
