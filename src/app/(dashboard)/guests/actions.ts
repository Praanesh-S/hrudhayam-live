'use server';

import { revalidatePath } from "next/cache";
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { z } from 'zod';
import { generatePassCode, signQrToken } from '@/lib/tokens';
import { logAudit } from '@/lib/audit';

const guestSchema = z.object({
  guest_name: z.string().min(1, "Guest name is required").max(100),
  guest_email: z.string().email().optional().or(z.literal('')),
  guest_phone: z.string().regex(/^\d{10}$/, "10-digit mobile number required").optional().or(z.literal('')),
  payment_status: z.enum(['pending', 'received']).default('pending'),
});

export interface IssuePassParams {
  seatIds: string[];
  guest_name: string;
  guest_email?: string;
  guest_phone?: string;
  payment_status: 'pending' | 'received';
  send_email?: boolean;
}

export async function issuePass(params: IssuePassParams) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const adminClient = createAdminClient();
  const { data: profile } = await adminClient.from('profiles').select('role, full_name').eq('id', user.id).single();
  const isSuperAdmin = profile?.role === 'super_admin';

  if (!params.seatIds || params.seatIds.length === 0) {
    throw new Error('No seats selected');
  }

  if (!params.guest_name || params.guest_name.trim() === '') {
    throw new Error('Guest name is required');
  }

  // Validate seat permissions
  const { data: seats, error: seatsErr } = await adminClient
    .from('seats')
    .select('id, owner_id, guest_name, row_label, seat_no, section')
    .in('id', params.seatIds);

  if (seatsErr || !seats || seats.length !== params.seatIds.length) {
    throw new Error('Some selected seats could not be found');
  }

  // If sub-admin, ensure all seats belong to them
  if (!isSuperAdmin) {
    const unauthorizedSeats = seats.filter(s => s.owner_id !== user.id);
    if (unauthorizedSeats.length > 0) {
      throw new Error('You do not have permission to assign passes for some of the selected seats.');
    }
  }

  // Generate unique pass code
  let passCode = '';
  try {
    const { data: nextVal } = await adminClient.rpc('increment_pass_code_counter');
    const count = nextVal || Math.floor(1000 + Math.random() * 9000);
    passCode = `HRU${String(count).padStart(4, '0')}`;
  } catch (e) {
    passCode = `HRU${String(Math.floor(1000 + Math.random() * 9000)).padStart(4, '0')}`;
  }

  const qrToken = await signQrToken(passCode);

  const updates = {
    guest_name: params.guest_name.trim(),
    guest_email: params.guest_email && params.guest_email.trim() !== '' ? params.guest_email.trim() : null,
    guest_phone: params.guest_phone && params.guest_phone.trim() !== '' ? params.guest_phone.trim() : null,
    payment_status: params.payment_status || 'pending',
    pass_code: passCode,
    qr_token: qrToken,
    ticket_sent: false,
    ticket_sent_at: null,
    checked_in: false,
    checked_in_at: null,
  };

  const { error: updateError } = await adminClient
    .from('seats')
    .update(updates)
    .in('id', params.seatIds);

  if (updateError) throw new Error(updateError.message);

  await logAudit(user.id, "ALLOT", "seat", passCode, {
    pass_code: passCode,
    seatIds: params.seatIds,
    seatCount: params.seatIds.length,
    guest_name: params.guest_name,
    payment_status: params.payment_status
  });

  // Automatically trigger email if requested and email provided
  if (params.send_email && updates.guest_email) {
    try {
      await sendTicket(params.seatIds[0]);
    } catch (e) {
      console.error("Auto email failed on pass issuance:", e);
    }
  }

  revalidatePath("/", "layout");
  return { success: true, passCode, count: params.seatIds.length };
}

