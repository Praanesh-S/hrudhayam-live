-- 1. Fix Group Ticketing (Allow multiple seats to share the same pass code)
ALTER TABLE public.seats DROP CONSTRAINT IF EXISTS seats_pass_code_key;
ALTER TABLE public.seats DROP CONSTRAINT IF EXISTS seats_qr_token_key;

-- 2. Create audit_logs table for tracking all changes
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Enable Row Level Security (RLS) on audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 4. Allow Super Admins to view audit logs
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'audit_logs' AND policyname = 'Super admins can read audit logs'
    ) THEN
        CREATE POLICY "Super admins can read audit logs" ON public.audit_logs
            FOR SELECT TO authenticated
            USING (
                EXISTS (
                    SELECT 1 FROM public.profiles
                    WHERE profiles.id = auth.uid()
                    AND profiles.role = 'super_admin'
                )
            );
    END IF;
END $$;

-- 5. Allow Service Role to insert audit logs
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'audit_logs' AND policyname = 'Service role can insert'
    ) THEN
        CREATE POLICY "Service role can insert" ON public.audit_logs
            FOR ALL TO service_role
            USING (true)
            WITH CHECK (true);
    END IF;
END $$;
