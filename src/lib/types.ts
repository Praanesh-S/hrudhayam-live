// ──────────────────────────────────────────────
// Hrudhayam Seat & Pass Manager — TypeScript Types
// ──────────────────────────────────────────────

export type AppRole = "super_admin" | "sub_admin";
export type RequestStatus = "pending" | "approved" | "rejected";
export type SeatSection = "Ground Floor" | "Balcony";
export type ObligationType = "chief" | "police" | "corp" | "other";
export type PaymentStatus = "pending" | "received";
export type LockStatus = "Unlocked" | "Locked";
export type EmailJobStatus =
  | "queued"
  | "sending"
  | "sent"
  | "failed"
  | "deferred";

// ── Database row types ──

export interface Profile {
  id: string;
  phone: string | null;
  email: string;
  full_name: string;
  role: AppRole | null;
  is_active: boolean;
  door_duty: boolean;
  created_at: string;
  updated_at: string;
}

export interface AccessRequest {
  id: string;
  user_id: string;
  requested_role: AppRole;
  requested_rows: {
    section: SeatSection;
    rows: string[];
  } | null;
  status: RequestStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  notes: string | null;
  created_at: string;
  // Joined fields
  profile?: Profile;
}

export interface VenueRow {
  id: string;
  section: SeatSection;
  row_label: string;
  seat_count: number;
  tier: number | null;
  obligation: ObligationType | null;
  lock_status: LockStatus;
  display_order: number;
  is_placeholder: boolean;
  created_at: string;
  updated_at: string;
}

export interface Seat {
  id: string;
  section: SeatSection;
  row_label: string;
  seat_no: number;
  row_id: string;
  tier: number | null;
  owner_id: string | null;
  obligation: ObligationType | null;
  guest_name: string | null;
  guest_email: string | null;
  guest_phone: string | null;
  pass_code: string | null;
  qr_token: string | null;
  ticket_sent: boolean;
  ticket_sent_at: string | null;
  payment_status: PaymentStatus;
  checked_in: boolean;
  checked_in_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  owner?: Profile;
  row?: VenueRow;
}

export interface EmailJob {
  id: string;
  to_email: string;
  subject: string;
  html_body: string | null;
  attachments: Record<string, unknown> | null;
  seat_id: string | null;
  email_type: string;
  status: EmailJobStatus;
  attempts: number;
  scheduled_for: string;
  sent_at: string | null;
  error: string | null;
  created_by: string | null;
  created_at: string;
}

export interface EmailDailyLog {
  id: string;
  send_date: string;
  count: number;
  updated_at: string;
}

export interface AppSetting {
  key: string;
  value: unknown;
}

// ── Computed / UI types ──

export interface DashboardStats {
  totalSeats: number;
  guestsConfirmed: number;
  ticketsSent: number;
  daysToEvent: number;
  potentialRevenue: number;
  confirmedValue: number;
  paymentsReceived: number;
  paymentsPending: number;
  seatsByTier: Record<number, { total: number; filled: number; paid: number }>;
  obligationCount: number;
  seatsBySection: Record<string, { total: number; filled: number }>;
}

export interface TeamMemberStats {
  userId: string;
  name: string;
  rows: string[];
  seatsHeld: number;
  seatsFilled: number;
  seatsPaid: number;
  ticketsSent: number;
  value: number;
  received: number;
  pending: number;
}

export interface SeatMapItem {
  id: string;
  section: SeatSection;
  row_label: string;
  seat_no: number;
  tier: number | null;
  obligation: ObligationType | null;
  haGuest: boolean;
  isPaid: boolean;
  isCheckedIn: boolean;
  ownerId: string | null;
}

export interface CheckInResult {
  success: boolean;
  duplicate: boolean;
  guestName: string | null;
  seatId: string | null;
  section: string | null;
  row: string | null;
  seatNo: number | null;
  originalScanTime: string | null;
  error: string | null;
}

export type TierValue = 1500 | 3000 | 5000;
export const TIER_VALUES: TierValue[] = [1500, 3000, 5000];

export interface BulkEmailRequest {
  subject: string;
  htmlBody: string;
  filters?: {
    section?: SeatSection;
    tier?: number;
    ownerId?: string;
    paymentStatus?: PaymentStatus;
    ticketSent?: boolean;
  };
}
