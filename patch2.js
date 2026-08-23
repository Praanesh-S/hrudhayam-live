const fs = require('fs');
let content = fs.readFileSync('src/app/(dashboard)/allocate/actions.ts', 'utf8');

// Ensure logAudit is imported
if (!content.includes('logAudit')) {
  content = content.replace('import { createAdminClient } from "@/lib/supabase/admin";', 'import { createAdminClient } from "@/lib/supabase/admin";\nimport { logAudit } from "@/lib/audit";');
}

content = content.replace(
  /export async function allocateRows.*?revalidatePath\("\/", "layout"\); return \{ success: true, allocated: seatsToUpdate\?\.length \|\| 0 \};\n\}/s,
  (match) => match.replace('revalidatePath("/", "layout"); return { success: true, allocated: seatsToUpdate?.length || 0 };', 'await logAudit(user.id, "allocate_rows", "user", userId, { section, rows: rowsToAllocate, allocatedCount: seatsToUpdate?.length || 0 });\n  revalidatePath("/", "layout"); return { success: true, allocated: seatsToUpdate?.length || 0 };')
);

content = content.replace(
  /export async function releaseSeats.*?revalidatePath\("\/", "layout"\); return \{ success: true \};\n\}/s,
  (match) => match.replace('revalidatePath("/", "layout"); return { success: true };', 'await logAudit(user.id, "release_rows", "user", userId, { rows: rowLabels, force });\n  revalidatePath("/", "layout"); return { success: true };')
);

fs.writeFileSync('src/app/(dashboard)/allocate/actions.ts', content);
