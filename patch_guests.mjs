import fs from 'fs';

let content = fs.readFileSync('src/app/(dashboard)/guests/actions.ts', 'utf8');

// Add logAudit import
if (!content.includes('logAudit')) {
  content = content.replace(
    "import { generatePassCode, signQrToken } from '@/lib/tokens';",
    "import { generatePassCode, signQrToken } from '@/lib/tokens';\nimport { logAudit } from '@/lib/audit';"
  );
}

// Inject updateGuestGroup
const groupAction = `
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
      passCode = \`HRU\${String(count).padStart(4, '0')}\`;
    } catch (e) {
      passCode = \`HRU\${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}\`;
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
`;

if (!content.includes('updateGuestGroup')) {
  content += groupAction;
}

// Add audit logs to existing actions
content = content.replace(
  '  revalidatePath("/", "layout"); return updatedSeat;\n}',
  '  await logAudit(user.id, "update_guest", "seat", seatId, updates);\n  revalidatePath("/", "layout"); return updatedSeat;\n}'
);

content = content.replace(
  '  revalidatePath("/", "layout"); return updatedSeat;\n}\n\nexport async function sendTicket',
  '  await logAudit(user.id, "toggle_payment", "seat", seatId, { status });\n  revalidatePath("/", "layout"); return updatedSeat;\n}\n\nexport async function sendTicket'
);

content = content.replace(
  '  revalidatePath("/", "layout"); return true;\n}',
  '  await logAudit(user.id, "send_ticket", "seat", seatId, {});\n  revalidatePath("/", "layout"); return true;\n}'
);

fs.writeFileSync('src/app/(dashboard)/guests/actions.ts', content);
