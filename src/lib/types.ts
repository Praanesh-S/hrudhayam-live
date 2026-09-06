// ──────────────────────────────────────────────
// Hrudhayam LIVE v2 — TypeScript Types
// Reconciled Developer Specification v1.0
// ──────────────────────────────────────────────

export type AppRole = 'super_admin' | 'system_admin' | 'group_admin';
export type TicketType = 'digital' | 'physical';
export type PassStatus = 'issued' | 'used' | 'cancelled';
export type PaymentStatus = 'received' | 'pending';
export type PaymentMode = 'upi' | 'bank_transfer' | 'cash' | 'cheque' | 'card' | 'complimentary' | 'legacy';
export type PhoneStatus = 'ok' | 'missing' | 'foreign' | 'unparsed';
export type SponsorStatus = 'committed' | 'received';
export type HoldStatus = 'active' | 'confirmed' | 'expired' | 'cancelled';

export type SponsorTier =
  | 'title_sponsor'
  | 'powered_by'
  | 'co_sponsor'
  | 'platinum_sponsor'
  | 'diamond_sponsor'
  | 'gold_sponsor'
  | 'special_sponsor'
  | 'other_sponsor'
  | 'event_supporters';

export interface Group {
  id: number;
  name: string;
  created_at?: string;
  updated_at?: string;
  // Aggregates
  member_count?: number;
  total_raised?: number;
  tickets_sold_count?: number;
  tickets_amount?: number;
  sponsors_amount?: number;
}

export interface Member {
  id: number;
  full_name: string;
  phone_raw: string;
  phone_e164: string | null;
  phone_status: PhoneStatus;
  group_id: number;
  is_group_admin: boolean;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  // Joined / computed
  group_name?: string;
  tickets_sold_count?: number;
  tickets_amount?: number;
  sponsors_amount?: number;
  total_raised?: number;
}

export interface User {
  id: string;
  member_id: number | null;
  role: AppRole;
  login_id: string;
  must_change_password: boolean;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  // Joined
  member?: Member;
}

export interface Band {
  id: string; // 'band_5000' | 'band_3500' | 'band_2500' | 'band_1500'
  label: string;
  price: number;
  total_allocated: number;
  sort_order: number;
  color?: string;
  created_at?: string;
  updated_at?: string;
  // Derived metrics (§4: Remaining is derived, never stored)
  sold_count?: number;
  active_holds_count?: number;
  remaining_count?: number;
  collected_amount?: number;
  pending_amount?: number;
}

export interface ProtectedBlock {
  id: string;
  label: string;
  seat_count: number;
  released_to_band_id: string | null;
  created_at?: string;
  updated_at?: string;
  // Joined
  released_band?: Band;
}

export interface Pass {
  id: string;
  pass_code: string;
  band_id: string;
  ticket_type: TicketType;
  physical_serial: string | null;
  seller_member_id: number | null;
  issued_by_user_id: string | null;
  donor_name: string;
  donor_phone: string;
  donor_email: string | null;
  donor_is_seller_fallback: boolean;
  source: 'normal_sale' | 'participating_club';
  participating_club_id: string | null;
  status: PassStatus;
  used_at: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  cancel_reason: string | null;
  qr_token: string | null;
  undo_token: string | null;
  undo_expires_at: string | null;
  needs_seller_reconciliation: boolean;
  seat_id?: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  band?: Band;
  seller?: Member;
  payment?: Payment;
  club?: ParticipatingClub;
  seat?: SeatData;
}

export interface Payment {
  id: string;
  pass_id: string | null;
  sponsor_id: string | null;
  participating_club_id: string | null;
  mode: PaymentMode;
  amount: number;
  reference_no: string;
  proof_file_key: string | null;
  status: PaymentStatus;
  collected_by_user_id: string | null;
  collected_at: string;
  legacy_discount_data: Record<string, any> | null;
  created_at: string;
  updated_at: string;
  // Signed URL for proof (generated dynamically)
  proof_signed_url?: string | null;
  // Joined
  pass?: Pass;
  sponsor?: Sponsor;
  club?: ParticipatingClub;
  collector?: User;
}

export interface Sponsor {
  id: string;
  sponsor_name: string;
  tier: string;
  amount: number;
  status: SponsorStatus;
  brought_by_member_id: number | null;
  entered_by_user_id: string | null;
  logo_file_key: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  notes: string | null;
  complimentary_pass_count: number;
  created_at: string;
  updated_at: string;
  // Dynamic signed URL for logo
  logo_signed_url?: string | null;
  // Joined
  brought_by_member?: Member;
  payment?: Payment;
}

export interface ParticipatingClub {
  id: string;
  club_name: string;
  contact_name: string;
  contact_phone: string;
  entry_fee: number; // 25000
  passes_value: number; // 15000
  net_contribution: number; // 10000
  brought_by_member_id: number | null;
  entered_by_user_id: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  brought_by_member?: Member;
  passes?: Pass[];
  payment?: Payment;
}

export interface SoftHold {
  id: string;
  band_id: string;
  count: number;
  held_by_user_id: string | null;
  note: string | null;
  expires_at: string;
  status: HoldStatus;
  created_at: string;
  updated_at: string;
  band?: Band;
}

export interface LeaderboardSnapshot {
  id: string;
  name: string;
  snapshot_data: {
    taken_at: string;
    individual: Array<{
      member_id: number;
      member_name: string;
      group_id: number;
      group_name: string;
      tickets_count: number;
      tickets_amount: number;
      sponsors_amount: number;
      total_raised: number;
      rank: number;
    }>;
    groups: Array<{
      group_id: number;
      group_name: string;
      tickets_count: number;
      tickets_amount: number;
      sponsors_amount: number;
      total_raised: number;
      rank: number;
    }>;
  };
  taken_by_user_id: string | null;
  taken_at: string;
}

export interface AuditLog {
  id: string;
  actor_user_id: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  before_json: Record<string, any> | null;
  after_json: Record<string, any> | null;
  at: string;
  actor_name?: string | null;
  actor_login_id?: string | null;
}

export type SeatSection = 'Ground Floor' | 'Balcony';
export type ObligationType = 'chief' | 'police' | 'sponsor' | 'vip';
export type TierValue = 5000 | 3500 | 3000 | 2500 | 1500;

export interface VenueRow {
  id: string;
  section: SeatSection;
  row_label: string;
  seat_count: number;
  tier: number | null;
  obligation: ObligationType | null;
  lock_status: 'Unlocked' | 'Locked';
  display_order: number;
  is_placeholder: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface SeatData {
  id: string;
  section: SeatSection;
  row_label: string;
  seat_no: number;
  tier: number | null;
  obligation: string | null;
  guest_name: string | null;
  guest_phone?: string | null;
  guest_email?: string | null;
  pass_code?: string | null;
  payment_status: string;
  checked_in: boolean;
  ticket_sent?: boolean;
  owner_id?: string | null;
  is_blocked?: boolean;
  blocked_reason?: string | null;
  sponsor_id?: string | null;
}
