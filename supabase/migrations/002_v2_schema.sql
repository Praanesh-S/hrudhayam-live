-- ==============================================================================
-- Migration: 002_v2_schema.sql
-- Hrudhayam LIVE — Reconciled Developer Specification v1.0
-- Core schema for band-based inventory, custom auth, and competition tracking.
-- ==============================================================================

-- 0. Handle legacy empty groups table if it has UUID id
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'groups' AND data_type = 'uuid'
    ) THEN
        ALTER TABLE public.groups RENAME TO groups_legacy;
    END IF;
END $$;

-- 1. Groups (8 Teams)
CREATE TABLE IF NOT EXISTS public.groups (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Members (88 people: 8 coordinators + 80 team members)
CREATE TABLE IF NOT EXISTS public.members (
    id SERIAL PRIMARY KEY,
    full_name TEXT NOT NULL,
    phone_raw TEXT NOT NULL,
    phone_e164 TEXT,
    phone_status TEXT NOT NULL DEFAULT 'ok' CHECK (phone_status IN ('ok', 'missing', 'foreign', 'unparsed')),
    group_id INTEGER NOT NULL REFERENCES public.groups(id) ON UPDATE CASCADE,
    is_group_admin BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_members_group_id ON public.members(group_id);
CREATE INDEX IF NOT EXISTS idx_members_is_group_admin ON public.members(is_group_admin);

-- 3. Users (Login Accounts: Super Admin, 2 System Admins, 8 Group Admins)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id INTEGER REFERENCES public.members(id) ON UPDATE CASCADE ON DELETE SET NULL,
    role TEXT NOT NULL CHECK (role IN ('super_admin', 'system_admin', 'group_admin')),
    login_id TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    must_change_password BOOLEAN NOT NULL DEFAULT true,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_login_id ON public.users(login_id);
CREATE INDEX IF NOT EXISTS idx_users_member_id ON public.users(member_id);

-- 4. User Sessions (Server-side Session tokens for Custom Auth)
CREATE TABLE IF NOT EXISTS public.user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON public.user_sessions(token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON public.user_sessions(user_id);

-- 5. Login Attempts (Rate limiting and security auditing)
CREATE TABLE IF NOT EXISTS public.login_attempts (
    id SERIAL PRIMARY KEY,
    login_id TEXT NOT NULL,
    attempted_at TIMESTAMPTZ DEFAULT now(),
    success BOOLEAN NOT NULL,
    ip_address TEXT
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_lookup ON public.login_attempts(login_id, attempted_at);

-- 6. Bands (Count-per-band inventory)
CREATE TABLE IF NOT EXISTS public.bands (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    price INTEGER NOT NULL CHECK (price >= 0),
    total_allocated INTEGER NOT NULL DEFAULT 0 CHECK (total_allocated >= 0),
    sort_order INTEGER NOT NULL DEFAULT 0,
    color TEXT DEFAULT '#475569',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure columns exist if bands table already existed
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bands' AND column_name='label') THEN
        ALTER TABLE public.bands ADD COLUMN label TEXT;
        UPDATE public.bands SET label = COALESCE(name, id);
        ALTER TABLE public.bands ALTER COLUMN label SET NOT NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bands' AND column_name='price') THEN
        ALTER TABLE public.bands ADD COLUMN price INTEGER DEFAULT 0;
        UPDATE public.bands SET price = COALESCE(standard_price, 0);
        ALTER TABLE public.bands ALTER COLUMN price SET NOT NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bands' AND column_name='total_allocated') THEN
        ALTER TABLE public.bands ADD COLUMN total_allocated INTEGER DEFAULT 0;
        UPDATE public.bands SET total_allocated = COALESCE(total_capacity, 0);
        ALTER TABLE public.bands ALTER COLUMN total_allocated SET NOT NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bands' AND column_name='sort_order') THEN
        ALTER TABLE public.bands ADD COLUMN sort_order INTEGER DEFAULT 0;
        UPDATE public.bands SET sort_order = COALESCE(display_order, 0);
        ALTER TABLE public.bands ALTER COLUMN sort_order SET NOT NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bands' AND column_name='color') THEN
        ALTER TABLE public.bands ADD COLUMN color TEXT DEFAULT '#475569';
    END IF;
END $$;

-- Seed/Ensure the 4 official bands exist
INSERT INTO public.bands (id, label, price, total_allocated, sort_order, color) VALUES
  ('band_5000', 'Band A (₹5,000)', 5000, 200, 1, '#F59E0B'),
  ('band_3500', 'Band B (₹3,500)', 3500, 300, 2, '#8B5CF6'),
  ('band_2500', 'Band C (₹2,500)', 2500, 400, 3, '#0D9488'),
  ('band_1500', 'Band D (₹1,500)', 1500, 500, 4, '#64748B')
ON CONFLICT (id) DO UPDATE SET
  label = EXCLUDED.label,
  price = EXCLUDED.price,
  total_allocated = CASE WHEN public.bands.total_allocated = 0 THEN EXCLUDED.total_allocated ELSE public.bands.total_allocated END,
  sort_order = EXCLUDED.sort_order,
  color = EXCLUDED.color;

-- 7. Protected Blocks (Earmarked seats: VIP, Sponsor rows, Police/Officials)
CREATE TABLE IF NOT EXISTS public.protected_blocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    label TEXT NOT NULL,
    seat_count INTEGER NOT NULL CHECK (seat_count >= 0),
    released_to_band_id TEXT REFERENCES public.bands(id) ON UPDATE CASCADE ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 8. Participating Clubs (§8)
CREATE TABLE IF NOT EXISTS public.participating_clubs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_name TEXT NOT NULL,
    contact_name TEXT NOT NULL,
    contact_phone TEXT NOT NULL,
    entry_fee INTEGER NOT NULL DEFAULT 25000,
    passes_value INTEGER NOT NULL DEFAULT 15000,
    net_contribution INTEGER NOT NULL DEFAULT 10000,
    brought_by_member_id INTEGER REFERENCES public.members(id) ON UPDATE CASCADE ON DELETE SET NULL,
    entered_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 9. Sponsors (§7, §19.9)
CREATE TABLE IF NOT EXISTS public.sponsors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sponsor_name TEXT,
    tier TEXT,
    amount INTEGER DEFAULT 0 CHECK (amount >= 0),
    status TEXT DEFAULT 'committed' CHECK (status IN ('committed', 'received')),
    brought_by_member_id INTEGER REFERENCES public.members(id) ON UPDATE CASCADE ON DELETE SET NULL,
    entered_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    logo_file_key TEXT,
    contact_name TEXT,
    contact_phone TEXT,
    contact_email TEXT,
    notes TEXT,
    complimentary_pass_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add missing columns to sponsors if it already existed
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='sponsors' AND column_name='sponsor_name') THEN
        ALTER TABLE public.sponsors ADD COLUMN sponsor_name TEXT;
        UPDATE public.sponsors SET sponsor_name = name;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='sponsors' AND column_name='tier') THEN
        ALTER TABLE public.sponsors ADD COLUMN tier TEXT;
        UPDATE public.sponsors SET tier = sponsor_tier::text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='sponsors' AND column_name='amount') THEN
        ALTER TABLE public.sponsors ADD COLUMN amount INTEGER DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='sponsors' AND column_name='status') THEN
        ALTER TABLE public.sponsors ADD COLUMN status TEXT DEFAULT 'committed' CHECK (status IN ('committed', 'received'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='sponsors' AND column_name='brought_by_member_id') THEN
        ALTER TABLE public.sponsors ADD COLUMN brought_by_member_id INTEGER REFERENCES public.members(id) ON UPDATE CASCADE ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='sponsors' AND column_name='entered_by_user_id') THEN
        ALTER TABLE public.sponsors ADD COLUMN entered_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='sponsors' AND column_name='logo_file_key') THEN
        ALTER TABLE public.sponsors ADD COLUMN logo_file_key TEXT;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_sponsors_brought_by ON public.sponsors(brought_by_member_id);

