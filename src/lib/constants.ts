// ──────────────────────────────────────────────
// Hrudhayam — Constants & Configuration (Band-Based Model)
// ──────────────────────────────────────────────

// ── Event Info ──
export const EVENT_NAME = process.env.NEXT_PUBLIC_EVENT_NAME ?? "HRUDHAYAM LIVE 2026";
export const EVENT_DATE = process.env.NEXT_PUBLIC_EVENT_DATE ?? "Friday, 9 October 2026";
export const EVENT_VENUE =
  process.env.NEXT_PUBLIC_VENUE ??
  "The Music Academy, TTK Road, Alwarpet, Chennai";
export const EVENT_TAGLINE =
  "Rotary Club of Aarch City Madras • Fundraiser for Public-Access AEDs";

// ── Email Limits ──
export const RESEND_DAILY_LIMIT = 100;
export const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "passes@hrudhayam.live";

// ── 4 Official Price Bands ──
export const BANDS_CONFIG = [
  {
    id: "band_5000",
    name: "₹5,000 Platinum",
    standardPrice: 5000,
    color: "#F59E0B", // Amber Gold
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/40",
    textColor: "text-amber-500 dark:text-amber-400",
  },
  {
    id: "band_3500",
    name: "₹3,500 Gold",
    standardPrice: 3500,
    color: "#8B5CF6", // Royal Purple
    bgColor: "bg-purple-500/10",
    borderColor: "border-purple-500/40",
    textColor: "text-purple-600 dark:text-purple-400",
  },
  {
    id: "band_2500",
    name: "₹2,500 Silver",
    standardPrice: 2500,
    color: "#0D9488", // Teal Emerald
    bgColor: "bg-teal-500/10",
    borderColor: "border-teal-500/40",
    textColor: "text-teal-600 dark:text-teal-400",
  },
  {
    id: "band_1500",
    name: "₹1,500 Bronze",
    standardPrice: 1500,
    color: "#64748B", // Slate Steel
    bgColor: "bg-slate-500/10",
    borderColor: "border-slate-500/40",
    textColor: "text-slate-600 dark:text-slate-300",
  },
] as const;

export const BAND_COLOR_MAP: Record<string, string> = {
  band_5000: "#F59E0B",
  band_3500: "#8B5CF6",
  band_2500: "#0D9488",
  band_1500: "#64748B",
};

// ── Reserved Categories ──
export const RESERVED_CATEGORIES = [
  { value: "VIP", label: "VIP Reserved Pool" },
  { value: "PP", label: "PP Dignitary Pool" },
  { value: "GuestRelations", label: "Guest Relations Pool" },
  { value: "Other", label: "Event Staff & Other" },
] as const;

// ── Pass Code Prefix ──
export const PASS_CODE_PREFIX = "HL";

// ── Indian currency formatting ──
export function formatINR(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}
