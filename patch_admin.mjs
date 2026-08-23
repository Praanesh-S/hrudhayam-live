import fs from 'fs';

let content = fs.readFileSync('src/app/(dashboard)/admin/actions.ts', 'utf8');

if (!content.includes('logAudit')) {
  content = content.replace(
    "import { createClient } from '@/lib/supabase/server';",
    "import { createClient } from '@/lib/supabase/server';\nimport { logAudit } from '@/lib/audit';"
  );
}

content = content.replace(
  '  revalidatePath("/", "layout"); return { success: true };\n}',
  '  await logAudit(user.id, "update_user", "user", userId, { active });\n  revalidatePath("/", "layout"); return { success: true };\n}'
);

content = content.replace(
  /export async function updateUserRole.*?revalidatePath\("\/", "layout"\); return \{ success: true \};\n\}/s,
  (match) => match.replace('revalidatePath("/", "layout"); return { success: true };', 'await logAudit(user.id, "update_user", "user", userId, { role });\n  revalidatePath("/", "layout"); return { success: true };')
);

content = content.replace(
  /export async function toggleDoorDuty.*?revalidatePath\("\/", "layout"\); return \{ success: true \};\n\}/s,
  (match) => match.replace('revalidatePath("/", "layout"); return { success: true };', 'await logAudit(user.id, "update_user", "user", userId, { door_duty: doorDuty });\n  revalidatePath("/", "layout"); return { success: true };')
);

content = content.replace(
  /export async function deleteUser.*?revalidatePath\("\/", "layout"\); return \{ success: true \};\n\}/s,
  (match) => match.replace('revalidatePath("/", "layout"); return { success: true };', 'await logAudit(user.id, "update_user", "user", userId, { action: "delete" });\n  revalidatePath("/", "layout"); return { success: true };')
);

fs.writeFileSync('src/app/(dashboard)/admin/actions.ts', content);
