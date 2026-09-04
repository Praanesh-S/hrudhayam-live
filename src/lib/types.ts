// ──────────────────────────────────────────────
// Hrudhayam — Band-Based Selling TypeScript Types
// ──────────────────────────────────────────────

export type AppRole = "super_admin" | "sub_admin" | "system_admin";
export type RequestStatus = "pending" | "approved" | "rejected";
export type PaymentStatus = "paid" | "pending";
export type IssuanceType = "whatsapp" | "printed" | "legacy_email" | null;
export type ReservedCategory = "VIP" | "PP" | "GuestRelations" | "Other";

export type SponsorTier =
  | "title_sponsor"
  | "powered_by"
  | "co_sponsor"
  | "platinum_sponsor"
  | "diamond_sponsor"
  | "gold_sponsor"
  | "special_sponsor"
  | "other_sponsor"
  | "event_supporters";

export type AuditAction =
  | "BAND_CAPACITY_SET"
  | "RESERVED_POOL_SET"
  | "RESERVED_NAME_FILL"
  | "SALE_CREATE"
  | "DETAIL_EDIT"
  | "PAYMENT_STATUS_CHANGE"
  | "DISCOUNT_APPROVE"
  | "ISSUANCE_WHATSAPP"
  | "ISSUANCE_PRINTED"
  | "SPONSOR_TAG"
  | "CHECK_IN"
  | "CHECK_IN_OVERRIDE"
  | "SALE_CANCEL"
  | "SALE_REASSIGN"
  | "MIGRATION"
  | "ACCESS_REQUEST_UPDATE"
  | "USER_INVITE"
  | "SPONSOR_CREATE"
  | "SPONSOR_UPDATE"
  | "SPONSOR_DELETE"
  | "MASS_EMAIL_BROADCAST";

// ── Database Models ──

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
  requested_rows?: any;
  status: RequestStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  notes: string | null;
  created_at: string;
  profile?: Profile;
}

export interface Band {
  id: string; // 'band_5000', 'band_3500', 'band_2500', 'band_1500'
  name: string;
  standard_price: number;
  total_capacity: number;
  display_order: number;
  created_at?: string;
  updated_at?: string;
  // Derived metrics
  sold_count?: number;
  remaining_count?: number;
  collected_amount?: number;
  pending_amount?: number;
  discount_amount?: number;
}

export interface ReservedPool {
  id: string;
  category: ReservedCategory;
  name: string;
  total_count: number;
  display_order: number;
  created_at?: string;
  updated_at?: string;
  entries?: ReservedEntry[];
}

export interface ReservedEntry {
  id: string;
  pool_id: string;
  name: string | null;
  notes: string | null;
  created_at?: string;
}

export interface SaleBatch {
  id: string;
  lead_contact_name: string;
  lead_contact_phone: string;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Sale {
  id: string;
  band_id: string;
  donor_name: string;
  donor_phone: string;
  donor_email: string | null;
  payment_status: "paid" | "pending";
  comment: string | null;
  standard_price: number;
  collected_amount: number;
  discount_amount: number;
  discount_approved_by: string | null;
  sold_by: string | null;
  pass_code: string;
  qr_token: string;
  issuance_type: IssuanceType;
  issued_at: string | null;
  checked_in: boolean;
  checked_in_at: string | null;
  checked_in_by: string | null;
  sponsor_id: string | null;
  sale_batch_id: string | null;
  legacy_seat_id: string | null;
  cancelled: boolean;
  cancelled_by: string | null;
  cancelled_at: string | null;
  reassigned_to: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  band?: Band;
  seller?: Profile;
  sponsor?: Sponsor;
  batch?: SaleBatch;
  checked_in_profile?: Profile;
}

export interface Sponsor {
  id: string;
  name: string;
  sponsor_tier: SponsorTier;
  complimentary_pass_count: number;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  action: AuditAction | string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, any> | null;
  created_at: string;
  profiles?: {
    full_name: string | null;
    email: string | null;
    role: string | null;
  } | null;
}

export interface TeamMemberReport {
  userId: string;
  name: string;
  email: string;
  role: AppRole | null;
  seatsSold: number;
  standardValue: number;
  collectedAmount: number;
  pendingAmount: number;
  discountAmount: number;
  whatsappPasses: number;
  printedTickets: number;
  unissuedCount: number;
}
