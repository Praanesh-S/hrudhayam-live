"use server";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import type { AppRole, SeatSection } from "@/lib/types";

export interface RowConflictInfo {
  rowLabel: string;
  ownerId: string;
  ownerName: string;
  seatCount: number;
}

export async function checkRowConflicts(section: SeatSection, rowsToCheck: string[]): Promise<{ conflicts: RowConflictInfo[] }> {
  const adminClient = createAdminClient();
  
  const { data: venueRows } = await adminClient
    .from("rows")
    .select("id, row_label")
    .eq("section", section)
    .in("row_label", rowsToCheck);

  if (!venueRows || venueRows.length === 0) return { conflicts: [] };
  const rowIds = venueRows.map(r => r.id);

  const { data: seats } = await adminClient
    .from("seats")
    .select("row_label, owner_id, profiles:owner_id(id, full_name, email)")
    .in("row_id", rowIds)
    .not("owner_id", "is", null);

  if (!seats || seats.length === 0) return { conflicts: [] };

  const conflictMap = new Map<string, { ownerId: string; ownerName: string; count: number }>();

  for (const s of seats) {
    if (!s.owner_id) continue;
    const key = `${s.row_label}-${s.owner_id}`;
    const profile = Array.isArray(s.profiles) ? s.profiles[0] : s.profiles;
    const ownerName = (profile as any)?.full_name || (profile as any)?.email || "Another Team Member";
    
    if (conflictMap.has(key)) {
      conflictMap.get(key)!.count++;
    } else {
      conflictMap.set(key, { ownerId: s.owner_id, ownerName, count: 1 });
    }
  }

  const conflicts: RowConflictInfo[] = [];
  for (const [key, val] of conflictMap.entries()) {
    const rowLabel = key.split("-")[0];
    conflicts.push({
      rowLabel,
      ownerId: val.ownerId,
      ownerName: val.ownerName,
      seatCount: val.count
    });
  }

  return { conflicts };
}

export async function allocateRows(
  userId: string, 
  section: SeatSection, 
  rowsToAllocate: string[],
  force: boolean = false
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const adminClient = createAdminClient();

  const { data: profile } = await adminClient.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "super_admin") return { error: "Forbidden" };

  const { data: venueRows } = await adminClient
    .from("rows")
    .select("id, row_label")
    .eq("section", section)
    .in("row_label", rowsToAllocate);

  if (!venueRows || venueRows.length === 0) return { error: "No valid rows found" };
  const rowIds = venueRows.map(r => r.id);

  // Check for existing conflicting allocations (seats owned by someone other than target userId)
  const { data: conflictingSeats } = await adminClient
    .from("seats")
    .select("row_label, owner_id, profiles:owner_id(full_name, email)")
    .in("row_id", rowIds)
    .not("owner_id", "is", null)
    .neq("owner_id", userId);

  if (conflictingSeats && conflictingSeats.length > 0 && !force) {
    const conflictingOwners = Array.from(new Set(conflictingSeats.map(s => {
      const p = Array.isArray(s.profiles) ? s.profiles[0] : s.profiles;
      return (p as any)?.full_name || (p as any)?.email || "Another Member";
    }))).join(", ");
    
    const conflictingRows = Array.from(new Set(conflictingSeats.map(s => s.row_label))).join(", ");

    return { 
      error: `Conflict: Row(s) ${conflictingRows} are already assigned to ${conflictingOwners}. Release them first or confirm force override.`,
      isConflict: true,
      conflictingRows,
      conflictingOwners
    };
  }

  // Get seats in these rows (excluding reserved obligations)
  let seatQuery = adminClient
    .from("seats")
    .select("id, owner_id")
    .in("row_id", rowIds)
    .is("obligation", null);

  if (!force) {
    seatQuery = seatQuery.is("owner_id", null);
  }

  const { data: seatsToUpdate, error: fetchError } = await seatQuery;
  if (fetchError) return { error: fetchError.message };
  
  if (seatsToUpdate && seatsToUpdate.length > 0) {
    const seatIds = seatsToUpdate.map(s => s.id);
    const { error: updateError } = await adminClient
      .from("seats")
      .update({ owner_id: userId })
      .in("id", seatIds);
    if (updateError) return { error: updateError.message };
  }

  // Lock the rows
  await adminClient
    .from("rows")
    .update({ lock_status: "Locked" })
    .in("id", rowIds);

  await logAudit(user.id, "allocate_rows", "user", userId, { 
    section, 
    rows: rowsToAllocate, 
    allocatedCount: seatsToUpdate?.length || 0,
    force
  });

  revalidatePath("/", "layout");
  return { success: true, allocated: seatsToUpdate?.length || 0 };
}

