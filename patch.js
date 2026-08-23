const fs = require('fs');
let content = fs.readFileSync('src/app/(dashboard)/setup/actions.ts', 'utf8');

content = content.replace(
  /export async function updateRowTier.*?revalidatePath\("\/", "layout"\); return \{ success: true \};\n\}/s,
  (match) => match.replace('revalidatePath("/", "layout"); return { success: true };', 'await logAudit(user.id, "update_row_tier", "row", rowId, { tier });\n  revalidatePath("/", "layout"); return { success: true };')
);

content = content.replace(
  /export async function updateRowObligation.*?revalidatePath\("\/", "layout"\); return \{ success: true \};\n\}/s,
  (match) => match.replace('revalidatePath("/", "layout"); return { success: true };', 'await logAudit(user.id, "update_row_obligation", "row", rowId, { obligation });\n  revalidatePath("/", "layout"); return { success: true };')
);

content = content.replace(
  /export async function updateRowSeatCount.*?revalidatePath\("\/", "layout"\); return \{ success: true \};\n\}/s,
  (match) => match.replace('revalidatePath("/", "layout"); return { success: true };', 'await logAudit(user.id, "update_seat_count", "row", rowId, { newCount });\n  revalidatePath("/", "layout"); return { success: true };')
);

content = content.replace(
  /export async function bulkSetTier.*?revalidatePath\("\/", "layout"\); return \{ success: true, count: unlockedRowIds.length \};\n\}/s,
  (match) => match.replace('revalidatePath("/", "layout"); return { success: true, count: unlockedRowIds.length };', 'await logAudit(user.id, "update_row_tier", "row", `Bulk ${section} ${fromRow}-${toRow}`, { tier, count: unlockedRowIds.length });\n  revalidatePath("/", "layout"); return { success: true, count: unlockedRowIds.length };')
);

content = content.replace(
  /export async function bulkSetObligation.*?revalidatePath\("\/", "layout"\); return \{ success: true, count: unlockedRowIds.length \};\n\}/s,
  (match) => match.replace('revalidatePath("/", "layout"); return { success: true, count: unlockedRowIds.length };', 'await logAudit(user.id, "update_row_obligation", "row", `Bulk ${section} ${fromRow}-${toRow}`, { obligation, count: unlockedRowIds.length });\n  revalidatePath("/", "layout"); return { success: true, count: unlockedRowIds.length };')
);

fs.writeFileSync('src/app/(dashboard)/setup/actions.ts', content);