-- 10. Passes (Central Table)
CREATE TABLE IF NOT EXISTS public.passes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pass_code TEXT NOT NULL UNIQUE,
    band_id TEXT NOT NULL REFERENCES public.bands(id) ON UPDATE CASCADE,
    ticket_type TEXT NOT NULL CHECK (ticket_type IN ('digital', 'physical')),
    physical_serial TEXT UNIQUE,
    seller_member_id INTEGER REFERENCES public.members(id) ON UPDATE CASCADE ON DELETE SET NULL,
    issued_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    donor_name TEXT NOT NULL,
    donor_phone TEXT NOT NULL,
    donor_email TEXT,
    donor_is_seller_fallback BOOLEAN NOT NULL DEFAULT false,
    source TEXT NOT NULL DEFAULT 'normal_sale' CHECK (source IN ('normal_sale', 'participating_club')),
    participating_club_id UUID REFERENCES public.participating_clubs(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'issued' CHECK (status IN ('issued', 'used', 'cancelled')),
    used_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    cancelled_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    cancel_reason TEXT,
    qr_token TEXT,
    undo_token TEXT,
    undo_expires_at TIMESTAMPTZ,
    needs_seller_reconciliation BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_passes_band_id ON public.passes(band_id);
CREATE INDEX IF NOT EXISTS idx_passes_seller_member_id ON public.passes(seller_member_id);
CREATE INDEX IF NOT EXISTS idx_passes_status ON public.passes(status);
CREATE INDEX IF NOT EXISTS idx_passes_donor_phone ON public.passes(donor_phone);
CREATE INDEX IF NOT EXISTS idx_passes_physical_serial ON public.passes(physical_serial);

-- 11. Payments (§12 Structured Payments)
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pass_id UUID REFERENCES public.passes(id) ON DELETE CASCADE,
    sponsor_id UUID REFERENCES public.sponsors(id) ON DELETE CASCADE,
    participating_club_id UUID REFERENCES public.participating_clubs(id) ON DELETE CASCADE,
    mode TEXT NOT NULL CHECK (mode IN ('upi', 'bank_transfer', 'cash', 'cheque', 'card', 'complimentary', 'legacy')),
    amount INTEGER NOT NULL CHECK (amount >= 0),
    reference_no TEXT NOT NULL,
    proof_file_key TEXT,
    status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'pending')),
    collected_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    collected_at TIMESTAMPTZ DEFAULT now(),
    legacy_discount_data JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT chk_payment_link CHECK (
      (CASE WHEN pass_id IS NOT NULL THEN 1 ELSE 0 END +
       CASE WHEN sponsor_id IS NOT NULL THEN 1 ELSE 0 END +
       CASE WHEN participating_club_id IS NOT NULL THEN 1 ELSE 0 END) = 1
    )
);

