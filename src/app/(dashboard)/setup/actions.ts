"use server";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { generateSeatId } from "@/lib/seat-utils";
import type { ObligationType, TierValue, VenueRow, SeatSection } from "@/lib/types";

export async function updateRowTier(rowId: string, tier: TierValue | null) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const adminClient = createAdminClient();

  const { data: profile } = await adminClient.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "super_admin") return { error: "Forbidden" };

  const { data: row } = await adminClient.from("rows").select("*").eq("id", rowId).maybeSingle();
  if (!row) return { error: "Row not found" };
  if (row.lock_status === "Locked") return { error: "Row is locked" };

  // Update row
  const { error: rowError } = await adminClient.from("rows").update({ tier, obligation: null }).eq("id", rowId);
  if (rowError) return { error: rowError.message };

  // Update all unallocated seats in that row
  const { error: seatsError } = await adminClient
    .from("seats")
    .update({ tier, obligation: null })
    .eq("row_id", rowId)

  if (seatsError) return { error: seatsError.message };
  await logAudit(user.id, "PRICE_SET", "row", rowId, { tier });
  revalidatePath("/", "layout"); return { success: true };
}

export async function updateRowObligation(rowId: string, obligation: ObligationType | null) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const adminClient = createAdminClient();

  const { data: profile } = await adminClient.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "super_admin") return { error: "Forbidden" };

  const { data: row } = await adminClient.from("rows").select("*").eq("id", rowId).maybeSingle();
  if (!row) return { error: "Row not found" };

  // Ensure no allocated seats exist if changing to obligation
  if (obligation) {
    const { count } = await adminClient.from("seats").select("id", { count: "exact" }).eq("row_id", rowId).not("owner_id", "is", null);
    if (count && count > 0) {
      return { error: "Cannot set obligation on row with allocated seats" };
    }
  }

  // Update row
  const { error: rowError } = await adminClient.from("rows").update({ obligation, tier: null }).eq("id", rowId);
  if (rowError) return { error: rowError.message };

  // Update all seats in that row
  const { error: seatsError } = await adminClient
    .from("seats")
    .update({ obligation, tier: null })
    .eq("row_id", rowId);

  if (seatsError) return { error: seatsError.message };
  await logAudit(user.id, "PRICE_SET", "row", rowId, { obligation });
  revalidatePath("/", "layout"); return { success: true };
}

export async function updateRowSeatCount(rowId: string, newCount: number) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const adminClient = createAdminClient();

  const { data: profile } = await adminClient.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "super_admin") return { error: "Forbidden" };

  const { data: row } = await adminClient.from("rows").select("*").eq("id", rowId).maybeSingle();
  if (!row) return { error: "Row not found" };

  // Check allocated seats
  const { count: allocatedCount } = await adminClient
    .from("seats")
    .select("id", { count: "exact" })
    .eq("row_id", rowId)
    .not("owner_id", "is", null);

  if ((allocatedCount || 0) > newCount) {
    return { error: `Cannot reduce seats below ${allocatedCount} as they are already allocated.` };
  }

  // Check seats with guests
  const { count: guestCount } = await adminClient
    .from("seats")
    .select("id", { count: "exact" })
    .eq("row_id", rowId)
    .not("guest_name", "is", null);
  
  if ((guestCount || 0) > newCount) {
    return { error: `Cannot reduce seats below ${guestCount} as they are assigned to guests.` };
  }

  const { error: rowError } = await adminClient.from("rows").update({ seat_count: newCount }).eq("id", rowId);
  if (rowError) return { error: rowError.message };

  // Adjust seat records
  const { data: currentSeats } = await adminClient.from("seats").select("seat_no").eq("row_id", rowId);
  const currentCount = currentSeats?.length || 0;

  if (newCount > currentCount) {
    // Add seats
    const seatsToInsert = [];
    for (let i = currentCount + 1; i <= newCount; i++) {
      seatsToInsert.push({
        id: generateSeatId(row.section, row.row_label, i),
        section: row.section,
        row_label: row.row_label,
        seat_no: i,
        row_id: row.id,
        tier: row.tier,
        obligation: row.obligation,
        payment_status: "pending",
        checked_in: false,
        ticket_sent: false
      });
    }
    const { error: insertError } = await adminClient.from("seats").insert(seatsToInsert);
    if (insertError) return { error: insertError.message };
  } else if (newCount < currentCount) {
    // Remove seats
    const seatsToRemove = currentSeats?.filter(s => s.seat_no > newCount).map(s => s.seat_no) || [];
    if (seatsToRemove.length > 0) {
      const { error: delError } = await adminClient
        .from("seats")
        .delete()
        .eq("row_id", rowId)
        .in("seat_no", seatsToRemove);
      if (delError) return { error: delError.message };
    }
  }

  await logAudit(user.id, "ROW_SEATCOUNT_EDIT", "row", rowId, { newCount });
  revalidatePath("/", "layout"); return { success: true };
}

