// ──────────────────────────────────────────────
// Seat Utility Functions
// ──────────────────────────────────────────────

import { SECTION_PREFIX } from "./constants";
import type { SeatSection } from "./types";

/**
 * Generate a seat ID from section, row label, and seat number.
 * Examples: GF-A-01, BAL-B-12, VIP-01
 */
export function generateSeatId(
  section: SeatSection,
  rowLabel: string,
  seatNo: number
): string {
  if (rowLabel === "SPL VIP") {
    return `VIP-${String(seatNo).padStart(2, "0")}`;
  }
  const prefix = SECTION_PREFIX[section] ?? "UNK";
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
  if (seatId.startsWith("VIP-")) {
    const num = parseInt(seatId.slice(4), 10);
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
 * Returns row labels sorted by display order (stage-proximity).
 */
export function getRowOrder(section: SeatSection): string[] {
  if (section === "Ground Floor") {
    return [
      "SPL VIP",
      "A", "B", "C", "D", "E", "F", "G",
      "H", "I", "J", "K", "L", "M", "N",
    ];
  }
  return ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N"];
}

/**
 * Get rows in a range (inclusive), normalized to display order.
 * Auto-corrects reversed ranges.
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

  // Auto-normalize if reversed
  if (fromIdx > toIdx) {
    [fromIdx, toIdx] = [toIdx, fromIdx];
  }

  return order.slice(fromIdx, toIdx + 1);
}

/**
 * Back-to-front fill order for seat allocation within a tier.
 * Returns seat numbers in the order they should be allocated.
 * Within a tier, fill from the edge away from the premium tier
 * (i.e., higher-numbered seats / rows farther from stage first).
 */
export function getBackToFrontOrder(
  totalSeats: number,
  _reverse: boolean = true
): number[] {
  const seats = Array.from({ length: totalSeats }, (_, i) => i + 1);
  return _reverse ? seats.reverse() : seats;
}

/**
 * Determine seat color for the map based on its state.
 */
export function getSeatColor(seat: {
  tier: number | null;
  obligation: string | null;
  guest_name: string | null;
  payment_status: string;
  checked_in: boolean;
}): string {
  // Obligation/VIP seats
  if (seat.obligation) return "#7C3AED";

  // No tier = unpriced
  if (!seat.tier) return "#E2E8F0";

  // Has guest
  if (seat.guest_name) {
    if (seat.checked_in) return "#0369A1"; // checked in
    if (seat.payment_status === "received") return "#16A34A"; // paid
    return "#E8913A"; // filled but unpaid
  }

  // Empty but priced — show tier color
  switch (seat.tier) {
    case 5000:
      return "#B8860B";
    case 3000:
      return "#0D9488";
    case 1500:
      return "#475569";
    default:
      return "#E2E8F0";
  }
}
