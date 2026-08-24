// ──────────────────────────────────────────────
// Hrudhayam — Constants & Configuration
// ──────────────────────────────────────────────

import type { TierValue } from "./types";

// ── Event Info ──
export const EVENT_NAME = process.env.NEXT_PUBLIC_EVENT_NAME ?? "Hrudhayam LIVE";
export const EVENT_DATE = process.env.NEXT_PUBLIC_EVENT_DATE ?? "2026-10-09";
export const EVENT_VENUE =
  process.env.NEXT_PUBLIC_VENUE ??
  "The Music Academy, Alwarpet, Chennai";
export const EVENT_TAGLINE =
  "Rotary Club of Aarch City Madras — Fundraiser for Public-Access AEDs";

// ── Pricing Tiers ──
export const TIERS: { value: TierValue; label: string; color: string }[] = [
  { value: 5000, label: "₹5,000", color: "#B8860B" },
  { value: 3000, label: "₹3,000", color: "#0D9488" },
  { value: 1500, label: "₹1,500", color: "#475569" },
];

export const TIER_MAP: Record<number, string> = {
  5000: "₹5,000",
  3000: "₹3,000",
  1500: "₹1,500",
};

// ── Obligation Types ──
export const OBLIGATION_LABELS: Record<string, string> = {
  chief: "Chief Guests",
  police: "Police",
  corp: "Corporation",
  other: "Other",
};

// ── Seat ID Prefixes ──
export const SECTION_PREFIX: Record<string, string> = {
  "Ground Floor": "GF",
  Balcony: "BAL",
};

// ── Seat Map Colors ──
export const SEAT_COLORS = {
  tier5000: "#B8860B",
  tier3000: "#0D9488",
  tier1500: "#475569",
  obligation: "#7C3AED",
  filledPaid: "#16A34A",
  filledUnpaid: "#E8913A",
  empty: "#E2E8F0",
  checkedIn: "#0369A1",
} as const;

// ── UI Theme ──
export const THEME = {
  primary: "#0F2B3C",
  primaryLight: "#1A4A5E",
  accent: "#E8913A",
  success: "#16A34A",
  danger: "#DC2626",
  warning: "#F59E0B",
} as const;

// ── Email Config ──
export const RESEND_DAILY_LIMIT = parseInt(
  process.env.RESEND_DAILY_LIMIT ?? "100",
  10
);
export const RESEND_FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";

// ── Venue Layout ──
export const GROUND_FLOOR_ROWS: { label: string; seats: number }[] = [
  { label: "A", seats: 34 },
  { label: "B", seats: 40 },
  { label: "C", seats: 42 },
  { label: "D", seats: 43 },
  { label: "E", seats: 46 },
  { label: "F", seats: 46 },
  { label: "G", seats: 47 },
  { label: "H", seats: 50 },
  { label: "I", seats: 53 },
  { label: "J", seats: 54 },
  { label: "K", seats: 56 },
  { label: "L", seats: 57 },
  { label: "M", seats: 40 },
  { label: "N", seats: 40 },
];

export const TOTAL_GROUND_FLOOR = 648;
export const TOTAL_BALCONY = 750;
export const TOTAL_CAPACITY = 1398;

// ── Pass Code Prefix ──
export const PASS_CODE_PREFIX = "HL";

// ── Indian currency formatting ──
export function formatINR(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// ── Days to event ──
export function daysToEvent(): number {
  const eventDate = new Date(EVENT_DATE + "T00:00:00+05:30");
  const now = new Date();
  const diff = eventDate.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}
