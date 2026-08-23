-- Create audit_logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Only super admins can read audit logs
CREATE POLICY "Super admins can read audit logs" ON public.audit_logs
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'super_admin'
        )
    );

-- System (service role) can insert
-- (Since we'll do insertion via server actions using adminClient, we don't strictly need an INSERT policy for authenticated users if we use service role. But we can add one for safety)
CREATE POLICY "Service role can insert" ON public.audit_logs
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);
