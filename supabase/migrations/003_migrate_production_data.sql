-- ==============================================================================
-- Migration: 003_migrate_production_data.sql
-- Hrudhayam LIVE — Reconciled Developer Specification v1.0 (§22)
-- Migrates existing production data (sales, sponsors) into passes and payments.
-- ==============================================================================

DO $$
BEGIN
    -- 1. Check if legacy sales table exists
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'sales'
    ) THEN
        -- Insert into passes
        INSERT INTO public.passes (
            id,
            pass_code,
            band_id,
            ticket_type,
            physical_serial,
            seller_member_id,
            issued_by_user_id,
            donor_name,
            donor_phone,
            donor_email,
            donor_is_seller_fallback,
            source,
            status,
            used_at,
            cancelled_at,
            cancelled_by,
            cancel_reason,
            qr_token,
            needs_seller_reconciliation,
            created_at,
            updated_at
        )
        SELECT
            s.id,
            s.pass_code,
            s.band_id,
            CASE 
                WHEN s.issuance_type = 'printed' THEN 'physical'::text
                ELSE 'digital'::text
            END,
            NULL, -- physical serial was not captured in legacy
            NULL, -- seller_member_id to be reconciled by Super Admin
            NULL, -- issued_by_user_id to be reconciled
            s.donor_name,
            s.donor_phone,
            s.donor_email,
            false,
            'normal_sale',
            CASE
                WHEN s.cancelled = true THEN 'cancelled'::text
                WHEN s.checked_in = true THEN 'used'::text
                ELSE 'issued'::text
            END,
            s.checked_in_at,
            s.cancelled_at,
            NULL,
            CASE WHEN s.cancelled = true THEN 'Legacy cancellation' ELSE NULL END,
            s.qr_token,
            true, -- Flag for Super Admin reconciliation
            s.created_at,
            s.updated_at
        FROM public.sales s
        ON CONFLICT (pass_code) DO NOTHING;

        -- Insert into payments for each migrated pass
        INSERT INTO public.payments (
            pass_id,
            mode,
            amount,
            reference_no,
            status,
            legacy_discount_data,
            created_at,
            updated_at
        )
        SELECT
            s.id,
            'legacy',
            COALESCE(s.collected_amount, s.standard_price, 0),
            'MIGRATED',
            CASE 
                WHEN s.payment_status = 'paid' THEN 'received'::text 
                ELSE 'pending'::text 
            END,
            CASE 
                WHEN (s.discount_amount > 0) THEN 
                    jsonb_build_object(
                        'standard_price', s.standard_price,
                        'collected_amount', s.collected_amount,
                        'discount_amount', s.discount_amount,
                        'discount_approved_by', s.discount_approved_by
                    )
                ELSE NULL
            END,
            s.created_at,
            s.updated_at
        FROM public.sales s
        WHERE NOT EXISTS (
            SELECT 1 FROM public.payments p WHERE p.pass_id = s.id
        );

        -- Record in audit log
        INSERT INTO public.audit_log (
            action,
            entity,
            entity_id,
            after_json,
            at
        ) VALUES (
            'MIGRATION',
            'sales_to_passes',
            'batch',
            jsonb_build_object('note', 'Migrated production sales into passes and payments tables per §22'),
            now()
        );
    END IF;
END $$;