CREATE INDEX IF NOT EXISTS idx_payments_pass_id ON public.payments(pass_id);
CREATE INDEX IF NOT EXISTS idx_payments_sponsor_id ON public.payments(sponsor_id);
CREATE INDEX IF NOT EXISTS idx_payments_club_id ON public.payments(participating_club_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);

-- 12. Soft Holds (§19.7)
CREATE TABLE IF NOT EXISTS public.soft_holds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    band_id TEXT NOT NULL REFERENCES public.bands(id) ON UPDATE CASCADE,
    count INTEGER NOT NULL CHECK (count > 0),
    held_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    note TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'confirmed', 'expired', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_soft_holds_band_active ON public.soft_holds(band_id, status, expires_at);

-- 13. Leaderboard Snapshots (§19.8)
CREATE TABLE IF NOT EXISTS public.leaderboard_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    snapshot_data JSONB NOT NULL,
    taken_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    taken_at TIMESTAMPTZ DEFAULT now()
);

-- 14. Audit Log (§4, §15)
CREATE TABLE IF NOT EXISTS public.audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity TEXT NOT NULL,
    entity_id TEXT,
    before_json JSONB,
    after_json JSONB,
    at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON public.audit_log(entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON public.audit_log(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_at ON public.audit_log(at DESC);

-- 15. App Settings / Configuration
CREATE TABLE IF NOT EXISTS public.app_settings_v2 (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO public.app_settings_v2 (key, value) VALUES
  ('aed_station_cost', '150000'),
  ('aed_target_stations', '25'),
  ('hold_duration_hours', '48'),
  ('daily_digest_enabled', 'true'),
  ('daily_digest_time_ist', '"21:00"'),
  ('whatsapp_default_language', '"en"'),
  ('trust_upi_vpa', '"hrudhayamlive@indianbank"'),
  ('trust_bank_details', '{"bank": "Indian Bank", "account": "XXXXXXXXXX", "ifsc": "IDIB000XXXX"}')
ON CONFLICT (key) DO NOTHING;

-- 16. Concurrency & Oversell Block Function (Rule R5)
-- Serialized band inventory check with row lock
CREATE OR REPLACE FUNCTION public.get_band_available_seats(p_band_id TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_total_allocated INTEGER;
    v_sold_count INTEGER;
    v_active_holds INTEGER;
BEGIN
    SELECT total_allocated INTO v_total_allocated
    FROM public.bands
    WHERE id = p_band_id;

    IF v_total_allocated IS NULL THEN
        RETURN 0;
    END IF;

    -- Count active passes (issued or used, not cancelled)
    SELECT COUNT(*) INTO v_sold_count
    FROM public.passes
    WHERE band_id = p_band_id AND status != 'cancelled';

    -- Count active soft holds that have not expired
    SELECT COALESCE(SUM(count), 0) INTO v_active_holds
    FROM public.soft_holds
    WHERE band_id = p_band_id AND status = 'active' AND expires_at > now();

    RETURN GREATEST(0, v_total_allocated - v_sold_count - v_active_holds);
END;
$$;

-- Function to release expired holds (§19.7)
CREATE OR REPLACE FUNCTION public.release_expired_holds()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_updated INTEGER;
BEGIN
    UPDATE public.soft_holds
    SET status = 'expired', updated_at = now()
    WHERE status = 'active' AND expires_at <= now();

    GET DIAGNOSTICS v_updated = ROW_COUNT;
    RETURN v_updated;
END;
$$;

-- Row Level Security (RLS)
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.protected_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participating_clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sponsors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.soft_holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaderboard_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings_v2 ENABLE ROW LEVEL SECURITY;

-- Grant service_role full access on all tables for server actions
CREATE POLICY "service_role_groups" ON public.groups FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_members" ON public.members FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_users" ON public.users FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_user_sessions" ON public.user_sessions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_bands" ON public.bands FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_protected_blocks" ON public.protected_blocks FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_participating_clubs" ON public.participating_clubs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_sponsors" ON public.sponsors FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_passes" ON public.passes FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_payments" ON public.payments FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_soft_holds" ON public.soft_holds FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_snapshots" ON public.leaderboard_snapshots FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_audit_log" ON public.audit_log FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_app_settings_v2" ON public.app_settings_v2 FOR ALL TO service_role USING (true) WITH CHECK (true);