export async function bulkSetTier(section: SeatSection, fromRow: string, toRow: string, tier: TierValue | null) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const adminClient = createAdminClient();

  const { data: profile } = await adminClient.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "super_admin") return { error: "Forbidden" };

  const { data: rowsData } = await adminClient.from("rows").select("*").eq("section", section);
  if (!rowsData || rowsData.length === 0) return { error: "Rows not found" };

  const sortedRows = rowsData.sort((a, b) => a.display_order - b.display_order);
  const startIdx = sortedRows.findIndex(r => r.row_label === fromRow);
  const endIdx = sortedRows.findIndex(r => r.row_label === toRow);
  
  if (startIdx === -1 || endIdx === -1) return { error: "Invalid row range" };

  const range = sortedRows.slice(Math.min(startIdx, endIdx), Math.max(startIdx, endIdx) + 1);
  const unlockedRowIds = range.filter(r => r.lock_status === "Unlocked").map(r => r.id);

  if (unlockedRowIds.length === 0) return { error: "No unlocked rows in the selected range." };

  const { error: rowError } = await adminClient
    .from("rows")
    .update({ tier, obligation: null })
    .in("id", unlockedRowIds);

  if (rowError) return { error: rowError.message };

  const { error: seatError } = await adminClient
    .from("seats")
    .update({ tier, obligation: null })
    .in("row_id", unlockedRowIds)

  if (seatError) return { error: seatError.message };

  await logAudit(user.id, "PRICE_SET", "row", `Bulk ${section} ${fromRow}-${toRow}`, { tier, count: unlockedRowIds.length });
  revalidatePath("/", "layout"); return { success: true, count: unlockedRowIds.length };
}

export async function bulkSetObligation(section: SeatSection, fromRow: string, toRow: string, obligation: ObligationType | null) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const adminClient = createAdminClient();

  const { data: profile } = await adminClient.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "super_admin") return { error: "Forbidden" };

  const { data: rowsData } = await adminClient.from("rows").select("*").eq("section", section);
  if (!rowsData || rowsData.length === 0) return { error: "Rows not found" };

  const sortedRows = rowsData.sort((a, b) => a.display_order - b.display_order);
  const startIdx = sortedRows.findIndex(r => r.row_label === fromRow);
  const endIdx = sortedRows.findIndex(r => r.row_label === toRow);
  
  if (startIdx === -1 || endIdx === -1) return { error: "Invalid row range" };

  const range = sortedRows.slice(Math.min(startIdx, endIdx), Math.max(startIdx, endIdx) + 1);
  const unlockedRowIds = range.filter(r => r.lock_status === "Unlocked").map(r => r.id);

  if (unlockedRowIds.length === 0) return { error: "No unlocked rows in the selected range." };

  const { error: rowError } = await adminClient
    .from("rows")
    .update({ obligation, tier: null })
    .in("id", unlockedRowIds);

  if (rowError) return { error: rowError.message };

  const { error: seatError } = await adminClient
    .from("seats")
    .update({ obligation, tier: null })
    .in("row_id", unlockedRowIds);

  if (seatError) return { error: seatError.message };

  await logAudit(user.id, "PRICE_SET", "row", `Bulk ${section} ${fromRow}-${toRow}`, { obligation, count: unlockedRowIds.length });
  revalidatePath("/", "layout"); return { success: true, count: unlockedRowIds.length };
}
