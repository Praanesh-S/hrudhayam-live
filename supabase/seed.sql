-- Supabase seed file for Hrudhayam Seat & Pass Manager
-- Idempotent generation of ALL venue rows and seats (1,448 total)

BEGIN;

DO $$
DECLARE
    r RECORD;
    i INT;
    seat_id_str TEXT;
    new_row_id UUID;
    ob_val public.obligation_type;
BEGIN
    -- Temporary table to hold row definitions
    CREATE TEMP TABLE tmp_rows (
        section public.seat_section,
        row_label TEXT,
        seat_count INT,
        display_order INT,
        is_placeholder BOOLEAN,
        obligation public.obligation_type
    ) ON COMMIT DROP;

    -- Ground Floor (698 seats total: 648 regular + 50 SPL VIP)
    INSERT INTO tmp_rows VALUES ('Ground Floor', 'A', 34, 1, false, NULL);
    INSERT INTO tmp_rows VALUES ('Ground Floor', 'B', 40, 2, false, NULL);
    INSERT INTO tmp_rows VALUES ('Ground Floor', 'C', 42, 3, false, NULL);
    INSERT INTO tmp_rows VALUES ('Ground Floor', 'D', 43, 4, false, NULL);
    INSERT INTO tmp_rows VALUES ('Ground Floor', 'E', 46, 5, false, NULL);
    INSERT INTO tmp_rows VALUES ('Ground Floor', 'F', 46, 6, false, NULL);
    INSERT INTO tmp_rows VALUES ('Ground Floor', 'G', 47, 7, false, NULL);
    INSERT INTO tmp_rows VALUES ('Ground Floor', 'H', 50, 8, false, NULL);
    INSERT INTO tmp_rows VALUES ('Ground Floor', 'I', 53, 9, false, NULL);
    INSERT INTO tmp_rows VALUES ('Ground Floor', 'J', 54, 10, false, NULL);
    INSERT INTO tmp_rows VALUES ('Ground Floor', 'K', 56, 11, false, NULL);
    INSERT INTO tmp_rows VALUES ('Ground Floor', 'L', 57, 12, false, NULL);
    INSERT INTO tmp_rows VALUES ('Ground Floor', 'M', 40, 13, false, NULL);
    INSERT INTO tmp_rows VALUES ('Ground Floor', 'N', 40, 14, false, NULL);
    
    -- SPL VIP (50 chief guest seats)
    INSERT INTO tmp_rows VALUES ('Ground Floor', 'SPL VIP', 50, 0, false, 'chief');

    -- Balcony (750 placeholder seats total across A-N)
    INSERT INTO tmp_rows VALUES ('Balcony', 'A', 54, 1, true, NULL);
    INSERT INTO tmp_rows VALUES ('Balcony', 'B', 54, 2, true, NULL);
    INSERT INTO tmp_rows VALUES ('Balcony', 'C', 54, 3, true, NULL);
    INSERT INTO tmp_rows VALUES ('Balcony', 'D', 54, 4, true, NULL);
    INSERT INTO tmp_rows VALUES ('Balcony', 'E', 54, 5, true, NULL);
    INSERT INTO tmp_rows VALUES ('Balcony', 'F', 54, 6, true, NULL);
    INSERT INTO tmp_rows VALUES ('Balcony', 'G', 54, 7, true, NULL);
    INSERT INTO tmp_rows VALUES ('Balcony', 'H', 54, 8, true, NULL);
    INSERT INTO tmp_rows VALUES ('Balcony', 'I', 54, 9, true, NULL);
    INSERT INTO tmp_rows VALUES ('Balcony', 'J', 54, 10, true, NULL);
    INSERT INTO tmp_rows VALUES ('Balcony', 'K', 54, 11, true, NULL);
    INSERT INTO tmp_rows VALUES ('Balcony', 'L', 54, 12, true, NULL);
    INSERT INTO tmp_rows VALUES ('Balcony', 'M', 51, 13, true, NULL);
    INSERT INTO tmp_rows VALUES ('Balcony', 'N', 51, 14, true, NULL);

    -- Upsert rows and generate seats
    FOR r IN SELECT * FROM tmp_rows
    LOOP
        INSERT INTO public.rows (section, row_label, seat_count, display_order, is_placeholder, obligation)
        VALUES (r.section, r.row_label, r.seat_count, r.display_order, r.is_placeholder, r.obligation)
        ON CONFLICT (section, row_label) DO UPDATE 
        SET seat_count = EXCLUDED.seat_count,
            display_order = EXCLUDED.display_order,
            is_placeholder = EXCLUDED.is_placeholder,
            obligation = EXCLUDED.obligation
        RETURNING id INTO new_row_id;

        IF new_row_id IS NULL THEN
            SELECT id INTO new_row_id FROM public.rows WHERE section = r.section AND row_label = r.row_label;
        END IF;

        -- Insert seats for this row
        FOR i IN 1..r.seat_count
        LOOP
            IF r.section = 'Ground Floor' AND r.row_label = 'SPL VIP' THEN
                seat_id_str := 'VIP-' || lpad(i::text, 2, '0');
            ELSIF r.section = 'Ground Floor' THEN
                seat_id_str := 'GF-' || r.row_label || '-' || lpad(i::text, 2, '0');
            ELSIF r.section = 'Balcony' THEN
                seat_id_str := 'BAL-' || r.row_label || '-' || lpad(i::text, 2, '0');
            END IF;

            INSERT INTO public.seats (id, row_id, section, row_label, seat_no, obligation, tier)
            VALUES (
                seat_id_str, 
                new_row_id, 
                r.section, 
                r.row_label, 
                i, 
                r.obligation, 
                NULL
            )
            ON CONFLICT (id) DO UPDATE
            SET 
                row_id = EXCLUDED.row_id,
                section = EXCLUDED.section,
                row_label = EXCLUDED.row_label,
                seat_no = EXCLUDED.seat_no,
                obligation = EXCLUDED.obligation;
        END LOOP;
    END LOOP;
END $$;

COMMIT;

-- Verification Check
DO $$
DECLARE
    gf_count INT;
    bal_count INT;
BEGIN
    SELECT COUNT(*) INTO gf_count FROM public.seats WHERE section = 'Ground Floor';
    SELECT COUNT(*) INTO bal_count FROM public.seats WHERE section = 'Balcony';

    RAISE NOTICE 'Ground Floor Seat Count: % (Expected 698)', gf_count;
    RAISE NOTICE 'Balcony Seat Count: % (Expected 750)', bal_count;
    RAISE NOTICE 'Total Seat Count: % (Expected 1448)', (gf_count + bal_count);
    
    IF gf_count != 698 THEN
        RAISE EXCEPTION 'Ground Floor count mismatch! Expected 698, got %', gf_count;
    END IF;
    
    IF bal_count != 750 THEN
        RAISE EXCEPTION 'Balcony count mismatch! Expected 750, got %', bal_count;
    END IF;
END $$;
