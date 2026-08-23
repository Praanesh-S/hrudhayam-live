-- 1. Enums
CREATE TYPE public.app_role AS ENUM ('super_admin', 'sub_admin');
CREATE TYPE public.request_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE public.seat_section AS ENUM ('Ground Floor', 'Balcony');
CREATE TYPE public.obligation_type AS ENUM ('chief', 'police', 'corp', 'other');
CREATE TYPE public.payment_status AS ENUM ('pending', 'received');
CREATE TYPE public.lock_status AS ENUM ('Unlocked', 'Locked');
CREATE TYPE public.email_job_status AS ENUM ('queued', 'sending', 'sent', 'failed', 'deferred');

-- 2. profiles table
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    phone TEXT,
    email TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role public.app_role,
    is_active BOOLEAN DEFAULT false,
    door_duty BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

-- Trigger for auto-create profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 3. access_requests table
CREATE TABLE public.access_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id),
    requested_role public.app_role NOT NULL,
    requested_rows JSONB,
    status public.request_status DEFAULT 'pending',
    reviewed_by UUID REFERENCES public.profiles(id),
    reviewed_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. rows table
CREATE TABLE public.rows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section public.seat_section NOT NULL,
    row_label TEXT NOT NULL,
    seat_count INTEGER NOT NULL,
    tier INTEGER CHECK (tier IN (1500, 3000, 5000)),
    obligation public.obligation_type,
    lock_status public.lock_status DEFAULT 'Unlocked',
    display_order INTEGER NOT NULL,
    is_placeholder BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(section, row_label)
);

CREATE TRIGGER update_rows_updated_at
BEFORE UPDATE ON public.rows
FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

-- 5. seats table
CREATE TABLE public.seats (
    id TEXT PRIMARY KEY,
    section public.seat_section NOT NULL,
    row_label TEXT NOT NULL,
    seat_no INTEGER NOT NULL,
    row_id UUID NOT NULL REFERENCES public.rows(id),
    tier INTEGER CHECK (tier IN (1500, 3000, 5000)),
    owner_id UUID REFERENCES public.profiles(id),
    obligation public.obligation_type,
    guest_name TEXT,
    guest_email TEXT,
    guest_phone TEXT,
    pass_code TEXT UNIQUE,
    qr_token TEXT UNIQUE,
    ticket_sent BOOLEAN DEFAULT false,
    ticket_sent_at TIMESTAMPTZ,
    payment_status public.payment_status DEFAULT 'pending',
    checked_in BOOLEAN DEFAULT false,
    checked_in_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(section, row_label, seat_no)
);

CREATE TRIGGER update_seats_updated_at
BEFORE UPDATE ON public.seats
FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

CREATE INDEX idx_seats_owner_id ON public.seats(owner_id);
CREATE INDEX idx_seats_pass_code ON public.seats(pass_code);
CREATE INDEX idx_seats_qr_token ON public.seats(qr_token);
CREATE INDEX idx_seats_section ON public.seats(section);
CREATE INDEX idx_seats_row_id ON public.seats(row_id);

-- 6. email_queue table
CREATE TABLE public.email_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    to_email TEXT NOT NULL,
    subject TEXT NOT NULL,
    html_body TEXT,
    attachments JSONB,
    seat_id TEXT REFERENCES public.seats(id),
    email_type TEXT NOT NULL,
    status public.email_job_status DEFAULT 'queued',
    attempts INTEGER DEFAULT 0,
    scheduled_for TIMESTAMPTZ DEFAULT now(),
    sent_at TIMESTAMPTZ,
    error TEXT,
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. email_daily_log table
CREATE TABLE public.email_daily_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    send_date DATE NOT NULL UNIQUE,
    count INTEGER DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER update_email_daily_log_updated_at
BEFORE UPDATE ON public.email_daily_log
FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

-- 8. app_settings table
CREATE TABLE public.app_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL
);

