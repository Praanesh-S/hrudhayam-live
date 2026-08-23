import { RoleGate } from "@/components/layout/RoleGate";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AllocateClient } from "./allocate-client";
import { Profile, AccessRequest, VenueRow } from "@/lib/types";

export const dynamic = 'force-dynamic';

export default async function AllocatePage() {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  // Profiles (Sub-admins)
  const { data: subAdminsData } = await adminClient
    .from("profiles")
    .select("*")
    .eq("role", "sub_admin")
    .eq("is_active", true);

  // Pending Requests
  const { data: requestsData } = await adminClient
    .from("access_requests")
    .select("*, profile:profiles(*)")
    .eq("status", "pending");

  // Venue Rows
  const { data: venueRowsData } = await adminClient
    .from("rows")
    .select("*")
    .order("display_order", { ascending: true });

  // All seats with owner details to map row ownership accurately
  const { data: seatsData } = await adminClient
    .from("seats")
    .select("owner_id, row_label, section, tier, payment_status, ticket_sent, guest_name");

  const subAdmins: Profile[] = subAdminsData || [];
  const requests: AccessRequest[] = requestsData || [];
  const venueRows: VenueRow[] = venueRowsData || [];
  const seats = seatsData || [];

  const adminMap = new Map(subAdmins.map(a => [a.id, a.full_name]));

  // Map each row (by section + row_label) to its owner summary
  const rowOwners: Record<string, { ownerId: string; ownerName: string; count: number }[]> = {};
  for (const s of seats) {
    if (!s.owner_id) continue;
    const key = `${s.section}:${s.row_label}`;
    if (!rowOwners[key]) rowOwners[key] = [];
    const existing = rowOwners[key].find(o => o.ownerId === s.owner_id);
    if (existing) {
      existing.count++;
    } else {
      rowOwners[key].push({
        ownerId: s.owner_id,
        ownerName: adminMap.get(s.owner_id) || "Another Member",
        count: 1
      });
    }
  }
  
  // Aggregate allocations for Current Allocations tab
  const currentAllocations = subAdmins.map(admin => {
    const adminSeats = seats.filter(s => s.owner_id === admin.id);
    const uniqueRows = Array.from(new Set(adminSeats.map(s => s.row_label)));
    const filled = adminSeats.filter(s => s.guest_name).length;
    const paid = adminSeats.filter(s => (s.payment_status || '').toLowerCase() === "received").length;
    const ticketsSent = adminSeats.filter(s => s.ticket_sent).length;
    const value = adminSeats.reduce((acc, s) => acc + (s.tier || 0), 0);
    const received = adminSeats
      .filter(s => (s.payment_status || '').toLowerCase() === "received")
      .reduce((acc, s) => acc + (s.tier || 0), 0);
    
    return {
      userId: admin.id,
      name: admin.full_name,
      rows: uniqueRows,
      seatsHeld: adminSeats.length,
      seatsFilled: filled,
      seatsPaid: paid,
      ticketsSent: ticketsSent,
      value: value,
      received: received,
      pending: value - received
    };
  });

  return (
    <RoleGate allowedRoles={["super_admin"]}>
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        <AllocateClient 
          subAdmins={subAdmins} 
          requests={requests} 
          venueRows={venueRows}
          rowOwners={rowOwners}
          currentAllocations={currentAllocations}
        />
      </div>
    </RoleGate>
  );
}