export async function revokePass(passCodeOrSeatId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const adminClient = createAdminClient();
  const { data: profile } = await adminClient.from('profiles').select('role').eq('id', user.id).single();
  const isSuperAdmin = profile?.role === 'super_admin';

  // Find seats by pass_code or id
  const { data: seats } = await adminClient
    .from('seats')
    .select('id, owner_id, pass_code')
    .or(`pass_code.eq.${passCodeOrSeatId},id.eq.${passCodeOrSeatId}`);

  if (!seats || seats.length === 0) {
    throw new Error('Pass not found');
  }

  if (!isSuperAdmin) {
    const unauthorized = seats.some(s => s.owner_id !== user.id);
    if (unauthorized) throw new Error('You do not have permission to revoke this pass');
  }

  const seatIds = seats.map(s => s.id);
  const passCode = seats[0].pass_code || passCodeOrSeatId;

  const { error } = await adminClient
    .from('seats')
    .update({
      guest_name: null,
      guest_email: null,
      guest_phone: null,
      pass_code: null,
      qr_token: null,
      ticket_sent: false,
      ticket_sent_at: null,
      payment_status: 'pending',
      checked_in: false,
      checked_in_at: null
    })
    .in('id', seatIds);

  if (error) throw new Error(error.message);

  await logAudit(user.id, "PASS_REVOKE", "seat", passCode, { seatIds });
  revalidatePath("/", "layout");
  return { success: true, count: seatIds.length };
}

export async function updateGuest(seatId: string, data: any) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const adminClient = createAdminClient();
  const { data: profile } = await adminClient.from('profiles').select('role').eq('id', user.id).single();
  const isSuperAdmin = profile?.role === 'super_admin';

  const { data: seat } = await adminClient.from('seats').select('*').eq('id', seatId).single();
  if (!seat) throw new Error('Seat not found');

  if (!isSuperAdmin && seat.owner_id !== user.id) {
    throw new Error('Forbidden');
  }

  const updates: any = {};
  if (data.guest_name !== undefined) updates.guest_name = data.guest_name ? data.guest_name.trim() : null;
  if (data.guest_email !== undefined) updates.guest_email = data.guest_email && data.guest_email.trim() !== '' ? data.guest_email.trim() : null;
  if (data.guest_phone !== undefined) updates.guest_phone = data.guest_phone && data.guest_phone.trim() !== '' ? data.guest_phone.trim() : null;

  // If this seat has a pass_code (group or single), update all seats sharing this pass_code
  let targetQuery = adminClient.from('seats').update(updates);
  if (seat.pass_code) {
    targetQuery = targetQuery.eq('pass_code', seat.pass_code);
  } else {
    targetQuery = targetQuery.eq('id', seatId);
  }

  const { error } = await targetQuery;
  if (error) throw new Error(error.message);

  await logAudit(user.id, "GUEST_EDIT", "seat", seat.pass_code || seatId, updates);
  revalidatePath("/", "layout");
  return true;
}

export async function togglePayment(seatIdOrPassCode: string, status: 'pending' | 'received') {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const adminClient = createAdminClient();
  const { data: profile } = await adminClient.from('profiles').select('role').eq('id', user.id).single();
  const isSuperAdmin = profile?.role === 'super_admin';

  const { data: seats } = await adminClient
    .from('seats')
    .select('id, owner_id, pass_code')
    .or(`pass_code.eq.${seatIdOrPassCode},id.eq.${seatIdOrPassCode}`);

  if (!seats || seats.length === 0) throw new Error('Seat not found');

  if (!isSuperAdmin) {
    const unauthorized = seats.some(s => s.owner_id !== user.id);
    if (unauthorized) throw new Error('Forbidden');
  }

  const seatIds = seats.map(s => s.id);
  const { error } = await adminClient
    .from('seats')
    .update({ payment_status: status })
    .in('id', seatIds);

  if (error) throw new Error(error.message);

  await logAudit(user.id, "PAYMENT_STATUS_CHANGE", "seat", seatIdOrPassCode, { status, seatIds });
  revalidatePath("/", "layout");
  return { success: true };
}

export async function sendTicket(seatId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const adminClient = createAdminClient();
  const { data: profile } = await adminClient.from('profiles').select('role').eq('id', user.id).single();
  const isSuperAdmin = profile?.role === 'super_admin';

  const { data: seat } = await adminClient.from('seats').select('*').eq('id', seatId).single();
  if (!seat) throw new Error('Seat not found');

  if (!isSuperAdmin && seat.owner_id !== user.id) {
    throw new Error('Forbidden');
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const res = await fetch(`${baseUrl}/api/tickets/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `sb-access-token=${user.id}`
    },
    body: JSON.stringify({ seatId })
  });

  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Failed to send ticket');
  }

  await logAudit(user.id, "PASS_SENT", "seat", seatId, {});
  revalidatePath("/", "layout");
  return true;
}

export async function updateGuestGroup(seatIds: string[], data: any) {
  return issuePass({
    seatIds,
    guest_name: data.guest_name,
    guest_email: data.guest_email,
    guest_phone: data.guest_phone,
    payment_status: data.payment_status || 'pending',
  });
}