INSERT INTO public.app_settings (key, value) VALUES
    ('pass_code_counter', '1'),
    ('event_date', '"2026-10-09"'),
    ('event_name', '"Hrudhayam LIVE"'),
    ('venue', '"The Music Academy, Alwarpet, Chennai"');

-- 9. Helper functions
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS public.app_role
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT role FROM public.profiles WHERE id = (SELECT auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid()) AND role = 'super_admin'::public.app_role
  );
$$;

CREATE OR REPLACE FUNCTION public.is_active_user()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid()) AND is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.increment_pass_code_counter()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    new_val INTEGER;
BEGIN
    UPDATE public.app_settings
    SET value = to_jsonb((value->>0)::int + 1)
    WHERE key = 'pass_code_counter'
    RETURNING (value->>0)::int INTO new_val;
    RETURN new_val;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_daily_email_count(target_date DATE)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    new_count INTEGER;
BEGIN
    INSERT INTO public.email_daily_log (send_date, count)
    VALUES (target_date, 1)
    ON CONFLICT (send_date)
    DO UPDATE SET count = public.email_daily_log.count + 1, updated_at = now()
    RETURNING count INTO new_count;
    RETURN new_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_daily_email_count(target_date DATE)
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    (SELECT count FROM public.email_daily_log WHERE send_date = target_date),
    0
  );
$$;

-- 10. RLS Policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_daily_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- profiles
CREATE POLICY "Users can select own profile" ON public.profiles FOR SELECT USING (id = (SELECT auth.uid()));
CREATE POLICY "Super admins can select all profiles" ON public.profiles FOR SELECT USING (public.is_super_admin());
CREATE POLICY "Super admins can update all profiles" ON public.profiles FOR UPDATE USING (public.is_super_admin());
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (id = (SELECT auth.uid()));

-- access_requests
CREATE POLICY "Users can select own requests" ON public.access_requests FOR SELECT USING (user_id = (SELECT auth.uid()));
CREATE POLICY "Users can insert own requests" ON public.access_requests FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "Super admins can select all requests" ON public.access_requests FOR SELECT USING (public.is_super_admin());
CREATE POLICY "Super admins can update all requests" ON public.access_requests FOR UPDATE USING (public.is_super_admin());

-- rows
CREATE POLICY "Active users can select rows" ON public.rows FOR SELECT USING (public.is_active_user());
CREATE POLICY "Super admins can insert rows" ON public.rows FOR INSERT WITH CHECK (public.is_super_admin());
CREATE POLICY "Super admins can update rows" ON public.rows FOR UPDATE USING (public.is_super_admin());
CREATE POLICY "Super admins can delete rows" ON public.rows FOR DELETE USING (public.is_super_admin());

-- seats
CREATE POLICY "Super admins full access on seats" ON public.seats FOR ALL USING (public.is_super_admin());
CREATE POLICY "Sub admins select own seats" ON public.seats FOR SELECT USING (owner_id = (SELECT auth.uid()));
CREATE POLICY "Sub admins update own seats" ON public.seats FOR UPDATE USING (owner_id = (SELECT auth.uid()));

-- email_queue
CREATE POLICY "Super admins full access on email_queue" ON public.email_queue FOR ALL USING (public.is_super_admin());
CREATE POLICY "Sub admins select own email_queue" ON public.email_queue FOR SELECT USING (created_by = (SELECT auth.uid()));
CREATE POLICY "Sub admins insert own email_queue" ON public.email_queue FOR INSERT WITH CHECK (created_by = (SELECT auth.uid()));

-- email_daily_log
CREATE POLICY "Super admins select email_daily_log" ON public.email_daily_log FOR SELECT USING (public.is_super_admin());

-- app_settings
CREATE POLICY "Active users can select app_settings" ON public.app_settings FOR SELECT USING (public.is_active_user());
CREATE POLICY "Super admins can update app_settings" ON public.app_settings FOR UPDATE USING (public.is_super_admin());
