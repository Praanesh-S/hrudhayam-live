"use server";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import type { AppRole, SeatSection } from "@/lib/types";

export async function allocateRows(userId: string, section: SeatSection, rowsToAllocate: string[]) {
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

  // Update seats that are not owned or reserved (no guest, no obligation)
  const { data: seatsToUpdate, error: fetchError } = await adminClient
    .from("seats")
    .select("id")
    .in("row_id", rowIds)
    .is("owner_id", null)
    .is("guest_name", null)
    .is("obligation", null);

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

  await logAudit(user.id, "allocate_rows", "user", userId, { section, rows: rowsToAllocate, allocatedCount: seatsToUpdate?.length || 0 });
  revalidatePath("/", "layout"); return { success: true, allocated: seatsToUpdate?.length || 0 };
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
      return { error: "Cannot release seats with guests assigned. Use force release if necessary." };
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

  // Unlock the rows
  await adminClient
    .from("rows")
    .update({ lock_status: "Unlocked" })
    .in("id", rowIds);

  await logAudit(user.id, "release_rows", "user", userId, { rows: rowLabels, force });
  revalidatePath("/", "layout"); return { success: true };
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

  revalidatePath("/", "layout"); return { success: true };
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

  revalidatePath("/", "layout"); return { success: true };
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

  revalidatePath("/", "layout"); return { success: true };
}