export async function releaseSeats(userId: string, rowLabels: string[], force: boolean = false) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const adminClient = createAdminClient();

  const { data: profile } = await adminClient.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "super_admin") return { error: "Forbidden" };

  const { data: rowsData } = await adminClient
    .from("rows")
    .select("id")
    .in("row_label", rowLabels);
  
  if (!rowsData || rowsData.length === 0) return { error: "Rows not found" };
  const rowIds = rowsData.map(r => r.id);

  if (!force) {
    // Check if there are guests
    const { count } = await adminClient
      .from("seats")
      .select("id", { count: "exact" })
      .eq("owner_id", userId)
      .in("row_id", rowIds)
      .not("guest_name", "is", null);

    if (count && count > 0) {
      return { 
        error: "Cannot release seats with guests assigned. Please confirm force release to unassign.",
        hasGuests: true
      };
    }
  }

  // Release seats
  const updates: any = { owner_id: null };
  if (force) {
    updates.guest_name = null;
    updates.guest_email = null;
    updates.guest_phone = null;
    updates.pass_code = null;
    updates.qr_token = null;
    updates.ticket_sent = false;
    updates.ticket_sent_at = null;
  }

  const { error: updateError } = await adminClient
    .from("seats")
    .update(updates)
    .eq("owner_id", userId)
    .in("row_id", rowIds);

  if (updateError) return { error: updateError.message };

  // Check if rows have any other owners remaining. If none, unlock row.
  const { count: remainingCount } = await adminClient
    .from("seats")
    .select("id", { count: "exact" })
    .in("row_id", rowIds)
    .not("owner_id", "is", null);

  if (!remainingCount || remainingCount === 0) {
    await adminClient
      .from("rows")
      .update({ lock_status: "Unlocked" })
      .in("id", rowIds);
  }

  await logAudit(user.id, "release_rows", "user", userId, { rows: rowLabels, force });
  revalidatePath("/", "layout");
  return { success: true };
}

export async function approveRequest(requestId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const adminClient = createAdminClient();

  const { data: profile } = await adminClient.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "super_admin") return { error: "Forbidden" };

  const { data: req } = await adminClient.from("access_requests").select("*").eq("id", requestId).maybeSingle();
  if (!req) return { error: "Request not found" };

  // Update request status
  await adminClient
    .from("access_requests")
    .update({ 
      status: "approved", 
      reviewed_by: user.id, 
      reviewed_at: new Date().toISOString() 
    })
    .eq("id", requestId);

  // Update user profile
  await adminClient
    .from("profiles")
    .update({ 
      role: req.requested_role, 
      is_active: true 
    })
    .eq("id", req.user_id);

  await logAudit(user.id, "update_access_request", "access_request", requestId, { status: "approved", role: req.requested_role });
  revalidatePath("/", "layout");
  return { success: true };
}

export async function rejectRequest(requestId: string, notes?: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const adminClient = createAdminClient();

  const { data: profile } = await adminClient.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "super_admin") return { error: "Forbidden" };

  await adminClient
    .from("access_requests")
    .update({ 
      status: "rejected", 
      notes, 
      reviewed_by: user.id, 
      reviewed_at: new Date().toISOString() 
    })
    .eq("id", requestId);

  await logAudit(user.id, "update_access_request", "access_request", requestId, { status: "rejected", notes });
  revalidatePath("/", "layout");
  return { success: true };
}

export async function inviteUser(email: string, fullName: string, role: AppRole, phone?: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const adminClient = createAdminClient();

  const { data: profile } = await adminClient.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "super_admin") return { error: "Forbidden" };

  // Invite user via Supabase admin auth
  const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName }
  });

  if (error) return { error: error.message };

  if (data.user) {
    await adminClient.from("profiles").upsert({
      id: data.user.id,
      email,
      full_name: fullName,
      phone: phone || null,
      role,
      is_active: true
    });
  }

  await logAudit(user.id, "invite_user", "user", data.user?.id || email, { email, role, fullName });
  revalidatePath("/", "layout");
  return { success: true };
}
