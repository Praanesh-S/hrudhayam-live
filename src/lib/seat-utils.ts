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
 */
export function getSeatColor(seat: {
  tier?: number | null;
  obligation?: string | null;
  row_label?: string;
  guest_name?: string | null;
  payment_status?: string;
  checked_in?: boolean;
}): string {
  // SPL VIP / Obligation seats (Non-editable VIP)
  if (seat.obligation || seat.row_label === "SPL VIP") return "#8B5CF6"; // Royal Purple

  // Checked in
  if (seat.checked_in) return "#0284C7"; // Sky Blue

  // Paid pass
  if ((seat.payment_status || "").toLowerCase() === "received") return "#10B981"; // Emerald Green

  // Guest assigned / pending
  if (seat.guest_name && seat.guest_name.trim() !== "") return "#EF4444"; // Coral Red

  // Empty but tiered
  switch (seat.tier) {
    case 5000:
      return "#F59E0B"; // Amber Gold (Band A)
    case 3500:
    case 3000:
      return "#8B5CF6"; // Purple (Band B)
    case 2500:
      return "#0D9488"; // Teal (Band C)
    case 1500:
      return "#64748B"; // Slate Steel (Band D)
    default:
      return "#334E68"; // Default slate unassigned
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
