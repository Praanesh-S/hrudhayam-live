import { SECTION_PREFIX } from "./constants";
import type { SeatSection, SeatData } from "./types";

/**
 * Generate a seat ID from section, row label, and seat number.
 * Examples: GF-A-01, BAL-B-12, GF-SPL VIP-01
 */
export function generateSeatId(
  section: SeatSection,
  rowLabel: string,
  seatNo: number
): string {
  if (rowLabel === "SPL VIP") {
    return `GF-SPL VIP-${String(seatNo).padStart(2, "0")}`;
  }
  const prefix = SECTION_PREFIX[section] ?? (section === "Ground Floor" ? "GF" : "BAL");
  return `${prefix}-${rowLabel}-${String(seatNo).padStart(2, "0")}`;
}

/**
 * Parse a seat ID back into components.
 */
export function parseSeatId(seatId: string): {
  section: SeatSection;
  rowLabel: string;
  seatNo: number;
} | null {
  if (seatId.includes("SPL VIP") || seatId.startsWith("VIP-")) {
    const parts = seatId.split("-");
    const num = parseInt(parts[parts.length - 1], 10);
    return { section: "Ground Floor", rowLabel: "SPL VIP", seatNo: num };
  }
  if (seatId.startsWith("GF-")) {
    const parts = seatId.slice(3).split("-");
    if (parts.length === 2) {
      return {
        section: "Ground Floor",
        rowLabel: parts[0],
        seatNo: parseInt(parts[1], 10),
      };
    }
  }
  if (seatId.startsWith("BAL-")) {
    const parts = seatId.slice(4).split("-");
    if (parts.length === 2) {
      return {
        section: "Balcony",
        rowLabel: parts[0],
        seatNo: parseInt(parts[1], 10),
      };
    }
  }
  return null;
}

/**
 * Get the standard row order for a section.
 */
export function getRowOrder(section: SeatSection): string[] {
  if (section === "Ground Floor") {
    return [
      "A", "B", "C", "D", "E", "F", "G",
      "H", "I", "J", "K", "L", "M", "N",
    ];
  }
  return ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N"];
}

/**
 * Get rows in a range (inclusive), normalized to display order.
 */
export function getRowsInRange(
  section: SeatSection,
  fromRow: string,
  toRow: string
): string[] {
  const order = getRowOrder(section);
  let fromIdx = order.indexOf(fromRow);
  let toIdx = order.indexOf(toRow);

  if (fromIdx === -1 || toIdx === -1) return [];

  if (fromIdx > toIdx) {
    [fromIdx, toIdx] = [toIdx, fromIdx];
  }

  return order.slice(fromIdx, toIdx + 1);
}

/**
 * Determine seat color for the map based on its state.
 * Distinct color tokens:
 * - SPL VIP Box: #8B5CF6 (Royal Purple)
 * - Blocked / Reserved: #BE123C (Deep Crimson)
 * - Sponsor Complimentary: #06B6D4 (Vibrant Cyan)
 * - Checked In: #0284C7 (Sky Blue)
 * - Paid Pass: #10B981 (Emerald Green)
 * - Pending Pass: #F97316 (Amber Orange)
 * - Band A (₹5,000): #F59E0B (Amber Gold)
 * - Band B (₹3,500): #A855F7 (Violet Purple)
 * - Band C (₹2,500): #0D9488 (Teal)
 * - Band D (₹1,500): #64748B (Steel Slate)
 */
export function getSeatColor(seat: {
  tier?: number | null;
  category?: string | null;
  obligation?: string | null;
  obligation_type?: string | null;
  row_label?: string;
  guest_name?: string | null;
  name?: string | null;
  payment_status?: string;
  checked_in?: boolean;
  is_blocked?: boolean;
  sponsor_id?: string | null;
  pass_code?: string | null;
}): string {
  // 1. VIP (SPL VIP Box or Category VIP)
  if (seat.category === 'vip' || seat.row_label === 'SPL VIP' || seat.obligation === 'chief' || seat.obligation_type === 'vip') {
    return '#EAB308'; // Gold (VIP)
  }

  // 2. Blocked
  if (seat.category === 'blocked' || seat.is_blocked) {
    return '#475569'; // Dark Slate (Blocked)
  }

  // 3. Obligation
  if (seat.category === 'obligation' || seat.obligation === 'police' || seat.obligation_type === 'police' || seat.obligation_type === 'obligation') {
    return '#EF4444'; // Red (Obligation)
  }

  // 4. Sponsor Complimentary
  if (seat.category === 'sponsor_comp' || seat.sponsor_id || seat.obligation === 'sponsor' || seat.obligation_type === 'sponsor') {
    return '#06B6D4'; // Cyan (Sponsor comp)
  }

  // 5. Category-based mapping
  if (seat.category === 'b5000') return '#F59E0B'; // Orange
  if (seat.category === 'b3500') return '#8B5CF6'; // Purple
  if (seat.category === 'b2500') return '#0D9488'; // Teal
  if (seat.category === 'b1500') return '#64748B'; // Slate
  if (seat.category === 'pp') return '#0284C7';    // Bright Blue (PP)
  if (seat.category === 'unassigned') return '#1E293B'; // Dark unassigned

  // 6. Fallback based on tier
  switch (seat.tier) {
    case 5000:
      return '#F59E0B'; // Orange (Band A)
    case 3500:
    case 3000:
      return '#8B5CF6'; // Purple (Band B)
    case 2500:
      return '#0D9488'; // Teal (Band C)
    case 1500:
      return '#64748B'; // Slate (Band D)
    case 1000:
      return '#0284C7'; // Bright Blue (PP)
    default:
      return '#1E293B'; // Unassigned
  }
}

/**
 * Robust helper to fetch all 1,398 venue seats without being capped by PostgREST's 1000 row max limit.
 * Queries in parallel ranges (0..999 and 1000..1999).
 */
export async function fetchAllSeats<T = SeatData>(
  supabaseClient: any,
  options: {
    select?: string;
    ownerId?: string;
  } = {}
): Promise<T[]> {
  const selectFields = options.select || "*";

  if (options.ownerId) {
    const res = await supabaseClient
      .from("seats")
      .select(selectFields)
      .eq("owner_id", options.ownerId)
      .order("section", { ascending: true })
      .order("row_label", { ascending: true })
      .order("seat_no", { ascending: true });

    if (res.error) console.error("fetchAllSeats owner query error:", res.error);
    return (res.data || []) as T[];
  }

  // Fetch all 1,398 seats across 2 parallel range queries to bypass 1000 limit
  const buildQuery = (from: number, to: number) => {
    return supabaseClient
      .from("seats")
      .select(selectFields)
      .range(from, to)
      .order("section", { ascending: true })
      .order("row_label", { ascending: true })
      .order("seat_no", { ascending: true });
  };

  const [batch1, batch2] = await Promise.all([
    buildQuery(0, 999),
    buildQuery(1000, 1999),
  ]);

  if (batch1.error) console.error("fetchAllSeats batch 1 error:", batch1.error);
  if (batch2.error) console.error("fetchAllSeats batch 2 error:", batch2.error);

  const data1 = (batch1.data || []) as T[];
  const data2 = (batch2.data || []) as T[];

  return [...data1, ...data2];
}
