import { RoleGate } from "@/components/layout/RoleGate";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SetupClient } from "./setup-client";
import { SeatMapItem, VenueRow } from "@/lib/types";
import { fetchAllSeats } from "@/lib/seat-utils";

export const dynamic = 'force-dynamic';

export default async function SetupPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const adminClient = createAdminClient();

  const [rowsRes, seatsData] = await Promise.all([
    adminClient.from("rows").select("*").order("display_order", { ascending: true }),
    fetchAllSeats(adminClient, {
      select: "id, section, row_label, seat_no, tier, obligation, guest_name, payment_status, checked_in, owner_id"
    })
  ]);

  const rows: VenueRow[] = rowsRes.data || [];
  const seatMapItems: SeatMapItem[] = (seatsData || []).map((s: any) => ({
    id: s.id,
    section: s.section,
    row_label: s.row_label,
    seat_no: s.seat_no,
    tier: s.tier,
    obligation: s.obligation,
    haGuest: !!s.guest_name,
    isPaid: s.payment_status === "received",
    isCheckedIn: s.checked_in,
    ownerId: s.owner_id
  }));

  return (
    <RoleGate allowedRoles={["super_admin"]}>
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        <SetupClient initialRows={rows} seatMapItems={seatMapItems} />
      </div>
    </RoleGate>
  );
}
